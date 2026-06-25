/************************************************************
 * authGate.js
 * Supabase 登录门禁
 ************************************************************/

(() => {
    document.documentElement.classList.add('auth-pending');

    const TARGET_KEY = 'classRecordRedirectTarget';
    const AUTH_PAGE = 'auth.html';
    const CONFIG_SCRIPT = 'js/supabaseConfig.js';
    const CLIENT_SCRIPT = 'js/supabaseClient.js';
    const USER_STATE_SCRIPT = 'js/userState.js';

    let resolveAccess;
    let rejectAccess;
    let currentSession = null;
    let authReadyError = null;
    const accessPromise = new Promise((resolve, reject) => {
        resolveAccess = resolve;
        rejectAccess = reject;
    });

    const path = window.location.pathname;
    const isAuthPage = path.endsWith(`/${AUTH_PAGE}`) || path.endsWith(AUTH_PAGE);

    window.waitForAccess = () => accessPromise;
    window.getCurrentSession = () => currentSession;
    window.getCurrentUser = () => currentSession?.user || null;
    window.getAuthReadyError = () => authReadyError;
    window.dispatchEvent(new Event('authGateReady'));

    const revealPage = () => document.documentElement.classList.remove('auth-pending');

    const resolveAccessPromise = () => {
        if (resolveAccess) {
            resolveAccess(currentSession);
            resolveAccess = null;
            rejectAccess = null;
        }
    };

    const rejectAccessPromise = (error) => {
        authReadyError = error;
        if (rejectAccess) {
            rejectAccess(error);
            resolveAccess = null;
            rejectAccess = null;
        }
        window.dispatchEvent(new CustomEvent('authGateError', { detail: error }));
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const url = new URL(src, window.location.href).href;
        const existing = Array.from(document.scripts).find((script) => script.src === url);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`${src} 加载失败。`));
        document.head.appendChild(script);
    });

    const clearProjectCache = async () => {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('classRecord') || key.startsWith('sb-')) {
                localStorage.removeItem(key);
            }
        });
        Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith('classRecord')) {
                sessionStorage.removeItem(key);
            }
        });
        window.ClassRecordHiddenModeActive = false;
        if (typeof window.clearCache === 'function') {
            await window.clearCache();
        }
        if ('caches' in window) {
            const keys = await caches.keys().catch(() => []);
            await Promise.all(keys
                .filter((key) => key.startsWith('classRecord') || key.includes('classrecord'))
                .map((key) => caches.delete(key)));
        }
    };

    const storeRedirectTarget = () => {
        const target = window.location.pathname + window.location.search + window.location.hash;
        sessionStorage.setItem(TARGET_KEY, target);
    };

    const redirectAfterLogin = () => {
        const target = sessionStorage.getItem(TARGET_KEY) || 'index.html';
        sessionStorage.removeItem(TARGET_KEY);
        window.location.replace(target);
    };

    const ensureAuthClient = async () => {
        await loadScript(CONFIG_SCRIPT);
        await loadScript(CLIENT_SCRIPT);
        if (!window.ClassRecordSupabase) {
            throw new Error('Supabase 客户端初始化失败。');
        }
        if (!window.ClassRecordSupabase.isConfigured()) {
            throw new Error('Supabase 尚未配置，请先填写 js/supabaseConfig.js。');
        }
        return window.ClassRecordSupabase;
    };

    const handleGate = async () => {
        try {
            const auth = await ensureAuthClient();
            currentSession = await auth.getSession();
            if (currentSession) {
                await loadScript(USER_STATE_SCRIPT);
            }
            auth.onAuthStateChange((_event, session) => {
                currentSession = session || null;
                window.dispatchEvent(new CustomEvent('classRecordAuthChange', { detail: currentSession }));
            }).catch(() => {});

            if (currentSession) {
                resolveAccessPromise();
                revealPage();
                if (isAuthPage) {
                    redirectAfterLogin();
                }
                return;
            }

            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }

            resolveAccessPromise();
            revealPage();
        } catch (error) {
            console.warn('认证初始化失败：', error);
            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            rejectAccessPromise(error);
            revealPage();
        }
    };

    window.verifyAccessKey = async (login, password) => {
        try {
            const auth = await ensureAuthClient();
            currentSession = await auth.signIn({ login, password });
            await loadScript(USER_STATE_SCRIPT);
            resolveAccessPromise();
            revealPage();
            return { ok: true };
        } catch (error) {
            return { ok: false, message: error?.message || '登录失败。' };
        }
    };

    window.changeCurrentPassword = async (password) => {
        const auth = await ensureAuthClient();
        await auth.updatePassword(password);
    };

    window.clearAccessKey = async () => {
        try {
            if (window.ClassRecordSupabase?.isConfigured()) {
                await window.ClassRecordSupabase.signOut();
            }
        } finally {
            currentSession = null;
            await clearProjectCache();
        }
    };

    handleGate();
})();

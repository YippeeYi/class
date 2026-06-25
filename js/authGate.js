/************************************************************
 * authGate.js
 * Supabase 登录门禁
 ************************************************************/

(() => {
    const TARGET_KEY = 'classRecordRedirectTarget';
    const AUTH_PAGE = 'auth.html';
    const ASSET_VERSION = '20260625';
    const versioned = (src) => `${src}?v=${ASSET_VERSION}`;
    const CONFIG_SCRIPT = versioned('js/supabaseConfig.js');
    const CLIENT_SCRIPT = versioned('js/supabaseClient.js');
    const DATA_SCRIPT = versioned('js/secureData.js');
    const USER_STATE_SCRIPT = versioned('js/userState.js');

    let resolveAccess;
    let rejectAccess;
    let currentSession = null;
    let authReadyError = null;
    const accessPromise = new Promise((resolve, reject) => {
        resolveAccess = resolve;
        rejectAccess = reject;
    });

    const isAuthPage = window.location.pathname.endsWith(`/${AUTH_PAGE}`) || window.location.pathname.endsWith(AUTH_PAGE);

    window.waitForAccess = () => accessPromise;
    window.getCurrentSession = () => currentSession;
    window.getCurrentUser = () => currentSession?.user || null;
    window.getAuthReadyError = () => authReadyError;
    window.dispatchEvent(new Event('authGateReady'));

    const resolveAccessPromise = () => {
        if (!resolveAccess) return;
        resolveAccess(currentSession);
        resolveAccess = null;
        rejectAccess = null;
    };

    const rejectAccessPromise = (error) => {
        authReadyError = error;
        if (rejectAccess) rejectAccess(error);
        resolveAccess = null;
        rejectAccess = null;
        window.dispatchEvent(new CustomEvent('authGateError', { detail: error }));
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const url = new URL(src, window.location.href).href;
        const existing = Array.from(document.scripts).find((script) => script.src === url);
        if (existing) {
            if (existing.dataset.loaded === 'true') { resolve(); return; }
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
        script.onerror = () => reject(new Error(`${src} 加载失败。`));
        document.head.appendChild(script);
    });

    const clearProjectCache = () => {
        try {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('classRecord') || key.startsWith('sb-')) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach((key) => {
                if (key.startsWith('classRecord') || key.startsWith('sb-')) sessionStorage.removeItem(key);
            });
        } catch {}
        if ('caches' in window) {
            caches.keys()
                .then((keys) => Promise.all(keys.filter((key) => key.startsWith('classRecord')).map((key) => caches.delete(key))))
                .catch(() => {});
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
        if (!window.ClassRecordSupabase) throw new Error('Supabase 客户端初始化失败。');
        if (!window.ClassRecordSupabase.isConfigured()) throw new Error('Supabase 尚未配置。');
        return window.ClassRecordSupabase;
    };

    const handleGate = async () => {
        try {
            const auth = await ensureAuthClient();
            currentSession = await auth.getSession();
            if (currentSession) await loadScript(USER_STATE_SCRIPT);
            auth.onAuthStateChange((_event, session) => {
                currentSession = session || null;
                window.dispatchEvent(new CustomEvent('classRecordAuthChange', { detail: currentSession }));
            }).catch(() => {});

            if (currentSession) {
                resolveAccessPromise();
                if (isAuthPage) redirectAfterLogin();
                return;
            }

            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            resolveAccessPromise();
        } catch (error) {
            console.warn('认证初始化失败：', error);
            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            rejectAccessPromise(error);
        }
    };

    window.verifyAccessKey = async (login, password) => {
        try {
            const auth = await ensureAuthClient();
            currentSession = await auth.signIn({ login, password });
            await loadScript(USER_STATE_SCRIPT);
            resolveAccessPromise();
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
            if (window.ClassRecordSupabase?.isConfigured()) await window.ClassRecordSupabase.signOut();
        } finally {
            currentSession = null;
            clearProjectCache();
        }
    };

    handleGate();
})();
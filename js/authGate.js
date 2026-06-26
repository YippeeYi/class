/************************************************************
 * authGate.js
 * 统一密钥门禁
 ************************************************************/

(() => {
    document.documentElement.classList.add("auth-pending");

    const TARGET_KEY = "classRecordRedirectTarget";
    const VERIFIED_KEY = "classRecordSiteKeyVerified.v1";
    const VISITOR_KEY = "classRecordVisitorKey.v1";
    const AUTH_PAGE = "auth.html";
    const CONFIG_SCRIPT = "js/supabaseConfig.js";
    const CLIENT_SCRIPT = "js/supabaseClient.js";
    const DATA_SCRIPT = "js/secureData.js";

    let resolveAccess;
    let rejectAccess;
    let authReadyError = null;
    const accessPromise = new Promise((resolve, reject) => {
        resolveAccess = resolve;
        rejectAccess = reject;
    });

    const path = window.location.pathname;
    const isAuthPage = path.endsWith(`/${AUTH_PAGE}`) || path.endsWith(AUTH_PAGE);

    window.waitForAccess = () => accessPromise;
    window.getAuthReadyError = () => authReadyError;
    window.dispatchEvent(new Event("authGateReady"));

    const revealPage = () => document.documentElement.classList.remove("auth-pending");

    const resolveAccessPromise = () => {
        if (!resolveAccess) return;
        resolveAccess({ verified: true });
        resolveAccess = null;
        rejectAccess = null;
    };

    const rejectAccessPromise = (error) => {
        authReadyError = error;
        if (rejectAccess) {
            rejectAccess(error);
            resolveAccess = null;
            rejectAccess = null;
        }
        window.dispatchEvent(new CustomEvent("authGateError", { detail: error }));
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const url = new URL(src, window.location.href).href;
        const existing = Array.from(document.scripts).find((script) => script.src === url);
        if (existing) {
            if (existing.dataset.loaded === "true" || window.ClassRecordSupabase) {
                resolve();
                return;
            }
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };
        script.onerror = () => reject(new Error(`${src} 加载失败。`));
        document.head.appendChild(script);
    });

    const hasVerifiedAccess = () => {
        try {
            const item = JSON.parse(localStorage.getItem(VERIFIED_KEY) || "null");
            return Boolean(item?.verified === true);
        } catch (error) {
            return false;
        }
    };

    const saveVerifiedAccess = () => {
        localStorage.setItem(VERIFIED_KEY, JSON.stringify({
            verified: true,
            verifiedAt: new Date().toISOString()
        }));
    };

    const ensureVisitorKey = () => {
        try {
            let value = localStorage.getItem(VISITOR_KEY);
            if (!value) {
                value = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                localStorage.setItem(VISITOR_KEY, value);
            }
            return value;
        } catch (error) {
            return "session-visitor";
        }
    };

    window.getClassRecordVisitorKey = ensureVisitorKey;

    const shouldClearKey = (key) => {
        const lower = String(key || "").toLowerCase();
        return lower.startsWith("classrecord")
            || lower.startsWith("sb-")
            || lower.includes("achievement")
            || lower.includes("qcoin")
            || lower.includes("coin")
            || lower.includes("favorite")
            || lower.includes("comment")
            || lower.includes("profile")
            || lower.includes("auth")
            || lower.includes("supabase");
    };

    const clearProjectCache = async () => {
        try {
            Object.keys(localStorage).forEach((key) => {
                if (shouldClearKey(key)) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach((key) => {
                if (shouldClearKey(key)) sessionStorage.removeItem(key);
            });
        } catch (error) {
            console.warn("项目缓存清理失败：", error);
        }
        window.ClassRecordHiddenModeActive = false;
        if (typeof window.clearCache === "function") {
            await window.clearCache().catch((error) => console.warn("缓存清理失败：", error));
        }
        if ("caches" in window) {
            const keys = await caches.keys().catch(() => []);
            await Promise.all(keys
                .filter((key) => key.startsWith("classRecord") || key.toLowerCase().includes("classrecord"))
                .map((key) => caches.delete(key)));
        }
    };

    const storeRedirectTarget = () => {
        const target = window.location.pathname + window.location.search + window.location.hash;
        if (!target.endsWith(AUTH_PAGE)) {
            sessionStorage.setItem(TARGET_KEY, target);
        }
    };

    const redirectAfterVerification = () => {
        const target = sessionStorage.getItem(TARGET_KEY) || "index.html";
        sessionStorage.removeItem(TARGET_KEY);
        window.location.replace(target);
    };

    const ensureSupabaseClient = async () => {
        await loadScript(CONFIG_SCRIPT);
        await loadScript(CLIENT_SCRIPT);
        await loadScript(DATA_SCRIPT);
        if (!window.ClassRecordSupabase) {
            throw new Error("Supabase 客户端初始化失败。");
        }
        if (!window.ClassRecordSupabase.isConfigured()) {
            throw new Error("Supabase 尚未配置，请先填写 js/supabaseConfig.js。");
        }
        return window.ClassRecordSupabase;
    };

    const handleGate = async () => {
        try {
            if (!hasVerifiedAccess() && !isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            await ensureSupabaseClient();
            if (hasVerifiedAccess()) {
                ensureVisitorKey();
                resolveAccessPromise();
                revealPage();
                if (isAuthPage) redirectAfterVerification();
                return;
            }

            resolveAccessPromise();
            revealPage();
        } catch (error) {
            console.warn("密钥门禁初始化失败：", error);
            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            rejectAccessPromise(error);
            revealPage();
        }
    };

    window.verifyAccessKey = async (key) => {
        try {
            const auth = await ensureSupabaseClient();
            const ok = await auth.verifySiteKey(key);
            if (!ok) {
                return { ok: false, message: "密钥错误，请重新输入。" };
            }
            saveVerifiedAccess();
            ensureVisitorKey();
            resolveAccessPromise();
            revealPage();
            return { ok: true };
        } catch (error) {
            console.warn("密钥验证失败：", error);
            return { ok: false, message: error?.message || "密钥验证请求失败，请稍后重试。" };
        }
    };

    window.clearAccessKey = async () => {
        await clearProjectCache();
    };

    handleGate();
})();

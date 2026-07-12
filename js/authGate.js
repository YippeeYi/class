/************************************************************
 * authGate.js
 * 统一邀请码门禁
 ************************************************************/

(() => {
    document.documentElement.classList.add("auth-pending");

    const TARGET_KEY = "classRecordRedirectTarget";
    const ACCESS_KEY = "classRecord:inviteAccess";
    const LAST_VISIT_KEY = "classRecord:lastVisitAt";
    const ACCESS_MAX_IDLE_DAYS = 30;
    const ACCESS_TTL = ACCESS_MAX_IDLE_DAYS * 24 * 60 * 60 * 1000;
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
    window.getInviteAccessToken = () => {
        try {
            const item = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
            return item?.type === "invite" ? String(item.token || "") : "";
        } catch (error) {
            return "";
        }
    };
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

    const getAccessState = () => {
        try {
            localStorage.removeItem("classRecord" + "SiteKeyVerified.v1");
            const raw = localStorage.getItem(ACCESS_KEY);
            const lastVisitRaw = localStorage.getItem(LAST_VISIT_KEY);
            if (!raw || !lastVisitRaw) return { verified: false, shouldClear: Boolean(raw || lastVisitRaw) };
            const item = JSON.parse(raw);
            const lastVisitAt = Date.parse(lastVisitRaw);
            if (item?.verified !== true || item?.type !== "invite" || !item?.token || !Number.isFinite(lastVisitAt) || Date.now() - lastVisitAt > ACCESS_TTL) {
                return { verified: false, shouldClear: true };
            }
            return { verified: true, shouldClear: false };
        } catch (error) {
            return { verified: false, shouldClear: true };
        }
    };

    const saveVerifiedAccess = (token) => {
        const accessToken = token || window.getInviteAccessToken?.() || "";
        localStorage.setItem(ACCESS_KEY, JSON.stringify({
            verified: true,
            type: "invite",
            token: accessToken,
            verifiedAt: new Date().toISOString()
        }));
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
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
            const accessState = getAccessState();
            if (accessState.shouldClear) {
                await window.clearAllSiteCache?.({ preserveRedirectTarget: !isAuthPage });
            }
            const verified = accessState.verified;
            if (!verified && !isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            await ensureSupabaseClient();
            if (verified) {
                const refreshed = await window.ClassRecordSupabase?.refreshInviteAccess?.();
                if (!refreshed) {
                    await window.clearAllSiteCache?.({ preserveRedirectTarget: !isAuthPage });
                    if (!isAuthPage) {
                        storeRedirectTarget();
                        window.location.replace(AUTH_PAGE);
                        return;
                    }
                }
                saveVerifiedAccess();
                resolveAccessPromise();
                revealPage();
                if (isAuthPage) redirectAfterVerification();
                return;
            }

            resolveAccessPromise();
            revealPage();
        } catch (error) {
            console.warn("访问门禁初始化失败：", error);
            if (!isAuthPage) {
                storeRedirectTarget();
                window.location.replace(AUTH_PAGE);
                return;
            }
            rejectAccessPromise(error);
            revealPage();
        }
    };

    window.verifyInviteCode = async (code) => {
        try {
            const auth = await ensureSupabaseClient();
            const result = await auth.verifyInviteCode(code);
            if (!result?.ok) {
                return { ok: false, message: "邀请码无效或已不可使用，请检查后重新输入。" };
            }
            if (!result.accessToken) {
                return { ok: false, message: "邀请码已验证，但访问凭证生成失败，请稍后重试。" };
            }
            saveVerifiedAccess(result.accessToken);
            resolveAccessPromise();
            revealPage();
            return { ok: true };
        } catch (error) {
            console.warn("邀请码验证失败：", error);
            return { ok: false, message: error?.message || "邀请码验证请求失败，请稍后重试。" };
        }
    };

    window.clearInviteAccess = async () => {
        await window.clearAllSiteCache?.();
    };

    window.clearAccessKey = window.clearInviteAccess;

    handleGate();
})();

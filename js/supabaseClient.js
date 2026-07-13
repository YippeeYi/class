(function () {
    const SDK_URL = "vendor/supabase-js-2.45.0.js";
    const SDK_INTEGRITY = "sha384-NNePyabYRaJyedI6EQAY7SV5Z8/0sQkuQ5WVfhKm0H+j0KSugkI2ZMNzw/QtzAWz";
    const DEFAULT_TABLES = {
        records: "class_records",
        people: "class_people",
        recordPages: "class_record_pages",
        pageMessages: "class_page_messages",
        pageSupplements: "class_page_supplements",
        materials: "class_materials",
        quizQuestions: "class_quiz_questions",
        creditsPage: "class_credits_page"
    };

    let sdkPromise = null;
    let client = null;

    const loadScript = (src) => new Promise((resolve, reject) => {
        const existing = Array.from(document.scripts).find((script) => script.src === src);
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            if (window.supabase) resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.referrerPolicy = "no-referrer";
        if (src === SDK_URL) script.integrity = SDK_INTEGRITY;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase SDK load failed."));
        document.head.appendChild(script);
    });

    const ensureSdk = async () => {
        if (window.supabase?.createClient) return window.supabase;
        if (!sdkPromise) {
            sdkPromise = loadScript(SDK_URL).then(() => {
                if (!window.supabase?.createClient) throw new Error("Supabase SDK unavailable.");
                return window.supabase;
            });
        }
        return sdkPromise;
    };

    const getConfig = () => {
        const config = window.CLASS_RECORD_SUPABASE || {};
        return {
            ...config,
            tables: { ...DEFAULT_TABLES, ...(config.tables || {}) },
            storage: {
                privateBucket: config.bucket || "classrecord-private",
                ...(config.storage || {})
            },
            useSecureContent: config.useSecureContent !== false
        };
    };

    const isConfigured = () => {
        const config = getConfig();
        return Boolean(String(config.url || "").trim() && String(config.anonKey || "").trim());
    };

    const getClient = async () => {
        if (client) return client;
        const config = getConfig();
        if (!isConfigured()) throw new Error("Supabase is not configured.");
        const supabase = await ensureSdk();
        client = supabase.createClient(config.url.trim().replace(/\/$/, ""), config.anonKey.trim(), {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: {
                headers: {
                    "x-class-record-access": window.getInviteAccessToken?.() || ""
                }
            }
        });
        return client;
    };

    const getErrorMessage = (error, fallback) => {
        const message = String(error?.message || "").toLowerCase();
        const code = String(error?.code || "").toLowerCase();
        if (code === "pgrst202" || message.includes("could not find the function") || message.includes("schema cache")) {
            return "邀请码验证 RPC 不存在或尚未刷新，请在 Supabase SQL Editor 执行 verify_invite_code 配置 SQL 后重试。";
        }
        if (message.includes("network") || message.includes("fetch")) return "Network request failed.";
        return fallback || "Operation failed.";
    };

    const verifyInviteCode = async (code) => {
        const value = String(code || "").trim();
        if (!value) return false;
        const supabase = await getClient();
        const { data, error } = await supabase.rpc("verify_invite_code", { input_code: value });
        if (error) {
            throw new Error(getErrorMessage(error, "Invite code verification failed."));
        }
        if (data === true) return { ok: true };
        if (data && typeof data === "object") return data;
        return { ok: false, reason: "invalid" };
    };

    const refreshInviteAccess = async () => {
        const token = window.getInviteAccessToken?.() || "";
        if (!token) return false;
        const supabase = await getClient();
        const { data, error } = await supabase.rpc("refresh_invite_access", { input_token: token });
        if (error) {
            throw new Error(getErrorMessage(error, "Invite access refresh failed."));
        }
        return data === true;
    };

    const hasAdminAccess = async () => {
        const token = window.getInviteAccessToken?.() || "";
        if (!token) return false;
        const supabase = await getClient();
        const { data, error } = await supabase.rpc("has_class_record_admin_access", {});
        if (error) return false;
        return data === true;
    };

    window.ClassRecordSupabase = {
        getConfig,
        getClient,
        getErrorMessage,
        isConfigured,
        verifyInviteCode,
        refreshInviteAccess,
        hasAdminAccess
    };
})();

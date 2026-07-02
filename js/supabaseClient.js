(function () {
    const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    const DEFAULT_TABLES = {
        records: "class_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        pageMessages: "class_page_messages",
        quizQuestions: "class_quiz_questions"
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
                signedUrlExpiresIn: 600,
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
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        return client;
    };

    const getErrorMessage = (error, fallback) => {
        const message = String(error?.message || "").toLowerCase();
        const code = String(error?.code || "").toLowerCase();
        if (code === "pgrst202" || message.includes("could not find the function") || message.includes("schema cache")) {
            return "密钥验证 RPC 不存在或尚未刷新，请在 Supabase SQL Editor 执行 verify_site_key 配置 SQL 后重试。";
        }
        if (message.includes("network") || message.includes("fetch")) return "Network request failed.";
        return fallback || error?.message || "Operation failed.";
    };

    const verifySiteKey = async (key) => {
        const value = String(key || "").trim();
        if (!value) return false;
        const supabase = await getClient();
        const { data, error } = await supabase.rpc("verify_site_key", { input_key: value });
        if (error) {
            throw new Error(getErrorMessage(error, "Access key verification failed."));
        }
        return data === true;
    };

    window.ClassRecordSupabase = {
        getConfig,
        getClient,
        getErrorMessage,
        isConfigured,
        verifySiteKey
    };
})();

/************************************************************
 * supabaseClient.js
 * Supabase 客户端统一封装
 ************************************************************/

(() => {
    const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    const DEFAULT_TABLES = {
        profiles: "profiles",
        reactions: "record_reactions",
        comments: "record_comments",
        records: "class_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        quizQuestions: "class_quiz_questions"
    };

    let sdkPromise = null;
    let client = null;

    const loadScript = (src) => new Promise((resolve, reject) => {
        const existing = Array.from(document.scripts).find((script) => script.src === src);
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            if (window.supabase) {
                resolve();
            }
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase SDK 加载失败。"));
        document.head.appendChild(script);
    });

    const ensureSdk = async () => {
        if (window.supabase?.createClient) {
            return window.supabase;
        }
        if (!sdkPromise) {
            sdkPromise = loadScript(SDK_URL).then(() => {
                if (!window.supabase?.createClient) {
                    throw new Error("Supabase SDK 不可用。");
                }
                return window.supabase;
            });
        }
        return sdkPromise;
    };

    const getConfig = () => {
        const config = window.CLASS_RECORD_SUPABASE || {};
        return {
            ...config,
            tables: {
                ...DEFAULT_TABLES,
                ...(config.tables || {})
            },
            storage: {
                privateBucket: "classrecord-private",
                signedUrlExpiresIn: 600,
                ...(config.storage || {})
            },
            useSecureContent: config.useSecureContent !== false
        };
    };

    const isConfigured = () => {
        const config = getConfig();
        return Boolean(/^https:\/\/.+\.supabase\.co\/?$/i.test(String(config.url || "").trim()) && String(config.anonKey || "").trim());
    };

    const getClient = async () => {
        if (client) {
            return client;
        }
        const config = getConfig();
        if (!isConfigured()) {
            throw new Error("Supabase 尚未配置，请先填写 js/supabaseConfig.js。");
        }
        const supabase = await ensureSdk();
        client = supabase.createClient(config.url.trim().replace(/\/$/, ""), config.anonKey.trim(), {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return client;
    };

    const normalizeLogin = (login) => {
        const value = String(login || "").trim();
        if (!value) {
            return "";
        }
        if (value.includes("@")) {
            return value;
        }
        const domain = String(getConfig().accountDomain || "").trim();
        return domain ? `${value}@${domain}` : value;
    };

    const getErrorMessage = (error, fallback) => {
        const message = String(error?.message || "").toLowerCase();
        if (message.includes("invalid login credentials")) {
            return "账号或密码不正确。";
        }
        if (message.includes("email not confirmed")) {
            return "账号尚未确认，请在 Supabase 中确认该用户。";
        }
        if (message.includes("password")) {
            return "密码不符合要求，请至少使用 6 位字符。";
        }
        if (message.includes("jwt") || message.includes("session")) {
            return "登录状态已失效，请重新登录。";
        }
        return fallback || error?.message || "操作失败，请稍后再试。";
    };

    const getSession = async () => {
        const supabase = await getClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            throw error;
        }
        return data.session || null;
    };

    const getUser = async () => {
        const supabase = await getClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            throw error;
        }
        return data.user || null;
    };

    const signIn = async ({ login, password }) => {
        const supabase = await getClient();
        const email = normalizeLogin(login);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            throw new Error(getErrorMessage(error, "登录失败。"));
        }
        return data.session;
    };

    const signOut = async () => {
        const supabase = await getClient();
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
    };

    const updatePassword = async (password) => {
        const supabase = await getClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            throw new Error(getErrorMessage(error, "密码修改失败。"));
        }
    };

    const getProfile = async () => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) {
            return null;
        }
        const table = getConfig().tables.profiles;
        const { data, error } = await supabase
            .from(table)
            .select("id, username, display_name, updated_at")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.warn("读取用户资料失败：", error);
        }

        return {
            id: user.id,
            email: user.email,
            username: data?.username || user.email?.split("@")[0] || "",
            displayName: data?.display_name || data?.username || user.email?.split("@")[0] || "同学"
        };
    };

    const upsertProfile = async ({ username, displayName }) => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) {
            throw new Error("请先登录。");
        }
        const payload = {
            id: user.id,
            username: String(username || user.email?.split("@")[0] || "").trim(),
            display_name: String(displayName || "").trim(),
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase
            .from(getConfig().tables.profiles)
            .upsert(payload, { onConflict: "id" });
        if (error) {
            throw error;
        }
        return payload;
    };

    const onAuthStateChange = async (callback) => {
        const supabase = await getClient();
        return supabase.auth.onAuthStateChange(callback);
    };

    window.ClassRecordSupabase = {
        getConfig,
        getClient,
        getErrorMessage,
        getProfile,
        getSession,
        getUser,
        isConfigured,
        normalizeLogin,
        onAuthStateChange,
        signIn,
        signOut,
        updatePassword,
        upsertProfile
    };
})();

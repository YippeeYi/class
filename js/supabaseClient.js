(function () {
    const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    const DEFAULT_TABLES = {
        profiles: "profiles",
        reactions: "record_reactions",
        comments: "record_comments",
        commentLikes: "record_comment_likes",
        records: "class_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        quizQuestions: "class_quiz_questions",
        correctionRequests: "correction_requests",
        wallMessages: "wall_messages",
        personClaimRequests: "person_claim_requests",
        personEditRequests: "person_edit_requests"
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
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return client;
    };

    const normalizeLogin = (login) => {
        const value = String(login || "").trim();
        if (!value || value.includes("@")) return value;
        const domain = String(getConfig().accountDomain || "").trim();
        return domain ? `${value}@${domain}` : value;
    };

    const getErrorMessage = (error, fallback) => {
        const message = String(error?.message || "").toLowerCase();
        if (message.includes("invalid login credentials")) return "Invalid login credentials.";
        if (message.includes("email not confirmed")) return "Email is not confirmed.";
        if (message.includes("password")) return "Password does not meet requirements.";
        if (message.includes("jwt") || message.includes("session")) return "Session expired.";
        return fallback || error?.message || "Operation failed.";
    };

    const getSession = async () => {
        const supabase = await getClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session || null;
    };

    const getUser = async () => {
        const supabase = await getClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user || null;
    };

    const signIn = async ({ login, password }) => {
        const supabase = await getClient();
        const email = normalizeLogin(login);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(getErrorMessage(error, "Sign in failed."));
        return data.session;
    };

    const signOut = async () => {
        const supabase = await getClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const updatePassword = async (password) => {
        const supabase = await getClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(getErrorMessage(error, "Password update failed."));
    };

    const normalizeArray = (value) => Array.isArray(value) ? value : [];
    const normalizeObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

    const getProfile = async () => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) return null;
        const { data, error } = await supabase
            .from(getConfig().tables.profiles)
            .select("id,user_id,email,username,nickname,display_name,avatar_url,role,coins,owned_backgrounds,active_background,quiz_count,favorite_record_ids,achievement_progress,achievement_hovered_state,updated_at")
            .eq("id", user.id)
            .maybeSingle();
        if (error) console.warn("Profile load failed:", error);
        const username = data?.username || user.email?.split("@")[0] || "";
        const nickname = data?.nickname || data?.display_name || username || "Student";
        return {
            id: user.id,
            userId: data?.user_id || user.id,
            email: data?.email || user.email,
            username,
            nickname,
            displayName: data?.display_name || nickname,
            avatarUrl: data?.avatar_url || "",
            role: data?.role || "user",
            coins: Number(data?.coins) || 0,
            ownedBackgrounds: normalizeArray(data?.owned_backgrounds),
            activeBackground: data?.active_background || "default",
            quizCount: Number(data?.quiz_count) || 0,
            favoriteRecordIds: normalizeArray(data?.favorite_record_ids),
            achievementProgress: normalizeObject(data?.achievement_progress),
            achievementHoveredState: normalizeObject(data?.achievement_hovered_state)
        };
    };

    const upsertProfile = async ({ username, displayName, nickname, avatarUrl } = {}) => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) throw new Error("Sign in first.");
        const name = String(nickname || displayName || username || user.email?.split("@")[0] || "").trim();
        const payload = {
            id: user.id,
            user_id: user.id,
            email: user.email,
            username: String(username || user.email?.split("@")[0] || "").trim(),
            nickname: name,
            display_name: String(displayName || name).trim(),
            avatar_url: String(avatarUrl || "").trim(),
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from(getConfig().tables.profiles).upsert(payload, { onConflict: "id" });
        if (error) throw error;
        return { ...payload, nickname: payload.nickname, displayName: payload.display_name, avatarUrl: payload.avatar_url };
    };

    const updateProfileState = async (patch = {}) => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) return null;
        const allowed = ["coins", "owned_backgrounds", "active_background", "quiz_count", "favorite_record_ids", "achievement_progress", "achievement_hovered_state"];
        const payload = { id: user.id, user_id: user.id, email: user.email, updated_at: new Date().toISOString() };
        allowed.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(patch, key)) payload[key] = patch[key];
        });
        const { data, error } = await supabase.from(getConfig().tables.profiles).upsert(payload, { onConflict: "id" }).select().maybeSingle();
        if (error) throw error;
        return data;
    };

    const isCurrentUserAdmin = async () => {
        const supabase = await getClient();
        const { data, error } = await supabase.rpc("is_admin");
        if (error) {
            console.warn("Admin check failed:", error);
            return false;
        }
        return data === true;
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
        isCurrentUserAdmin,
        normalizeLogin,
        onAuthStateChange,
        signIn,
        signOut,
        updatePassword,
        updateProfileState,
        upsertProfile
    };
})();

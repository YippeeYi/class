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
    const PROFILE_FORM_SELECT = "id,user_id,email,username,nickname,display_name,avatar_url,updated_at";
    const PROFILE_BASIC_SELECT = "id,username,display_name,updated_at";

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
        const fullPayload = {
            id: user.id,
            user_id: user.id,
            email: user.email,
            username: String(username || user.email?.split("@")[0] || "").trim(),
            nickname: name,
            display_name: String(displayName || name).trim(),
            avatar_url: String(avatarUrl || "").trim(),
            updated_at: new Date().toISOString()
        };
        const basicPayload = {
            id: fullPayload.id,
            username: fullPayload.username,
            display_name: fullPayload.display_name,
            updated_at: fullPayload.updated_at
        };
        const table = getConfig().tables.profiles;
        const updateFull = await supabase
            .from(table)
            .update(fullPayload)
            .eq("id", user.id)
            .select(PROFILE_FORM_SELECT)
            .maybeSingle();
        if (!updateFull.error && updateFull.data) {
            return { ...fullPayload, ...updateFull.data, nickname: updateFull.data.nickname || fullPayload.nickname, displayName: updateFull.data.display_name || fullPayload.display_name, avatarUrl: updateFull.data.avatar_url || fullPayload.avatar_url };
        }
        if (updateFull.error) console.warn("Profile full update failed, retrying with basic columns:", updateFull.error);

        const updateBasic = await supabase
            .from(table)
            .update(basicPayload)
            .eq("id", user.id)
            .select(PROFILE_BASIC_SELECT)
            .maybeSingle();
        if (!updateBasic.error && updateBasic.data) {
            return { ...fullPayload, ...updateBasic.data, nickname: fullPayload.nickname, displayName: updateBasic.data.display_name || fullPayload.display_name, avatarUrl: fullPayload.avatar_url };
        }
        if (updateBasic.error) console.warn("Profile basic update failed, inserting profile row:", updateBasic.error);

        const insertFull = await supabase
            .from(table)
            .insert(fullPayload)
            .select(PROFILE_FORM_SELECT)
            .maybeSingle();
        if (!insertFull.error) {
            const data = insertFull.data || fullPayload;
            return { ...fullPayload, ...data, nickname: data.nickname || fullPayload.nickname, displayName: data.display_name || fullPayload.display_name, avatarUrl: data.avatar_url || fullPayload.avatar_url };
        }
        console.warn("Profile full insert failed, retrying with basic columns:", insertFull.error);

        const insertBasic = await supabase
            .from(table)
            .insert(basicPayload)
            .select(PROFILE_BASIC_SELECT)
            .maybeSingle();
        if (insertBasic.error) throw insertBasic.error;
        const data = insertBasic.data || basicPayload;
        return { ...fullPayload, ...data, nickname: fullPayload.nickname, displayName: data.display_name || fullPayload.display_name, avatarUrl: fullPayload.avatar_url };
    };

    const updateProfileState = async (patch = {}) => {
        const supabase = await getClient();
        const user = await getUser();
        if (!user) return null;
        const allowed = ["coins", "owned_backgrounds", "active_background", "quiz_count", "favorite_record_ids", "achievement_progress", "achievement_hovered_state"];
        const payload = { updated_at: new Date().toISOString() };
        allowed.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(patch, key)) payload[key] = patch[key];
        });
        const keys = Object.keys(payload).filter((key) => key !== "updated_at");
        if (!keys.length) return null;
        const { data, error } = await supabase
            .from(getConfig().tables.profiles)
            .update(payload)
            .eq("id", user.id)
            .select(["id", ...keys].join(","))
            .maybeSingle();
        if (error) {
            console.warn("Profile state update failed:", error);
            return null;
        }
        return data || null;
    };

    const isCurrentUserAdmin = async () => {
        const supabase = await getClient();
        const user = await getUser().catch(() => null);
        if (!user) return false;
        const { data, error } = await supabase.rpc("is_admin");
        if (!error && data === true) return true;
        if (error) console.warn("Admin RPC check failed, falling back to profile role:", error);
        const { data: profile, error: profileError } = await supabase
            .from(getConfig().tables.profiles)
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
        if (profileError) {
            console.warn("Admin profile role check failed:", profileError);
            return false;
        }
        return String(profile?.role || "").toLowerCase() === "admin";
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

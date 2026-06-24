/************************************************************
 * userState.js
 * Supabase 账号绑定状态：成就、Q币、已购背景
 ************************************************************/

(() => {
    const TABLE = 'class_user_state';
    const SAVE_DEBOUNCE_MS = 450;
    const pendingSaves = new Map();
    let remoteStatePromise = null;
    let remoteState = null;

    const clone = (value) => JSON.parse(JSON.stringify(value || {}));

    const getUserId = () => window.getCurrentUser?.()?.id || null;

    const getClient = async () => window.ClassRecordSupabase.getClient();

    const emptyState = (userId) => ({
        user_id: userId,
        achievement_state: {},
        qcoin_state: {}
    });

    const ensureRemoteState = async () => {
        if (remoteState) return remoteState;
        if (remoteStatePromise) return remoteStatePromise;
        remoteStatePromise = (async () => {
            const userId = getUserId();
            if (!userId || !window.ClassRecordSupabase?.isConfigured()) return emptyState(userId);
            const client = await getClient();
            const { data, error } = await client
                .from(TABLE)
                .select('user_id,achievement_state,qcoin_state,updated_at')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) throw error;
            remoteState = data || emptyState(userId);
            return remoteState;
        })().catch((error) => {
            console.warn('账号状态加载失败：', error);
            remoteState = emptyState(getUserId());
            return remoteState;
        });
        return remoteStatePromise;
    };

    const savePartNow = async (part, value) => {
        const userId = getUserId();
        if (!userId || !window.ClassRecordSupabase?.isConfigured()) return;
        const client = await getClient();
        const column = part === 'achievement' ? 'achievement_state' : 'qcoin_state';
        const payload = {
            user_id: userId,
            [column]: clone(value),
            updated_at: new Date().toISOString()
        };
        const { error } = await client.from(TABLE).upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
        remoteState = { ...(remoteState || emptyState(userId)), ...payload };
    };

    const savePart = (part, value) => {
        const previous = pendingSaves.get(part);
        if (previous) window.clearTimeout(previous.timer);
        const timer = window.setTimeout(() => {
            pendingSaves.delete(part);
            savePartNow(part, value).catch((error) => console.warn('账号状态保存失败：', error));
        }, SAVE_DEBOUNCE_MS);
        pendingSaves.set(part, { timer, value: clone(value) });
    };

    const flush = async () => {
        const entries = Array.from(pendingSaves.entries());
        pendingSaves.clear();
        await Promise.all(entries.map(([part, item]) => {
            window.clearTimeout(item.timer);
            return savePartNow(part, item.value).catch((error) => console.warn('账号状态保存失败：', error));
        }));
    };

    window.ClassRecordUserState = {
        ready: ensureRemoteState(),
        async getAchievementState() {
            const state = await ensureRemoteState();
            return clone(state.achievement_state);
        },
        async getQcoinState() {
            const state = await ensureRemoteState();
            return clone(state.qcoin_state);
        },
        saveAchievementState(value) {
            savePart('achievement', value);
        },
        saveQcoinState(value) {
            savePart('qcoin', value);
        },
        flush
    };

    window.dispatchEvent(new Event('classRecordUserStateReady'));

    window.addEventListener('pagehide', () => {
        flush().catch(() => {});
    });
})();

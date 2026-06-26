(() => {
    const getClient = async () => window.ClassRecordSupabase.getClient();
    const getTables = () => window.ClassRecordSupabase.getConfig().tables || {};
    const getActorKey = () => window.getClassRecordVisitorKey?.() || "site-key-visitor";

    const insertRow = async (tableName, payload) => {
        const client = await getClient();
        const { error } = await client.from(tableName).insert(payload);
        if (error) throw error;
        return { ok: true };
    };

    const basePayload = () => ({
        actor_key: getActorKey(),
        author_name: "同学",
        user_email: ""
    });

    const submitCorrection = async ({ targetType, targetId, description }) => {
        const body = String(description || "").trim();
        if (!targetType || !targetId || !body) throw new Error("请完整填写纠错对象和说明。");
        return insertRow(getTables().correctionRequests, {
            ...basePayload(),
            target_type: targetType,
            target_id: String(targetId),
            description: body,
            status: "pending"
        });
    };

    const submitWallMessage = async ({ body, anonymous }) => {
        const text = String(body || "").trim();
        if (!text) throw new Error("留言不能为空。");
        return insertRow(getTables().wallMessages, {
            ...basePayload(),
            display_name: anonymous ? "匿名同学" : "同学",
            is_anonymous: Boolean(anonymous),
            body: text,
            status: "pending"
        });
    };

    const submitPersonClaim = async () => {
        throw new Error("人物认领功能已停用。");
    };

    const submitPersonEdit = async () => {
        throw new Error("人物资料编辑审核功能已停用。");
    };

    const listMyRequests = async () => ({
        corrections: [],
        wallMessages: [],
        personClaims: [],
        personEdits: []
    });

    const listApprovedWallMessages = async () => {
        const client = await getClient();
        const { data, error } = await client
            .from(getTables().wallMessages)
            .select("id,display_name,is_anonymous,body,reviewed_at,created_at")
            .eq("status", "approved")
            .order("reviewed_at", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const listAdminQueues = async () => {
        throw new Error("管理员审核入口已停用。");
    };

    const reviewRequest = async () => {
        throw new Error("管理员审核入口已停用。");
    };

    window.ReviewSystem = {
        isAdmin: async () => false,
        listAdminQueues,
        listApprovedWallMessages,
        listMyRequests,
        reviewRequest,
        submitCorrection,
        submitPersonClaim,
        submitPersonEdit,
        submitWallMessage
    };
})();

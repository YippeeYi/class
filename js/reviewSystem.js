(() => {
    const getClient = async () => window.ClassRecordSupabase.getClient();
    const getTables = () => window.ClassRecordSupabase.getConfig().tables || {};
    const nowIso = () => new Date().toISOString();

    const requireUser = async () => {
        const user = await window.ClassRecordSupabase.getUser();
        if (!user) throw new Error('请先登录。');
        return user;
    };

    const getProfile = async () => window.ClassRecordSupabase.getProfile();

    const isAdmin = async () => {
        const profile = await getProfile().catch(() => null);
        return profile?.role === 'admin';
    };

    const insertRow = async (tableName, payload) => {
        const client = await getClient();
        const { data, error } = await client.from(tableName).insert(payload).select('*').single();
        if (error) throw error;
        await applyApprovedRequest({ tableKey, row: data, reviewerId: reviewer.id });
        return data;
    };

    const submitCorrection = async ({ targetType, targetId, description }) => {
        const user = await requireUser();
        const profile = await getProfile().catch(() => null);
        const body = String(description || '').trim();
        if (!targetType || !targetId || !body) throw new Error('请完整填写纠错对象和说明。');
        return insertRow(getTables().correctionRequests, {
            user_id: user.id,
            user_email: user.email || profile?.email || '',
            author_name: profile?.displayName || profile?.nickname || profile?.username || '同学',
            target_type: targetType,
            target_id: String(targetId),
            description: body,
            status: 'pending'
        });
    };

    const submitWallMessage = async ({ body, anonymous }) => {
        const user = await requireUser();
        const profile = await getProfile().catch(() => null);
        const text = String(body || '').trim();
        if (!text) throw new Error('留言不能为空。');
        return insertRow(getTables().wallMessages, {
            user_id: user.id,
            user_email: user.email || profile?.email || '',
            author_name: profile?.displayName || profile?.nickname || profile?.username || '同学',
            display_name: anonymous ? '匿名同学' : (profile?.displayName || profile?.nickname || profile?.username || '同学'),
            is_anonymous: Boolean(anonymous),
            body: text,
            status: 'pending'
        });
    };

    const submitPersonClaim = async ({ personId, note }) => {
        const user = await requireUser();
        const profile = await getProfile().catch(() => null);
        if (!personId) throw new Error('缺少人物 ID。');
        return insertRow(getTables().personClaimRequests, {
            user_id: user.id,
            user_email: user.email || profile?.email || '',
            author_name: profile?.displayName || profile?.nickname || profile?.username || '同学',
            person_id: String(personId),
            note: String(note || '').trim(),
            status: 'pending'
        });
    };

    const submitPersonEdit = async ({ personId, displayName, alias, bio }) => {
        const user = await requireUser();
        const profile = await getProfile().catch(() => null);
        if (!personId) throw new Error('缺少人物 ID。');
        return insertRow(getTables().personEditRequests, {
            user_id: user.id,
            user_email: user.email || profile?.email || '',
            author_name: profile?.displayName || profile?.nickname || profile?.username || '同学',
            person_id: String(personId),
            requested_display_name: String(displayName || '').trim(),
            requested_alias: String(alias || '').trim(),
            requested_bio: String(bio || '').trim(),
            status: 'pending'
        });
    };

    const listMyRequests = async ({ personId } = {}) => {
        const user = await requireUser();
        const client = await getClient();
        const tables = getTables();
        const queries = [
            client.from(tables.correctionRequests).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            client.from(tables.wallMessages).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            client.from(tables.personClaimRequests).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            client.from(tables.personEditRequests).select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ];
        const [corrections, wall, claims, edits] = await Promise.all(queries);
        [corrections, wall, claims, edits].forEach((result) => { if (result.error) throw result.error; });
        const filterPerson = (rows) => personId ? (rows || []).filter((row) => row.person_id === personId) : (rows || []);
        return {
            corrections: corrections.data || [],
            wallMessages: wall.data || [],
            personClaims: filterPerson(claims.data),
            personEdits: filterPerson(edits.data)
        };
    };

    const listApprovedWallMessages = async () => {
        const client = await getClient();
        const { data, error } = await client
            .from(getTables().wallMessages)
            .select('id,display_name,is_anonymous,body,reviewed_at,created_at')
            .eq('status', 'approved')
            .order('reviewed_at', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const listAdminQueues = async () => {
        if (!await isAdmin()) throw new Error('需要管理员权限。');
        const client = await getClient();
        const tables = getTables();
        const select = '*';
        const queries = [
            client.from(tables.correctionRequests).select(select).order('created_at', { ascending: false }),
            client.from(tables.wallMessages).select(select).order('created_at', { ascending: false }),
            client.from(tables.personClaimRequests).select(select).order('created_at', { ascending: false }),
            client.from(tables.personEditRequests).select(select).order('created_at', { ascending: false })
        ];
        const [corrections, wall, claims, edits] = await Promise.all(queries);
        [corrections, wall, claims, edits].forEach((result) => { if (result.error) throw result.error; });
        return {
            correction_requests: corrections.data || [],
            wall_messages: wall.data || [],
            person_claim_requests: claims.data || [],
            person_edit_requests: edits.data || []
        };
    };


    const applyApprovedRequest = async ({ tableKey, row, reviewerId }) => {
        if (row.status !== 'approved') return;
        const client = await getClient();
        const peopleTable = getTables().people || 'class_people';
        if (tableKey === 'personClaimRequests') {
            const { error } = await client
                .from(peopleTable)
                .update({ claimed_by: row.user_id, claimed_at: nowIso() })
                .eq('id', row.person_id)
                .is('claimed_by', null);
            if (error) throw error;
        }
        if (tableKey === 'personEditRequests') {
            const aliasList = String(row.requested_alias || '')
                .split(/[,]/)
                .map((item) => item.trim())
                .filter(Boolean);
            const payload = {
                display_name: String(row.requested_display_name || '').trim(),
                alias: aliasList.join(', '),
                aliases: aliasList,
                bio: String(row.requested_bio || '').trim(),
                updated_at: nowIso()
            };
            const { error } = await client
                .from(peopleTable)
                .update(payload)
                .eq('id', row.person_id);
            if (error) throw error;
        }
    };

    const reviewRequest = async ({ tableKey, id, status, note }) => {
        if (!['approved', 'rejected'].includes(status)) throw new Error('审核状态无效。');
        if (!await isAdmin()) throw new Error('需要管理员权限。');
        const reviewer = await requireUser();
        const client = await getClient();
        const tableName = getTables()[tableKey] || tableKey;
        const { data, error } = await client
            .from(tableName)
            .update({
                status,
                review_note: String(note || '').trim(),
                reviewed_by: reviewer.id,
                reviewed_at: nowIso()
            })
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        await applyApprovedRequest({ tableKey, row: data, reviewerId: reviewer.id });
        return data;
    };

    window.ReviewSystem = {
        getProfile,
        isAdmin,
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

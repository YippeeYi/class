(() => {
    const status = document.getElementById('admin-status');
    const panels = document.getElementById('admin-panels');
    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const cfg = () => window.ClassRecordSupabase.getConfig();
    const table = (key, fallback) => cfg().tables[key] || fallback;
    const sections = [
        { key: 'corrections', title: '纠错申请', table: () => table('corrections', 'correction_reports'), fields: 'id,target_type,target_id,description,status,created_at' },
        { key: 'wall', title: '留言墙投稿', table: () => table('wallMessages', 'wall_messages'), fields: 'id,body,is_anonymous,public_name,status,created_at' },
        { key: 'claims', title: '人物认领申请', table: () => table('personClaims', 'person_claim_requests'), fields: 'id,person_id,status,created_at' },
        { key: 'edits', title: '人物资料编辑申请', table: () => table('personEdits', 'person_edit_requests'), fields: 'id,person_id,display_name,alias,bio,status,created_at' }
    ];

    const isAdmin = async () => {
        const client = await window.ClassRecordSupabase.getClient();
        const userId = window.getCurrentUser?.()?.id;
        const { data, error } = await client.from(table('admins', 'admin_users')).select('user_id').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return Boolean(data);
    };

    const renderRow = (section, item) => {
        const details = Object.entries(item).filter(([key]) => !['id', 'status'].includes(key)).map(([key, value]) => `<p><strong>${escapeHtml(key)}</strong>: ${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</p>`).join('');
        return `<article class="admin-review-item" data-table="${section.table()}" data-id="${escapeHtml(item.id)}">${details}<div><button class="btn-action" data-review="approved">通过</button><button class="btn-action" data-review="rejected">驳回</button></div></article>`;
    };

    const loadSection = async (client, section) => {
        const { data, error } = await client.from(section.table()).select(section.fields).eq('status', 'pending').order('created_at', { ascending: true });
        if (error) throw error;
        return `<section class="admin-review-section"><h2>${section.title}</h2>${(data || []).length ? data.map((item) => renderRow(section, item)).join('') : '<div class="record-empty"><strong>暂无待审核内容。</strong></div>'}</section>`;
    };

    const loadAll = async () => {
        const client = await window.ClassRecordSupabase.getClient();
        const html = await Promise.all(sections.map((section) => loadSection(client, section).catch((error) => `<section class="admin-review-section"><h2>${section.title}</h2><div class="record-empty"><strong>加载失败。</strong><span>${escapeHtml(error.message)}</span></div></section>`)));
        panels.innerHTML = html.join('');
    };

    panels?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-review]');
        if (!button) return;
        const item = button.closest('.admin-review-item');
        const client = await window.ClassRecordSupabase.getClient();
        const payload = { status: button.dataset.review, reviewed_by: window.getCurrentUser?.()?.id, reviewed_at: new Date().toISOString() };
        button.disabled = true;
        const { error } = await client.from(item.dataset.table).update(payload).eq('id', item.dataset.id);
        if (error) {
            status.textContent = error.message;
            button.disabled = false;
            return;
        }
        await loadAll();
    });

    window.waitForAccess?.().then(async () => {
        try {
            if (!await isAdmin()) {
                status.textContent = '无权限访问管理员后台。';
                panels.innerHTML = '';
                return;
            }
            status.textContent = '管理员权限已确认。';
            await loadAll();
        } catch (error) {
            status.textContent = error?.message || '权限验证失败。';
        }
    });
})();
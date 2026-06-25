(() => {
    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const table = () => window.ClassRecordSupabase.getConfig().tables.wallMessages || 'wall_messages';
    const list = document.getElementById('wall-list');
    const form = document.getElementById('wall-form');
    const status = document.getElementById('wall-status');

    const loadMessages = async () => {
        try {
            const client = await window.ClassRecordSupabase.getClient();
            const { data, error } = await client.from(table()).select('id,body,is_anonymous,public_name,created_at').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(100);
            if (error) throw error;
            list.innerHTML = (data || []).length ? data.map((item) => `<article class="wall-message"><p>${escapeHtml(item.body)}</p><span>${escapeHtml(item.is_anonymous ? '匿名同学' : (item.public_name || '同学'))}</span></article>`).join('') : '<div class="record-empty"><strong>还没有已审核留言。</strong></div>';
        } catch (error) {
            list.innerHTML = '<div class="record-empty"><strong>留言加载失败。</strong></div>';
        }
    };

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = form.body.value.trim();
        if (!body) return;
        form.querySelectorAll('button, textarea, input').forEach((el) => { el.disabled = true; });
        try {
            const client = await window.ClassRecordSupabase.getClient();
            const profile = await window.ClassRecordSupabase.getProfile().catch(() => null);
            const { error } = await client.from(table()).insert({
                user_id: window.getCurrentUser?.()?.id,
                body,
                is_anonymous: Boolean(form.anonymous.checked),
                public_name: form.anonymous.checked ? null : (profile?.displayName || profile?.username || '同学'),
                status: 'pending'
            });
            if (error) throw error;
            form.reset();
            status.textContent = '已提交，等待管理员审核。';
            status.dataset.tone = 'success';
        } catch (error) {
            status.textContent = error?.message || '提交失败，请稍后再试。';
            status.dataset.tone = 'error';
        } finally {
            form.querySelectorAll('button, textarea, input').forEach((el) => { el.disabled = false; });
        }
    });

    window.waitForAccess?.().then(loadMessages);
})();
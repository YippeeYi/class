(() => {
    const form = document.getElementById('wall-form');
    const list = document.getElementById('wall-list');
    const status = document.getElementById('wall-status');
    const summary = document.getElementById('wall-summary');

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatTime = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    async function loadMessages() {
        try {
            const rows = await window.ReviewSystem.listApprovedWallMessages();
            if (summary) summary.textContent = `已展示 ${rows.length} 条审核通过的留言。`;
            list.innerHTML = rows.length ? rows.map((row) => `
                <article class="wall-message">
                    <p>${escapeHtml(row.body)}</p>
                    <footer><strong>${escapeHtml(row.display_name || '匿名同学')}</strong><span>${escapeHtml(formatTime(row.reviewed_at || row.created_at))}</span></footer>
                </article>
            `).join('') : '<div class="record-empty"><strong>还没有留言。</strong><span>第一条通过审核的留言会显示在这里。</span></div>';
        } catch (error) {
            list.innerHTML = '<div class="record-empty"><strong>留言加载失败。</strong><span>请稍后刷新重试。</span></div>';
        }
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = '';
        form.querySelectorAll('textarea, input, button').forEach((item) => { item.disabled = true; });
        try {
            await window.ReviewSystem.submitWallMessage({ body: form.body.value, anonymous: form.anonymous.checked });
            form.reset();
            status.textContent = '已提交，等待管理员审核。';
            status.dataset.tone = 'success';
        } catch (error) {
            status.textContent = error?.message || '提交失败。';
            status.dataset.tone = 'error';
        } finally {
            form.querySelectorAll('textarea, input, button').forEach((item) => { item.disabled = false; });
        }
    });

    (window.cacheReadyPromise || Promise.resolve()).then(loadMessages);
})();

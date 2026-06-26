(() => {
    const queuesEl = document.getElementById('admin-queues');
    const summary = document.getElementById('admin-summary');
    const tableLabels = {
        correctionRequests: '纠错提交',
        wallMessages: '留言墙',
        personClaimRequests: '人物认领',
        personEditRequests: '人物编辑'
    };
    const tableKeys = {
        correction_requests: 'correctionRequests',
        wall_messages: 'wallMessages',
        person_claim_requests: 'personClaimRequests',
        person_edit_requests: 'personEditRequests'
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const describeRow = (table, row) => {
        if (table === 'correction_requests') return `${row.target_type || ''} / ${row.target_id || ''}\n${row.description || ''}`;
        if (table === 'wall_messages') return `${row.display_name || row.author_name || ''}\n${row.body || ''}`;
        if (table === 'person_claim_requests') return `${row.person_id || ''}\n${row.note || ''}`;
        if (table === 'person_edit_requests') return `${row.person_id || ''}\n显示名：${row.requested_display_name || ''}\n别名：${row.requested_alias || ''}\n简介：${row.requested_bio || ''}\n头像：${row.requested_avatar_url || ''}`;
        return JSON.stringify(row, null, 2);
    };

    const applicantLabel = (row) => {
        const email = row.user_email || row.email || '';
        const name = row.author_name || row.nickname || '';
        if (email && name && email !== name) return `${email} / ${name}`;
        return email || name || '';
    };

    const enrichApplicantEmails = async (queues) => {
        const rows = Object.values(queues).flat();
        const ids = [...new Set(rows.filter((row) => row.user_id && !row.user_email).map((row) => row.user_id))];
        if (!ids.length) return queues;
        try {
            const client = await window.ClassRecordSupabase.getClient();
            const table = window.ClassRecordSupabase.getConfig().tables.profiles || 'profiles';
            const { data, error } = await client.from(table).select('id,email,nickname,display_name,username').in('id', ids);
            if (error) throw error;
            const profiles = new Map((data || []).map((profile) => [profile.id, profile]));
            rows.forEach((row) => {
                const profile = profiles.get(row.user_id);
                if (!profile) return;
                row.user_email = row.user_email || profile.email || '';
                row.author_name = row.author_name || profile.display_name || profile.nickname || profile.username || '';
            });
        } catch (error) {
            console.warn('Admin profile email enrichment failed:', error);
        }
        return queues;
    };

    const render = (queues) => {
        const entries = Object.entries(queues);
        const pendingCount = entries.reduce((sum, [, rows]) => sum + rows.filter((row) => row.status === 'pending').length, 0);
        if (summary) summary.textContent = `待审核 ${pendingCount} 条。`;
        queuesEl.innerHTML = entries.map(([table, rows]) => {
            const tableKey = tableKeys[table];
            const pending = rows.filter((row) => row.status === 'pending');
            return `
                <section class="admin-queue">
                    <h2>${escapeHtml(tableLabels[tableKey] || table)} <span>${pending.length}</span></h2>
                    ${pending.length ? pending.map((row) => `
                        <article class="admin-review-card" data-table-key="${escapeHtml(tableKey)}" data-id="${escapeHtml(row.id)}">
                            <pre>${escapeHtml(describeRow(table, row))}</pre>
                            <p>${escapeHtml(applicantLabel(row))}</p>
                            <textarea name="note" rows="2" placeholder="审核备注（可选）"></textarea>
                            <div>
                                <button type="button" class="btn-action" data-status="approved">通过</button>
                                <button type="button" class="btn-action" data-status="rejected">驳回</button>
                            </div>
                        </article>
                    `).join('') : '<div class="record-empty"><strong>暂无待审核内容。</strong></div>'}
                </section>
            `;
        }).join('');
    };

    async function loadQueues() {
        try {
            if (!await window.ReviewSystem.isAdmin()) {
                queuesEl.innerHTML = '<div class="record-empty"><strong>需要管理员权限。</strong><span>请使用管理员账号登录。</span></div>';
                if (summary) summary.textContent = '无权限';
                return;
            }
            render(await enrichApplicantEmails(await window.ReviewSystem.listAdminQueues()));
        } catch (error) {
            queuesEl.innerHTML = `<div class="record-empty"><strong>审核队列加载失败。</strong><span>${escapeHtml(error?.message || '')}</span></div>`;
        }
    }

    queuesEl?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-status]');
        if (!button) return;
        const card = button.closest('.admin-review-card');
        if (!card) return;
        button.disabled = true;
        try {
            await window.ReviewSystem.reviewRequest({
                tableKey: card.dataset.tableKey,
                id: card.dataset.id,
                status: button.dataset.status,
                note: card.querySelector('textarea')?.value || ''
            });
            await loadQueues();
        } catch (error) {
            alert(error?.message || '审核失败。');
            button.disabled = false;
        }
    });

    (window.cacheReadyPromise || Promise.resolve()).then(loadQueues);
})();

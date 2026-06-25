/************************************************************
 * correction.js
 * 全站纠错申请入口，提交后进入管理员审核。
 ************************************************************/

(() => {
    if (document.body.classList.contains('guide-page') || document.body.classList.contains('auth-page')) return;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const ensureButton = () => {
        const host = document.querySelector('.page-header') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'page-header' }));
        if (host.querySelector('[data-correction-open]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-action correction-open-btn';
        button.dataset.correctionOpen = 'true';
        button.textContent = '📝';
        button.title = '提交纠错';
        button.setAttribute('aria-label', '提交纠错');
        button.addEventListener('click', openModal);
        host.appendChild(button);
    };

    const loadTargets = async (type) => {
        if (type === 'record') {
            const records = await window.loadAllRecords?.() || [];
            return records.map((record) => ({ id: record.fileName || record.id, label: `${record.id || record.fileName} ${record.date || ''}`.trim() }));
        }
        if (type === 'person') {
            const people = await window.loadAllPeople?.() || [];
            return people.map((person) => ({ id: person.id, label: person.id }));
        }
        const terms = await window.loadAllGlossary?.() || [];
        return terms.map((term) => ({ id: term.id, label: term.label || term.term || term.id }));
    };

    const submitReport = async (payload) => {
        const client = await window.ClassRecordSupabase.getClient();
        const user = window.getCurrentUser?.();
        const table = window.ClassRecordSupabase.getConfig().tables.corrections || 'correction_reports';
        const { error } = await client.from(table).insert({
            user_id: user?.id,
            target_type: payload.type,
            target_id: payload.targetId,
            description: payload.description,
            status: 'pending'
        });
        if (error) throw error;
    };

    const openModal = async () => {
        document.querySelector('.correction-modal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'correction-modal';
        modal.innerHTML = `
            <section class="correction-card" role="dialog" aria-modal="true" aria-label="提交纠错">
                <header><h2>提交纠错</h2><button type="button" class="btn-action" data-close>✕</button></header>
                <form>
                    <label><span>类型</span><select name="type"><option value="record">记录</option><option value="person">人物</option><option value="term">术语</option></select></label>
                    <label><span>对象</span><select name="targetId" required><option value="">加载中...</option></select></label>
                    <label><span>说明</span><textarea name="description" maxlength="1000" rows="5" required placeholder="请描述具体错误和建议修改方式"></textarea></label>
                    <button type="submit" class="btn-action">提交审核</button>
                    <p class="correction-status" aria-live="polite"></p>
                </form>
            </section>`;
        document.body.appendChild(modal);
        const form = modal.querySelector('form');
        const typeSelect = form.type;
        const targetSelect = form.targetId;
        const status = modal.querySelector('.correction-status');
        const refreshTargets = async () => {
            targetSelect.innerHTML = '<option value="">加载中...</option>';
            try {
                const targets = await loadTargets(typeSelect.value);
                targetSelect.innerHTML = targets.length
                    ? '<option value="">请选择</option>' + targets.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')
                    : '<option value="">暂无可选对象</option>';
            } catch (error) {
                targetSelect.innerHTML = '<option value="">加载失败</option>';
            }
        };
        typeSelect.addEventListener('change', refreshTargets);
        modal.querySelector('[data-close]').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const description = form.description.value.trim();
            if (!typeSelect.value || !targetSelect.value || !description) {
                status.textContent = '请完整填写纠错信息。';
                status.dataset.tone = 'error';
                return;
            }
            form.querySelectorAll('button, select, textarea').forEach((el) => { el.disabled = true; });
            try {
                await submitReport({ type: typeSelect.value, targetId: targetSelect.value, description });
                status.textContent = '已提交，等待管理员审核。';
                status.dataset.tone = 'success';
                window.setTimeout(() => modal.remove(), 900);
            } catch (error) {
                status.textContent = error?.message || '提交失败，请稍后再试。';
                status.dataset.tone = 'error';
                form.querySelectorAll('button, select, textarea').forEach((el) => { el.disabled = false; });
            }
        });
        await refreshTargets();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButton, { once: true });
    else ensureButton();
})();
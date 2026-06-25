(() => {
    if (document.body.classList.contains('auth-page')) return;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let modal = null;
    let targets = { record: [], person: [], term: [] };

    const getHost = () => document.querySelector('.page-header') || document.querySelector('.top-right-actions');

    const ensureButton = () => {
        const host = getHost();
        if (!host || document.querySelector('.correction-open-btn')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-action correction-open-btn';
        button.textContent = '纠错';
        button.addEventListener('click', openModal);
        host.appendChild(button);
    };

    const loadTargets = async () => {
        if (targets.record.length || targets.person.length || targets.term.length) return targets;
        const [records, people, glossary] = await Promise.all([
            window.loadAllRecords?.() || [],
            window.loadAllPeople?.() || [],
            window.loadAllGlossary?.() || []
        ]);
        targets = {
            record: records.map((record) => ({ id: record.fileName || record.id, label: `#${record.id} ${record.date || ''}`.trim() })),
            person: people.map((person) => ({ id: person.id, label: `${person.id} ${window.stripRecordMarkup?.(person.alias || '') || ''}`.trim() })),
            term: glossary.map((term) => ({ id: term.id, label: `${term.id} ${window.stripRecordMarkup?.(term.term || term.label || '') || ''}`.trim() }))
        };
        return targets;
    };

    const renderTargetOptions = (type) => {
        const list = targets[type] || [];
        return list.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label || item.id)}</option>`).join('');
    };

    async function openModal() {
        if (!window.ReviewSystem) return;
        await loadTargets().catch((error) => console.warn('纠错目标加载失败：', error));
        closeModal();
        modal = document.createElement('div');
        modal.className = 'review-modal-backdrop';
        modal.innerHTML = `
            <section class="review-modal" role="dialog" aria-modal="true" aria-label="提交纠错">
                <header>
                    <h2>提交纠错</h2>
                    <button type="button" class="review-modal-close" aria-label="关闭">×</button>
                </header>
                <form class="correction-form">
                    <label>
                        <span>对象类型</span>
                        <select name="targetType">
                            <option value="record">记录</option>
                            <option value="person">人物</option>
                            <option value="term">术语</option>
                        </select>
                    </label>
                    <label>
                        <span>具体对象</span>
                        <select name="targetId">${renderTargetOptions('record')}</select>
                    </label>
                    <label>
                        <span>错误说明</span>
                        <textarea name="description" maxlength="1000" rows="5" required placeholder="请写清楚哪里有误，以及建议如何修改。"></textarea>
                    </label>
                    <div class="review-modal-actions">
                        <button type="button" class="btn-action review-modal-cancel">取消</button>
                        <button type="submit" class="btn-action">提交审核</button>
                    </div>
                    <p class="review-modal-status" aria-live="polite"></p>
                </form>
            </section>
        `;
        document.body.appendChild(modal);
        const form = modal.querySelector('.correction-form');
        form.targetType.addEventListener('change', () => {
            form.targetId.innerHTML = renderTargetOptions(form.targetType.value);
        });
        modal.querySelector('.review-modal-close')?.addEventListener('click', closeModal);
        modal.querySelector('.review-modal-cancel')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
        form.addEventListener('submit', submitCorrection);
    }

    function closeModal() {
        modal?.remove();
        modal = null;
    }

    async function submitCorrection(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const status = form.querySelector('.review-modal-status');
        form.querySelectorAll('input, select, textarea, button').forEach((item) => { item.disabled = true; });
        try {
            await window.ReviewSystem.submitCorrection({
                targetType: form.targetType.value,
                targetId: form.targetId.value,
                description: form.description.value
            });
            status.textContent = '已提交，等待管理员审核。';
            status.dataset.tone = 'success';
            form.reset();
            window.setTimeout(closeModal, 900);
        } catch (error) {
            status.textContent = error?.message || '提交失败，请稍后重试。';
            status.dataset.tone = 'error';
        } finally {
            form.querySelectorAll('input, select, textarea, button').forEach((item) => { item.disabled = false; });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureButton, { once: true });
    } else {
        ensureButton();
    }
})();

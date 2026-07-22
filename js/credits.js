(() => {
    const root = document.getElementById('credits-content');
    if (!root) return;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderContent = (value) => {
        const text = String(value || '');
        if (typeof window.parseContent === 'function') return window.parseContent(text);
        if (typeof parseContent === 'function') return parseContent(text);
        return escapeHtml(text);
    };

    const renderStatus = (title, detail = '') => {
        root.innerHTML = `
            <div class="credits-status" role="status">
                <strong>${escapeHtml(title)}</strong>
                ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
            </div>
        `;
    };

    const renderLoading = (title) => {
        root.innerHTML = `<div class="page-loading" role="status"><strong>${escapeHtml(title)}</strong></div>`;
    };

    const renderTextItems = (items, tagName = 'p') => {
        return (items || [])
            .map((item) => `<${tagName}>${renderContent(item)}</${tagName}>`)
            .join('');
    };

    const renderSections = (sections) => {
        return (sections || []).map((section) => `
            <article class="credits-card">
                ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
                ${section.members?.length ? `<ul>${renderTextItems(section.members, 'li')}</ul>` : ''}
            </article>
        `).join('');
    };

    const renderOriginalImages = (items) => {
        if (!items?.length) return '';
        return `
            <article class="credits-card credits-card--original-images">
                <h2>附件</h2>
                <div class="credits-original-list">
                    ${items.map((item) => `
                        <section class="credits-original-item">
                            ${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ''}
                            ${item.content ? `<p>${renderContent(item.content)}</p>` : ''}
                        </section>
                    `).join('')}
                </div>
            </article>
        `;
    };

    const renderCredits = (page) => {
        const sections = page?.sections || [];
        const thanks = page?.thanks || [];
        const originalImages = page?.originalImages || [];
        if (!sections.length && !thanks.length && !originalImages.length) {
            renderStatus('暂无可展示内容', '请检查 Supabase 中的制作组与致谢页面数据。');
            return;
        }

        const title = String(page?.title || '').trim();
        if (title) {
            document.title = title;
            const heading = document.querySelector('.credits-head h1');
            if (heading) heading.textContent = title;
        }

        root.innerHTML = `
            <div class="credits-grid">
                ${renderSections(sections)}
                ${thanks.length ? `
                    <article class="credits-card credits-card--thanks">
                        <h2>致谢</h2>
                        ${renderTextItems(thanks)}
                    </article>
                ` : ''}
                ${renderOriginalImages(originalImages)}
            </div>
        `;
    };

    const loadCredits = async () => {
        renderLoading('正在加载制作组与致谢内容...');
        try {
            await window.waitForAccess?.();
            if (!window.ClassRecordData?.isEnabled?.() || typeof window.ClassRecordData.loadCreditsPage !== 'function') {
                throw new Error('Supabase credits page loader is unavailable.');
            }
            if (typeof window.loadAllPeople === 'function') {
                await window.loadAllPeople().catch((error) => {
                    window.ClassRecordDiagnostics?.warn('Credits people data load failed', error);
                });
            }
            const page = await window.ClassRecordData.loadCreditsPage();
            renderCredits(page);
        } catch (error) {
            window.ClassRecordDiagnostics?.warn('Credits page load failed', error);
            renderStatus('制作组与致谢内容加载失败', '请稍后重试，或检查访问权限与 Supabase 配置。');
        }
    };

    loadCredits();
})();

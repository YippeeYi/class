(() => {
    const CREDITS = {
        groups: [
            { title: '书面记录', members: ['总主编：[[shr吞噬细胞]]，[[zzk|Johnson]]', '主编：qyc,sjy,', '功能实现', '测试验收'] },
            { title: '网站制作', members: ['制作：CRAFT', '内容编写：CRAFT'] }
        ],
        thanks: [
            '感谢所有提供记录、图片、人物资料和术语解释的同学。',
            '感谢参与测试、反馈问题并持续维护资料准确性的同学。',
            '具体姓名可后续在本配置中集中补充维护。'
        ]
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderContent = (value) => {
        const text = String(value || '');

        if (typeof window.parseContent === 'function') {
            return window.parseContent(text);
        }

        if (typeof parseContent === 'function') {
            return parseContent(text);
        }

        return escapeHtml(text);
    };

    const root = document.getElementById('credits-content');
    if (!root) return;

    root.innerHTML = `
        <div class="credits-grid">
            ${CREDITS.groups.map((group) => `
                <article class="credits-card">
                    <h2>${escapeHtml(group.title)}</h2>
                    <ul>${group.members.map((member) => `<li>${renderContent(member)}</li>`).join('')}</ul>
                </article>
            `).join('')}
            <article class="credits-card credits-card--thanks">
                <h2>致谢</h2>
                ${CREDITS.thanks.map((item) => `<p>${renderContent(item)}</p>`).join('')}
            </article>
        </div>
    `;
})();
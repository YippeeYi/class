(() => {
    const CREDITS = {
        groups: [
            { title: '书面记录', members: ['总主编：[[shr|吞噬细胞]],[[zzk|Johnson]]', '主编：[[qyc|qyc]],[[sjy|冰球王子]],[[zlpa|四字]],[[ljy|栗笋]],[[wy|wy]],[[hxw|氦星人]],[[dfy|CRAFT]],[[sry|孔亚峰主人（狗💩）]]', '吉祥物：[[lxc|lxc（刘乐乐）]]'] },
            { title: '网站制作', members: ['制作：[[dfy|CRAFT]]', '内容编写：[[dfy|CRAFT]],[[zzk|Johnson]]'] }
        ],
        thanks: [
            '感谢[[shr|吞噬细胞]],[[zzk|Johnson]]对史实校准的大力支持。',
            '感谢每一位为编日史制作提供帮助的同学。'
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
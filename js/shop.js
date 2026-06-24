(() => {
    const itemsWrap = document.getElementById('shop-items');
    const summary = document.getElementById('shop-summary');
    if (!itemsWrap || !window.QcoinState) return;

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function stripHtml(text) {
        const wrap = document.createElement('div');
        wrap.innerHTML = String(text || '');
        return wrap.textContent || wrap.innerText || '';
    }

    function getItems() {
        if (window.BackgroundState?.options?.length) {
            return window.BackgroundState.options;
        }
        return (window.QcoinState.shopItems || []).map((item) => ({
            ...item,
            meta: item.title,
            owned: window.QcoinState.ownsBackground(item.id),
            active: item.id === 'default'
        }));
    }

    function getItemTitle(item) {
        const meta = stripHtml(item.meta || item.title || '');
        const label = stripHtml(item.label || item.id);
        return meta && meta !== label ? `${label} · ${meta}` : label;
    }

    function renderSummary(items) {
        if (!summary) return;
        const ownedCount = items.filter((item) => item.owned || window.QcoinState.ownsBackground(item.id)).length;
        const active = items.find((item) => item.active || item.id === window.BackgroundState?.currentId);
        summary.textContent = `已拥有背景 ${ownedCount} / ${items.length}；当前使用 ${active ? getItemTitle(active) : '默认'}。`;
    }

    function renderItems() {
        const items = getItems();
        const balance = Number(window.QcoinState.getBalance()) || 0;
        renderSummary(items);

        if (!items.length) {
            itemsWrap.innerHTML = '<div class="record-empty"><strong>暂无可购买背景。</strong><span>请确认背景配置已加载后刷新页面。</span></div>';
            return;
        }

        itemsWrap.innerHTML = items.map((item) => {
            const owned = item.owned || window.QcoinState.ownsBackground(item.id);
            const active = item.active || item.id === window.BackgroundState?.currentId;
            const cost = Number(item.cost) || 0;
            const affordable = balance >= cost;
            const title = getItemTitle(item);
            const actionText = active ? '使用中' : owned ? '使用背景' : affordable ? '购买背景' : '余额不足';
            const actionAttr = owned ? `data-shop-use="${escapeHtml(item.id)}"` : `data-shop-buy="${escapeHtml(item.id)}"`;
            const disabled = active || (!owned && !affordable);

            return `
                <article class="shop-card shop-background-card${owned ? ' is-owned' : ''}${active ? ' is-active' : ''}" style="--shop-preview:${item.preview || 'var(--control-gradient)'}">
                    <span class="shop-background-preview" aria-hidden="true"></span>
                    <div class="shop-card-head">
                        <span class="shop-item-type">${escapeHtml(item.category)}背景</span>
                        <strong>${escapeHtml(title)}</strong>
                    </div>
                    <div class="shop-card-foot">
                        <span class="shop-price">${owned ? '已拥有' : `${cost} Q币`}</span>
                        <button type="button" class="btn-action shop-buy-btn" ${actionAttr} ${disabled ? 'disabled' : ''}>
                            ${actionText}
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function render() {
        renderItems();
    }

    itemsWrap.addEventListener('click', (event) => {
        const buyButton = event.target.closest('[data-shop-buy]');
        const useButton = event.target.closest('[data-shop-use]');
        if (!buyButton && !useButton) return;

        const backgroundId = (buyButton || useButton).dataset.shopBuy || (buyButton || useButton).dataset.shopUse;
        if (buyButton && !window.QcoinState.purchaseBackground(backgroundId)) {
            render();
            return;
        }
        const applied = window.BackgroundState?.apply(backgroundId);
        window.showAppToast?.('背景已切换。', 'success');
        render();
        applied?.themeReady?.then(render).catch(() => render());
    });

    itemsWrap.addEventListener('pointerover', (event) => {
        const card = event.target.closest('.shop-background-card');
        if (!card) return;
        const id = card.querySelector('[data-shop-buy], [data-shop-use]')?.dataset.shopBuy || card.querySelector('[data-shop-buy], [data-shop-use]')?.dataset.shopUse;
        const option = window.BackgroundState?.options?.find((item) => item.id === id);
        if (option?.image) {
            window.BackgroundState.warm(option.image, 'high');
        }
    }, { passive: true });

    window.QcoinState.subscribe(render);
    window.addEventListener('backgroundthemechange', render);
    window.addEventListener('backgroundchange', render);
    window.addEventListener('backgroundinventorychange', render);
    render();
})();

(() => {
    const itemsWrap = document.getElementById("shop-items");
    const summary = document.getElementById("shop-summary");
    if (!itemsWrap) return;
    let previewObserver = null;

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function stripHtml(text) {
        const wrap = document.createElement("div");
        wrap.innerHTML = String(text || "");
        return wrap.textContent || wrap.innerText || "";
    }

    function getItems() {
        if (window.BackgroundState?.options?.length) {
            return window.BackgroundState.options;
        }
        return (window.BACKGROUND_OPTIONS || []).map((item) => ({
            ...item,
            active: item.id === "default"
        }));
    }

    function getItemTitle(item) {
        const meta = stripHtml(item.meta || item.title || "");
        const label = stripHtml(item.label || item.id);
        return meta && meta !== label ? `${label} · ${meta}` : label;
    }

    function renderSummary(items) {
        if (!summary) return;
        const active = items.find((item) => item.active || item.id === window.BackgroundState?.currentId);
        summary.textContent = `共 ${items.length} 个背景；当前使用 ${active ? getItemTitle(active) : "默认"}。`;
    }

    function renderItems() {
        const items = getItems();
        renderSummary(items);

        if (!items.length) {
            itemsWrap.innerHTML = '<div class="record-empty"><strong>暂无可用背景。</strong><span>请确认背景配置已加载后刷新页面。</span></div>';
            return;
        }

        previewObserver?.disconnect();
        itemsWrap.innerHTML = items.map((item) => {
            const active = item.active || item.id === window.BackgroundState?.currentId;
            const title = getItemTitle(item);
            const previewStyle = item.image
                ? (active ? ` style="--shop-preview:url('${escapeHtml(item.image)}')"` : "")
                : ` style="--shop-preview:${item.preview || "var(--control-gradient)"}"`;
            return `
                <article class="shop-card shop-background-card${active ? " is-active" : ""}" data-background-id="${escapeHtml(item.id)}"${previewStyle}>
                    <span class="shop-background-preview" aria-hidden="true"></span>
                    <div class="shop-card-head">
                        <span class="shop-item-type">${escapeHtml(item.category)}背景</span>
                        <strong>${escapeHtml(title)}</strong>
                    </div>
                    <div class="shop-card-foot">
                        <button type="button" class="btn-action shop-use-btn" data-shop-use="${escapeHtml(item.id)}" ${active ? "disabled" : ""}>
                            ${active ? "使用中" : "使用背景"}
                        </button>
                    </div>
                </article>
            `;
        }).join("");

        const deferredCards = [...itemsWrap.querySelectorAll(".shop-background-card:not(.is-active)")];
        if (!("IntersectionObserver" in window)) {
            deferredCards.forEach(loadCardPreview);
            return;
        }
        previewObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                previewObserver.unobserve(entry.target);
                loadCardPreview(entry.target);
            });
        }, { rootMargin: "240px 0px" });
        deferredCards.forEach((card) => previewObserver.observe(card));
    }

    function loadCardPreview(card) {
        const option = window.BackgroundState?.options?.find((item) => item.id === card.dataset.backgroundId);
        if (!option?.image) return;
        card.style.setProperty("--shop-preview", `url("${option.image}")`);
        window.BackgroundState?.warm(option.image, "low");
    }

    itemsWrap.addEventListener("click", (event) => {
        const useButton = event.target.closest("[data-shop-use]");
        if (!useButton) return;
        const backgroundId = useButton.dataset.shopUse;
        const applied = window.BackgroundState?.apply(backgroundId);
        renderItems();
        applied?.themeReady?.catch(() => {});
    });

    itemsWrap.addEventListener("pointerover", (event) => {
        const card = event.target.closest(".shop-background-card");
        if (!card) return;
        const id = card.dataset.backgroundId;
        const option = window.BackgroundState?.options?.find((item) => item.id === id);
        if (option?.image) {
            window.BackgroundState.warm(option.image, "high");
        }
    }, { passive: true });

    renderItems();
})();

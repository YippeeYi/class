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

    const ALLOWED_INLINE_TAGS = new Set(["A", "BR", "STRONG", "B", "EM", "I", "SPAN", "SMALL", "CODE"]);
    const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

    function sanitizeInlineHtml(value) {
        const template = document.createElement("template");
        template.innerHTML = String(value || "");

        const sanitizeNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return;
            if (node.nodeType !== Node.ELEMENT_NODE) {
                node.remove();
                return;
            }

            if (!ALLOWED_INLINE_TAGS.has(node.tagName)) {
                node.replaceWith(document.createTextNode(node.textContent || ""));
                return;
            }

            const originalHref = node.tagName === "A" ? node.getAttribute("href") || "" : "";
            [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));

            if (node.tagName === "A") {
                let safeHref = "";
                try {
                    const url = new URL(originalHref, location.href);
                    if (SAFE_LINK_PROTOCOLS.has(url.protocol)) safeHref = url.href;
                } catch (error) {
                    safeHref = "";
                }
                if (!safeHref) {
                    node.replaceWith(document.createTextNode(node.textContent || ""));
                    return;
                }
                node.setAttribute("href", safeHref);
                node.setAttribute("target", "_blank");
                node.setAttribute("rel", "noopener noreferrer");
            }

            [...node.childNodes].forEach(sanitizeNode);
        };

        [...template.content.childNodes].forEach(sanitizeNode);
        return template.innerHTML;
    }

    function htmlToText(value) {
        const wrap = document.createElement("div");
        wrap.innerHTML = sanitizeInlineHtml(value);
        return (wrap.textContent || wrap.innerText || "").trim();
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
        const meta = htmlToText(item.meta || item.title || "");
        const label = htmlToText(item.label || item.id);
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
            const label = htmlToText(item.label || item.id);
            const meta = sanitizeInlineHtml(item.meta || item.title || "");
            const previewStyle = item.image ? "" : ` style="--shop-preview:${item.preview || "var(--control-gradient)"}"`;
            return `
                <article class="shop-card shop-background-card${active ? " is-active" : ""}" data-background-id="${escapeHtml(item.id)}"${previewStyle}>
                    <span class="shop-background-preview" data-background-preview aria-label="${escapeHtml(label)} 背景预览"></span>
                    <div class="shop-card-head">
                        <span class="shop-item-type">${escapeHtml(item.category)}背景</span>
                        <strong>${escapeHtml(label)}</strong>
                        ${meta ? `<span class="shop-item-meta">${meta}</span>` : ""}
                    </div>
                    <div class="shop-card-foot">
                        <button type="button" class="btn-action shop-use-btn" data-shop-use="${escapeHtml(item.id)}" ${active ? "disabled" : ""}>
                            ${active ? "使用中" : "使用背景"}
                        </button>
                    </div>
                </article>
            `;
        }).join("");

        const activeCards = [...itemsWrap.querySelectorAll(".shop-background-card.is-active")];
        activeCards.forEach((card) => loadCardPreview(card, 'high'));
        const deferredCards = [...itemsWrap.querySelectorAll(".shop-background-card:not(.is-active)")];
        if (!("IntersectionObserver" in window)) {
            deferredCards.forEach(loadCardPreview);
            return;
        }
        previewObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                previewObserver.unobserve(entry.target);
                loadCardPreview(entry.target, 'low');
            });
        }, { rootMargin: "240px 0px" });
        deferredCards.forEach((card) => previewObserver.observe(card));
    }

    function previewKey(option) {
        // The card preview and applied background intentionally share this key
        // when they point to the same final image.
        return `background:${option.image}|${option.version || ''}`;
    }

    function showPreviewLoading(host) {
        host.replaceChildren();
        const state = document.createElement('span');
        state.className = 'loading-state image-load-state';
        state.setAttribute('role', 'status');
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        const text = document.createElement('strong');
        text.className = 'loading-text';
        text.textContent = '正在加载背景预览';
        state.append(spinner, text);
        host.append(state);
    }

    function showPreviewError(host, retry) {
        host.replaceChildren();
        const state = document.createElement('span');
        state.className = 'image-load-error';
        const text = document.createElement('strong');
        text.textContent = '背景预览加载失败';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-action page-state-retry';
        button.textContent = '重试';
        button.addEventListener('click', retry, { once: true });
        state.append(text, button);
        host.append(state);
    }

    function loadCardPreview(card, priority = 'low', { forceRefresh = false } = {}) {
        const option = window.BackgroundState?.options?.find((item) => item.id === card.dataset.backgroundId);
        if (!option?.image) return;
        const host = card.querySelector('[data-background-preview]');
        const loader = window.ClassRecordImageLoader;
        if (!host || !loader || host.dataset.loading === 'true') return;
        const key = previewKey(option);
        const cached = loader.peek(key);
        const token = `${Date.now()}:${Math.random()}`;
        host.dataset.previewToken = token;
        host.dataset.loading = 'true';
        const load = () => (window.BackgroundState?.loadImage
            ? window.BackgroundState.loadImage(option.image, priority, { forceRefresh })
            : loader.loadPublic(key, option.image, { priority, forceRefresh }));
        const ready = (async () => {
            if (cached) return load();
            // Do not animate on a verified persistent-cache hit. The neutral
            // preview background remains in place during this tiny lookup.
            if (!forceRefresh && await loader.hasPublicCache(key)) return load();
            if (!host.isConnected || host.dataset.previewToken !== token) return null;
            showPreviewLoading(host);
            return load();
        })();
        ready.then((result) => {
            if (!result) return;
            if (!host.isConnected || host.dataset.previewToken !== token) return;
            const image = document.createElement('img');
            image.src = typeof result === 'string' ? result : result.url;
            image.alt = '';
            image.decoding = 'async';
            host.replaceChildren(image);
            host.dataset.ready = 'true';
        }).catch(() => {
            if (!host.isConnected || host.dataset.previewToken !== token) return;
            showPreviewError(host, () => {
                loader.forget(key, { publicCache: true }).finally(() => {
                    host.dataset.loading = '';
                    loadCardPreview(card, priority, { forceRefresh: true });
                });
            });
        }).finally(() => {
            if (host.dataset.previewToken === token) host.dataset.loading = '';
        });
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

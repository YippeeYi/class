/* Resolves the private map only after authGate. No Storage URL is persisted. */
(() => {
    const figure = document.getElementById('meal-map-figure');
    const image = document.getElementById('meal-map-image');
    if (!figure || !image) return;
    let retryUsed = false;
    let currentUrl = '';
    let refreshTimer = 0;
    const setState = (state, message = '') => {
        figure.dataset.state = state;
        figure.classList.toggle('is-loading', state === 'loading');
        figure.classList.toggle('is-ready', state === 'ready');
        figure.classList.toggle('is-error', state === 'error');
        figure.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
        const label = figure.querySelector('.meal-map-placeholder b');
        if (label && message) label.textContent = message;
    };
    const clearRefreshTimer = () => { if (refreshTimer) window.clearTimeout(refreshTimer); refreshTimer = 0; };
    const scheduleRefresh = (refreshAt) => {
        clearRefreshTimer();
        refreshTimer = window.setTimeout(() => loadMap({ forceRefresh: true, silent: true }), Math.max(1000, Number(refreshAt) - Date.now()));
    };
    const loadMap = async ({ forceRefresh = false, silent = false } = {}) => {
        try {
            if (!silent) setState('loading');
            const asset = await window.ClassRecordData?.getMealMapAsset?.({ forceRefresh });
            if (!asset?.url) throw new Error('Meal map is unavailable.');
            currentUrl = asset.url;
            image.src = currentUrl;
            scheduleRefresh(asset.refreshAt);
        } catch (error) {
            clearRefreshTimer(); currentUrl = ''; image.removeAttribute('src'); image.hidden = true;
            setState('error', '图片暂时无法加载，请稍后重试。');
            window.ClassRecordDiagnostics?.warn('Meal map load failed', error);
        }
    };
    image.addEventListener('load', () => { image.hidden = false; retryUsed = false; setState('ready'); });
    image.addEventListener('error', () => {
        if (!retryUsed) { retryUsed = true; loadMap({ forceRefresh: true, silent: true }); return; }
        setState('error', '图片暂时无法加载，请稍后重试。');
    });
    figure.addEventListener('click', () => {
        if (!currentUrl || typeof window.ClassRecordImageViewer?.open !== 'function') return;
        window.ClassRecordImageViewer.openMealMap?.({ resolvedUrl: currentUrl })
            || window.ClassRecordImageViewer.open('', { alt: '蹭饭图', resolvedUrl: currentUrl });
    });
    window.addEventListener('classrecordcacheclearing', () => { clearRefreshTimer(); currentUrl = ''; image.removeAttribute('src'); });
    window.addEventListener('pagehide', clearRefreshTimer, { once: true });
    (window.waitForAccess?.() || Promise.resolve()).then(() => loadMap()).catch(() => setState('error', '访问权限已失效，请重新验证。'));
})();

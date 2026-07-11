/************************************************************
 * navigation.js
 * 全站跳转过渡 + 轻量预取
 ************************************************************/

(() => {
    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TRANSITION_MS = REDUCED_MOTION ? 0 : 95;
    const FULLSCREEN_STORAGE_KEY = 'classRecord:keepFullscreen';
    const GUIDE_BUTTON_LABEL = '返回导览页面';
    let isNavigating = false;

    const syncFullscreenPreference = () => {
        try {
            if (isNavigating) {
                sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, '1');
                return;
            }
            if (document.fullscreenElement) {
                sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, '1');
            } else {
                sessionStorage.removeItem(FULLSCREEN_STORAGE_KEY);
            }
        } catch (error) {
            // Ignore storage failures.
        }
    };

    const markEntering = () => {
        document.body.classList.add('page-ready');
    };

    const normalizeGuideReturnButtons = () => {
        if (document.body.classList.contains('guide-page')) return;
        document.querySelectorAll('.page-header .back-to-guide-btn').forEach((button) => {
            button.setAttribute('aria-label', GUIDE_BUTTON_LABEL);
            button.setAttribute('title', GUIDE_BUTTON_LABEL);
            button.setAttribute('data-nav-target', 'index.html');
            button.textContent = GUIDE_BUTTON_LABEL;
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            normalizeGuideReturnButtons();
            markEntering();
        }, { once: true });
    } else {
        normalizeGuideReturnButtons();
        markEntering();
    }

    document.addEventListener('fullscreenchange', syncFullscreenPreference);

    const restoreFullscreen = () => {
        try {
            if (sessionStorage.getItem(FULLSCREEN_STORAGE_KEY) === '1' && !document.fullscreenElement && document.fullscreenEnabled) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } catch (error) {
            // Ignore fullscreen restore failures.
        }
    };

    window.addEventListener('load', restoreFullscreen, { once: true });
    document.addEventListener('pointerdown', restoreFullscreen, { once: true, capture: true });

    const prefetchCache = new Set();
    const dataWarmCache = new Set();

    const getSafeRouteUrl = (href) => {
        const value = String(href || '').trim();
        if (!value || value === '#' || value.startsWith('#') || value.startsWith('javascript:')) return null;
        if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) return null;
        if (/^[a-zA-Z0-9_-]+$/.test(value) && !value.endsWith('.html')) return null;
        let url;
        try {
            url = new URL(value, window.location.href);
        } catch (error) {
            return null;
        }
        if (url.origin !== window.location.origin) return null;
        const file = url.pathname.split('/').pop() || '';
        const isHtmlPage = /\.html$/i.test(file) || file === '' || file === location.pathname.split('/').pop();
        return isHtmlPage ? url : null;
    };

    const prefetchPage = (href) => {
        const url = getSafeRouteUrl(href);
        if (!url) return;
        if (prefetchCache.has(url.href)) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = url.href;
        document.head.appendChild(link);
        prefetchCache.add(url.href);
    };

    const warmRouteData = (href) => {
        const url = getSafeRouteUrl(href);
        if (!url || dataWarmCache.has(url.pathname)) return;
        dataWarmCache.add(url.pathname);

        const path = url.pathname.split('/').pop() || 'index.html';
        const loaders = [];
        if (['record.html', 'timeline.html', 'shop.html'].includes(path)) {
            loaders.push(window.loadAllRecords, window.loadAllPeople);
        } else if (['people.html', 'person.html'].includes(path)) {
            loaders.push(window.loadAllPeople, window.loadAllRecords);
        } else if (['quotes.html'].includes(path)) {
            loaders.push(window.loadAllQuotes);
        } else if (['quiz.html'].includes(path)) {
            loaders.push(window.loadAllQuotes, window.loadAllPeople, window.loadAllRecords);
        } else if (['search.html'].includes(path)) {
            loaders.push(window.loadAllQuotes, window.loadAllPeople, window.loadAllRecords);
        } else if (['materials.html'].includes(path)) {
            loaders.push(window.loadAllMaterials);
        }

        const run = () => {
            loaders.filter(Boolean).forEach((loader) => {
                Promise.resolve(loader()).catch(() => {});
            });
        };
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 600 });
        } else {
            window.setTimeout(run, 180);
        }
    };

    const prefetchTargetFromEvent = (event) => {
        const trigger = event.target.closest('[data-nav-target], [data-target], a[href]');
        if (!trigger) {
            return;
        }
        if (trigger.matches('button:not([data-nav-target]), input, select, option, textarea, datalist, [role="button"]:not([data-nav-target])')) {
            return;
        }

        const href = trigger.getAttribute('data-nav-target')
            || (trigger.tagName === 'A' ? trigger.getAttribute('href') : '')
            || trigger.getAttribute('href');
        prefetchPage(href);
        warmRouteData(href);
    };

    const warmCoreData = () => {
        [
            window.loadAllRecords,
            window.loadAllPeople,
            window.loadAllQuotes,
            window.loadAllMaterials,
            () => window.ClassRecordData?.loadCreditsPage?.()
        ]
            .filter(Boolean)
            .forEach((loader) => Promise.resolve(loader()).catch(() => {}));
    };

    document.addEventListener('pointerover', prefetchTargetFromEvent, { passive: true });
    document.addEventListener('focusin', prefetchTargetFromEvent);
    document.addEventListener('touchstart', prefetchTargetFromEvent, { passive: true });

    window.addEventListener('load', () => {
        const run = () => {
            prefetchPage('record.html');
            prefetchPage('people.html');
            prefetchPage('quotes.html');
            prefetchPage('quiz.html');
            prefetchPage('search.html');
            prefetchPage('timeline.html');
            prefetchPage('shop.html');
            prefetchPage('credits.html');
            prefetchPage('materials.html');
            warmCoreData();
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 1200 });
        } else {
            window.setTimeout(run, 360);
        }
    });

    window.navigateTo = (href) => {
        if (!href) {
            return;
        }

        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) {
            isNavigating = Boolean(document.fullscreenElement);
            syncFullscreenPreference();
            window.location.href = url.href;
            return;
        }

        isNavigating = Boolean(document.fullscreenElement);
        syncFullscreenPreference();
        document.body.classList.remove('page-ready');
        document.body.classList.add('page-leaving');

        window.setTimeout(() => {
            window.location.href = url.href;
        }, TRANSITION_MS);
    };

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-nav-target]');
        if (!trigger) {
            return;
        }

        const target = trigger.getAttribute('data-nav-target');
        if (!target) {
            return;
        }

        event.preventDefault();
        window.navigateTo(target);
    });
})();



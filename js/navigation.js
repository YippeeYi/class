/************************************************************
 * navigation.js
 * 全站跳转过渡 + 轻量预取
 ************************************************************/

(() => {
    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TRANSITION_MS = REDUCED_MOTION ? 0 : 95;
    const FULLSCREEN_STORAGE_KEY = 'classRecord:keepFullscreen';
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', markEntering, { once: true });
    } else {
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

    const prefetchPage = (href) => {
        if (!href) {
            return;
        }
        const url = new URL(href, window.location.href);
        if (prefetchCache.has(url.href)) {
            return;
        }
        if (url.origin !== window.location.origin) {
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
        if (!href) return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin || dataWarmCache.has(url.pathname)) return;
        dataWarmCache.add(url.pathname);

        const path = url.pathname.split('/').pop() || 'index.html';
        const loaders = [];
        if (['record.html', 'timeline.html', 'shop.html'].includes(path)) {
            loaders.push(window.loadAllRecords, window.loadAllPeople);
        } else if (['people.html', 'person.html'].includes(path)) {
            loaders.push(window.loadAllPeople, window.loadAllRecords);
        } else if (['glossary.html'].includes(path)) {
            loaders.push(window.loadAllGlossary);
        } else if (['term.html', 'quiz.html'].includes(path)) {
            loaders.push(window.loadAllGlossary, window.loadAllPeople, window.loadAllRecords);
        } else if (['search.html'].includes(path)) {
            loaders.push(window.loadAllGlossary, window.loadAllPeople, window.loadAllRecords);
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

        const href = trigger.getAttribute('data-nav-target')
            || trigger.getAttribute('data-target')
            || trigger.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
        }
        prefetchPage(href);
        warmRouteData(href);
    };

    const warmCoreData = () => {
        [window.loadAllRecords, window.loadAllPeople, window.loadAllGlossary]
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
            prefetchPage('glossary.html');
            prefetchPage('quiz.html');
            prefetchPage('search.html');
            prefetchPage('timeline.html');
            prefetchPage('shop.html');
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



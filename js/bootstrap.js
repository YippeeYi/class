/************************************************************
 * bootstrap.js
 * 按页面优先加载关键缓存，再在后台预热其余缓存
 ************************************************************/

const waitForAccess = () => {
    if (typeof window.waitForAccess === 'function') {
        return window.waitForAccess();
    }

    return new Promise((resolve) => {
        window.addEventListener(
            'authGateReady',
            () => {
                window.waitForAccess().then(resolve);
            },
            { once: true }
        );
    });
};

function detectCriticalLoaders() {
    const loaders = [];

    if (document.getElementById('record-list')) {
        loaders.push(window.loadAllRecords);
    }

    if (document.getElementById('people-list')) {
        loaders.push(window.loadAllPeople);
        loaders.push(window.loadAllRecords);
    }

    if (document.getElementById('quotes-list')) {
        loaders.push(window.loadAllQuotes);
    }

    if (document.getElementById('person-name')) {
        loaders.push(window.loadAllPeople);
        loaders.push(window.loadAllRecords);
    }

    if (document.getElementById('quiz-question-text')) {
        loaders.push(window.loadAllRecords);
        loaders.push(window.loadAllPeople);
        loaders.push(window.loadAllQuotes);
    }

    if (document.getElementById('materials-list')) {
        loaders.push(window.loadAllMaterials);
    }

    return Array.from(new Set(loaders.filter(Boolean)));
}

function prewarmBackground(loaders) {
    if (!Array.isArray(loaders) || loaders.length === 0) {
        return;
    }

    const run = () => {
        loaders.forEach((loader) => {
            Promise.resolve(loader()).catch(() => {});
        });
    };

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 1000 });
    } else {
        window.setTimeout(run, 300);
    }
}

window.cacheReadyPromise = (async () => {
    await waitForAccess();

    const criticalLoaders = detectCriticalLoaders();
    if (criticalLoaders.length === 0) {
        return;
    }

    await Promise.all(criticalLoaders.map((loader) => loader()));

    const allLoaders = [window.loadAllRecords, window.loadAllPeople, window.loadAllQuotes, window.loadAllMaterials].filter(Boolean);
    const backgroundLoaders = allLoaders.filter((loader) => !criticalLoaders.includes(loader));
    prewarmBackground(backgroundLoaders);
})();

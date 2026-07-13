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
        loaders.push(window.loadAllPeople);
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

window.cacheReadyPromise = (async () => {
    await waitForAccess();

    const criticalLoaders = detectCriticalLoaders();
    if (criticalLoaders.length === 0) {
        return;
    }

    await Promise.all(criticalLoaders.map((loader) => loader()));
})();

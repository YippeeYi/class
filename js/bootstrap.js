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
    const isPersonPage = Boolean(document.getElementById('person-name'));

    if (document.getElementById('record-list') && !isPersonPage) {
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

    if (isPersonPage) {
        loaders.push(window.loadAllPeople);
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
    const critical = criticalLoaders.length === 0
        ? Promise.resolve()
        : Promise.all(criticalLoaders.map((loader) => loader()));
    // Pages that render record markup must wait until every public content
    // source has supplied illustration dimensions, so tooltips never start
    // from an incorrect fallback frame.
    await Promise.all([
        critical,
        window.ClassRecordIllustrationMetadataPromise || Promise.resolve()
    ]);
})();

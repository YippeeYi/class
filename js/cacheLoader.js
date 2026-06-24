/************************************************************
 * cacheLoader.js
 * 通用高速加载器
 *
 * 策略：
 * - 页面生命周期内使用内存缓存，避免重复解析大批 JSON。
 * - 同一个 key 的并发请求自动合并。
 * - 持久层交给浏览器 HTTP 缓存，不再把记录数据写入 localStorage。
 ************************************************************/

const CACHE_PREFIX = "classRecord";
const memoryCache = new Map();
const inflightLoads = new Map();

window.loadWithCache = async function ({
    key,
    expire = 24 * 60 * 60 * 1000,
    loader
}) {
    if (!key || typeof loader !== "function") {
        throw new Error("loadWithCache: key 和 loader 是必须的");
    }

    const now = Date.now();
    const memoryItem = memoryCache.get(key);
    if (memoryItem && now - memoryItem.time < expire) {
        return memoryItem.data;
    }

    if (inflightLoads.has(key)) {
        return inflightLoads.get(key);
    }

    const loadPromise = (async () => {
        const data = await loader();
        memoryCache.set(key, { data, time: Date.now() });
        return data;
    })();

    inflightLoads.set(key, loadPromise);

    try {
        return await loadPromise;
    } finally {
        inflightLoads.delete(key);
    }
};

window.fetchJson = async function (url, options = {}) {
    const response = await fetch(url, { cache: "force-cache", ...options });
    if (!response.ok) {
        throw new Error(`${url} 加载失败：${response.status}`);
    }
    return response.json();
};

window.ensureImageCacheLoaded = async function () {
    return Promise.resolve();
};

window.needsImageCacheLoad = async function () {
    return false;
};

window.clearCache = async function () {
    memoryCache.clear();
    inflightLoads.clear();

    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`${CACHE_PREFIX}:records:`) || key.startsWith(`${CACHE_PREFIX}:people:`) || key.startsWith(`${CACHE_PREFIX}:glossary:`)) {
            localStorage.removeItem(key);
        }
    });

    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith(`${CACHE_PREFIX}:image-cache:`)).map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(registrations
            .filter((registration) => registration.active?.scriptURL?.includes("service-worker.js"))
            .map((registration) => registration.unregister().catch(() => false)));
    }

    console.log("已清除本页数据缓存");
};

window.needsCacheLoad = function ({ expire = 24 * 60 * 60 * 1000 } = {}) {
    return !isCacheValid("records", expire)
        || !isCacheValid("people", expire)
        || !isCacheValid("glossary", expire);
};

function isCacheValid(key, expire) {
    const item = memoryCache.get(key);
    return Boolean(item && Date.now() - item.time < expire);
}

function showLoadingOverlay() {
    if (document.getElementById("loading-overlay")) {
        return;
    }

    const overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.innerHTML = `
        <div class="loading-overlay-card">
            <div class="loading-overlay-title">正在加载数据…</div>
            <div class="loading-overlay-subtitle">首次进入时会使用浏览器缓存加速后续访问</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.remove();
    }
}

window.ensureAllCachesLoaded = async function ({ expire = 24 * 60 * 60 * 1000, showOverlay = true, onProgress, includeImages = false } = {}) {
    const needsDataLoad = window.needsCacheLoad({ expire });
    if (!needsDataLoad) {
        return;
    }

    if (showOverlay) {
        showLoadingOverlay();
    }

    try {
        if (typeof onProgress === "function") {
            if (window.ClassRecordData?.isEnabled()) {
                onProgress(0);
                await loadAllRecords();
                onProgress(0.45);
                await loadAllPeople();
                onProgress(0.72);
                await loadAllGlossary();
                onProgress(1);
            } else {
                const getBatchSize = async (indexPath) => {
                    const files = await window.fetchJson(indexPath);
                    return Array.isArray(files) ? files.length : 0;
                };

                const [recordCount, peopleCount, glossaryCount] = await Promise.all([
                    getBatchSize("data/record/records_index.json"),
                    getBatchSize("data/people/people_index.json"),
                    getBatchSize("data/glossary/glossary_index.json")
                ]);

                const totalSteps = recordCount + peopleCount + glossaryCount;
                let completedSteps = 0;
                let lastProgress = 0;

                const emitProgress = () => {
                    if (totalSteps <= 0) {
                        onProgress(0);
                        return;
                    }
                    const nextProgress = completedSteps / totalSteps;
                    lastProgress = Math.max(lastProgress, nextProgress);
                    onProgress(lastProgress);
                };

                const onProgressStep = () => {
                    completedSteps += 1;
                    emitProgress();
                };

                onProgress(0);
                await loadAllRecords({ onProgressStep });
                await loadAllPeople({ onProgressStep });
                await loadAllGlossary({ onProgressStep });
                onProgress(1);
            }
        } else {
            await Promise.all([
                loadAllRecords(),
                loadAllPeople(),
                loadAllGlossary()
            ]);
        }
    } finally {
        if (showOverlay) {
            hideLoadingOverlay();
        }
    }
};

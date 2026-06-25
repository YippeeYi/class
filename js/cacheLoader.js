/************************************************************
 * cacheLoader.js
 * 閫氱敤楂橀€熷姞杞藉櫒
 *
 * 绛栫暐锛? * - 椤甸潰鐢熷懡鍛ㄦ湡鍐呬娇鐢ㄥ唴瀛樼紦瀛橈紝閬垮厤閲嶅瑙ｆ瀽澶ф壒 JSON銆? * - 鍚屼竴涓?key 鐨勫苟鍙戣姹傝嚜鍔ㄥ悎骞躲€? * - 鎸佷箙灞備氦缁欐祻瑙堝櫒 HTTP 缂撳瓨锛屼笉鍐嶆妸璁板綍鏁版嵁鍐欏叆 localStorage銆? ************************************************************/

const CACHE_PREFIX = "classRecord";
const memoryCache = new Map();
const inflightLoads = new Map();

window.loadWithCache = async function ({
    key,
    expire = 24 * 60 * 60 * 1000,
    loader
}) {
    if (!key || typeof loader !== "function") {
        throw new Error("loadWithCache: key 鍜?loader 鏄繀椤荤殑");
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
        throw new Error(`${url} 鍔犺浇澶辫触锛?{response.status}`);
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
            <div class="loading-overlay-title">姝ｅ湪鍔犺浇鏁版嵁鈥?/div>
            <div class="loading-overlay-subtitle">棣栨杩涘叆鏃朵細浣跨敤娴忚鍣ㄧ紦瀛樺姞閫熷悗缁闂?/div>
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
            onProgress(0);
            await loadAllRecords();
            onProgress(0.45);
            await loadAllPeople();
            onProgress(0.72);
            await loadAllGlossary();
            onProgress(1);
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

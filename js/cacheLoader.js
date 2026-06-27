const CACHE_PREFIX = "classRecord";
const memoryCache = new Map();
const inflightLoads = new Map();

window.loadWithCache = async function ({ key, expire = 24 * 60 * 60 * 1000, loader, force = false }) {
    if (!key || typeof loader !== "function") throw new Error("loadWithCache requires key and loader.");
    const now = Date.now();
    const memoryItem = memoryCache.get(key);
    if (!force && memoryItem && now - memoryItem.time < expire) return memoryItem.data;
    if (!force && inflightLoads.has(key)) return inflightLoads.get(key);
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


window.clearCache = async function () {
    memoryCache.clear();
    inflightLoads.clear();
    await window.clearAllSiteCache?.();
};

window.addEventListener("classrecordcacheclearing", () => {
    memoryCache.clear();
    inflightLoads.clear();
});

window.needsCacheLoad = function ({ expire = 24 * 60 * 60 * 1000 } = {}) {
    return !isCacheValid("records:visible", expire) || !isCacheValid("people", expire) || !isCacheValid("glossary", expire);
};

function isCacheValid(key, expire) {
    const item = memoryCache.get(key);
    return Boolean(item && Date.now() - item.time < expire);
}

function showLoadingOverlay() {
    if (document.getElementById("loading-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.innerHTML = `
        <div class="loading-overlay-card">
            <div class="loading-overlay-title">Loading data...</div>
            <div class="loading-overlay-subtitle">Reading class records from Supabase.</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    document.getElementById("loading-overlay")?.remove();
}

window.ensureAllCachesLoaded = async function ({ expire = 24 * 60 * 60 * 1000, showOverlay = true, onProgress } = {}) {
    const needsDataLoad = window.needsCacheLoad({ expire });
    if (!needsDataLoad) return;
    if (showOverlay) showLoadingOverlay();
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
            await Promise.all([loadAllRecords(), loadAllPeople(), loadAllGlossary()]);
        }
    } finally {
        if (showOverlay) hideLoadingOverlay();
    }
};

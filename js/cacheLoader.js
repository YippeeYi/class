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


window.ensureImageCacheLoaded = async function () { return Promise.resolve(); };
window.needsImageCacheLoad = async function () { return false; };

window.clearCache = async function () {
    memoryCache.clear();
    inflightLoads.clear();
    try {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(CACHE_PREFIX) || key.startsWith("sb-")) localStorage.removeItem(key);
        });
        Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith(CACHE_PREFIX) || key.startsWith("sb-")) sessionStorage.removeItem(key);
        });
    } catch (error) {
        // Ignore storage failures.
    }
    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) || key.toLowerCase().includes("classrecord")).map((key) => caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(registrations
            .filter((registration) => registration.active?.scriptURL?.includes("service-worker.js"))
            .map((registration) => registration.unregister().catch(() => false)));
    }
    window.ClassRecordHiddenModeActive = false;
};

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

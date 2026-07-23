const memoryCache = new Map();
const inflightLoads = new Map();
const SESSION_CACHE_PREFIX = "classRecord:dataCache:v2:";
const LEGACY_SESSION_CACHE_PREFIX = "classRecord:dataCache:v1:";
const DEFAULT_SESSION_CACHE_TTL = 10 * 60 * 1000;

function readSessionCache(key, expire) {
    if (!Number.isFinite(expire) || expire <= 0) return null;
    try {
        const storageKey = `${SESSION_CACHE_PREFIX}${key}`;
        const item = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        if (!item || !Number.isFinite(item.time) || Date.now() - item.time >= expire) {
            sessionStorage.removeItem(storageKey);
            return null;
        }
        return item;
    } catch (error) {
        return null;
    }
}

function writeSessionCache(key, data) {
    try {
        sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${key}`, JSON.stringify({ time: Date.now(), data }));
    } catch (error) {
        // Storage can be disabled or full; the in-memory cache still works.
    }
}

// v1 did not carry the current cache policy version. Remove only this app's
// old entries; never clear unrelated storage belonging to the same origin.
try {
    Object.keys(sessionStorage)
        .filter((key) => key.startsWith(LEGACY_SESSION_CACHE_PREFIX))
        .forEach((key) => sessionStorage.removeItem(key));
} catch (error) {
    // Storage can be unavailable; memory de-duplication still works.
}

window.loadWithCache = async function ({
    key,
    expire = 24 * 60 * 60 * 1000,
    sessionExpire = DEFAULT_SESSION_CACHE_TTL,
    loader,
    force = false
}) {
    if (!key || typeof loader !== "function") throw new Error("loadWithCache requires key and loader.");
    const now = Date.now();
    const memoryItem = memoryCache.get(key);
    if (!force && memoryItem && now - memoryItem.time < expire) return memoryItem.data;
    if (!force && inflightLoads.has(key)) return inflightLoads.get(key);
    if (!force) {
        const sessionItem = readSessionCache(key, sessionExpire);
        if (sessionItem) {
            memoryCache.set(key, sessionItem);
            return sessionItem.data;
        }
    }
    const loadPromise = (async () => {
        const data = await loader();
        memoryCache.set(key, { data, time: Date.now() });
        if (sessionExpire > 0) writeSessionCache(key, data);
        return data;
    })();
    inflightLoads.set(key, loadPromise);
    try {
        return await loadPromise;
    } finally {
        inflightLoads.delete(key);
    }
};


window.addEventListener("classrecordcacheclearing", () => {
    memoryCache.clear();
    inflightLoads.clear();
});

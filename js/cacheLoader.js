const memoryCache = new Map();
const inflightLoads = new Map();
const SESSION_CACHE_PREFIX = "classRecord:dataCache:v3:";
const LEGACY_SESSION_CACHE_PREFIXES = ["classRecord:dataCache:v1:", "classRecord:dataCache:v2:"];
const DEFAULT_SESSION_CACHE_TTL = 15 * 60 * 1000;

// All application data is invite-gated.  sessionStorage is intentionally the
// longest-lived client cache: it survives reloads and page switches in the
// same tab, but is erased on tab close and on any access reset.  In particular
// this module never writes protected rows, signed URLs, or files to
// IndexedDB/Cache Storage/localStorage.
function getAccessScope() {
    try {
        const access = JSON.parse(localStorage.getItem("classRecord:inviteAccess") || "{}");
        const authorizedAt = String(access?.authorizedAt || access?.verifiedAt || "");
        return authorizedAt ? `access-${authorizedAt}` : "unauthorized";
    } catch (error) {
        return "unauthorized";
    }
}

function getStorageKey(key) {
    return `${SESSION_CACHE_PREFIX}${getAccessScope()}:${key}`;
}

function readSessionCache(key, expire) {
    if (!Number.isFinite(expire) || expire <= 0) return null;
    try {
        const storageKey = getStorageKey(key);
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
        sessionStorage.setItem(getStorageKey(key), JSON.stringify({ time: Date.now(), data }));
    } catch (error) {
        // Storage can be disabled or full; the in-memory cache still works.
    }
}

// v1 did not carry the current cache policy version. Remove only this app's
// old entries; never clear unrelated storage belonging to the same origin.
try {
    Object.keys(sessionStorage)
        .filter((key) => LEGACY_SESSION_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
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

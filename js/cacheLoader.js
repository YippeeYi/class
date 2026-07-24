/*
 * Shared data cache for invite-gated content.
 *
 * Memory is the fastest layer, sessionStorage is a short-lived fallback, and
 * IndexedDB makes approved, non-admin data survive a reload.  Every key is
 * bound to the current authorization epoch.  It deliberately never stores an
 * invite code, bearer token, signed URL, or private admin-only result.
 */
const memoryCache = new Map();
const inflightLoads = new Map();
const CACHE_VERSION = "v4";
const SESSION_CACHE_PREFIX = `classRecord:dataCache:${CACHE_VERSION}:`;
const LEGACY_SESSION_CACHE_PREFIXES = ["classRecord:dataCache:v1:", "classRecord:dataCache:v2:", "classRecord:dataCache:v3:"];
const DEFAULT_SESSION_CACHE_TTL = 15 * 60 * 1000;
const DEFAULT_PERSISTENT_CACHE_TTL = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const DATABASE_NAME = "classRecord-data-cache-v1";
const DATABASE_STORE = "entries";

function getAccessScope() {
    try {
        const access = JSON.parse(localStorage.getItem("classRecord:inviteAccess") || "{}");
        const authorizedAt = String(access?.authorizedAt || access?.verifiedAt || "");
        // A cache must never be usable before the invite gate has established
        // a real invite credential for this authorization epoch.
        return access?.type === "invite" && access?.token && authorizedAt
            ? `access-${authorizedAt}`
            : "unauthorized";
    } catch (error) {
        return "unauthorized";
    }
}

function getStorageKey(key) {
    return `${SESSION_CACHE_PREFIX}${getAccessScope()}:${key}`;
}

function getPersistentKey(key) {
    return `${CACHE_VERSION}:${getAccessScope()}:${key}`;
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
        // Storage can be disabled or full; the other layers still work.
    }
}

function openDatabase() {
    if (!("indexedDB" in window) || getAccessScope() === "unauthorized") return Promise.resolve(null);
    return new Promise((resolve) => {
        let request;
        try {
            request = indexedDB.open(DATABASE_NAME, 1);
        } catch (error) {
            resolve(null);
            return;
        }
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
                request.result.createObjectStore(DATABASE_STORE, { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => resolve(null);
    });
}

async function readPersistentCache(key, expire, staleExpire) {
    if (!Number.isFinite(expire) || expire <= 0 || getAccessScope() === "unauthorized") return null;
    const database = await openDatabase();
    if (!database) return null;
    const cacheKey = getPersistentKey(key);
    return new Promise((resolve) => {
        const transaction = database.transaction(DATABASE_STORE, "readonly");
        const request = transaction.objectStore(DATABASE_STORE).get(cacheKey);
        request.onsuccess = () => {
            const item = request.result;
            const age = Date.now() - Number(item?.time || 0);
            if (!item || !Number.isFinite(item.time) || age >= staleExpire) {
                if (item) void deletePersistentCache(key);
                resolve(null);
                return;
            }
            resolve({ ...item, stale: age >= expire });
        };
        request.onerror = () => resolve(null);
    }).finally(() => database.close());
}

async function writePersistentCache(key, data) {
    if (getAccessScope() === "unauthorized") return;
    const database = await openDatabase();
    if (!database) return;
    const item = { key: getPersistentKey(key), time: Date.now(), data };
    await new Promise((resolve) => {
        try {
            const request = database.transaction(DATABASE_STORE, "readwrite").objectStore(DATABASE_STORE).put(item);
            request.onsuccess = request.onerror = () => resolve();
        } catch (error) {
            resolve();
        }
    });
    database.close();
}

async function deletePersistentCache(key) {
    const database = await openDatabase();
    if (!database) return;
    await new Promise((resolve) => {
        try {
            const request = database.transaction(DATABASE_STORE, "readwrite").objectStore(DATABASE_STORE).delete(getPersistentKey(key));
            request.onsuccess = request.onerror = () => resolve();
        } catch (error) {
            resolve();
        }
    });
    database.close();
}

try {
    Object.keys(sessionStorage)
        .filter((key) => LEGACY_SESSION_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .forEach((key) => sessionStorage.removeItem(key));
} catch (error) {
    // Storage can be unavailable; in-memory de-duplication still works.
}

window.loadWithCache = async function ({
    key,
    expire = DEFAULT_PERSISTENT_CACHE_TTL,
    sessionExpire = DEFAULT_SESSION_CACHE_TTL,
    persistentExpire = expire,
    staleExpire = DEFAULT_STALE_CACHE_TTL,
    persistent = true,
    loader,
    force = false
}) {
    if (!key || typeof loader !== "function") throw new Error("loadWithCache requires key and loader.");
    const now = Date.now();
    const memoryItem = memoryCache.get(key);
    if (!force && memoryItem && now - memoryItem.time < expire) return memoryItem.data;
    if (!force && inflightLoads.has(key)) return inflightLoads.get(key);

    let staleItem = null;
    if (!force) {
        const sessionItem = readSessionCache(key, sessionExpire);
        if (sessionItem) {
            memoryCache.set(key, sessionItem);
            return sessionItem.data;
        }
        if (persistent) {
            const persistentItem = await readPersistentCache(key, persistentExpire, Math.max(staleExpire, persistentExpire));
            if (persistentItem && !persistentItem.stale) {
                memoryCache.set(key, persistentItem);
                writeSessionCache(key, persistentItem.data);
                return persistentItem.data;
            }
            staleItem = persistentItem;
        }
    }

    const loadPromise = (async () => {
        try {
            const data = await loader();
            const item = { data, time: Date.now() };
            memoryCache.set(key, item);
            if (sessionExpire > 0) writeSessionCache(key, data);
            if (persistent) void writePersistentCache(key, data);
            return data;
        } catch (error) {
            // A previously validated record is safer and more useful than an
            // empty screen during a transient network failure. Its access
            // scope is still checked by authGate before this code can run.
            if (staleItem?.data !== undefined) {
                memoryCache.set(key, staleItem);
                if (sessionExpire > 0) writeSessionCache(key, staleItem.data);
                return staleItem.data;
            }
            throw error;
        }
    })();
    inflightLoads.set(key, loadPromise);
    try {
        return await loadPromise;
    } finally {
        inflightLoads.delete(key);
    }
};

window.ClassRecordCache = Object.freeze({
    version: CACHE_VERSION,
    read: async (key, { expire = DEFAULT_PERSISTENT_CACHE_TTL, staleExpire = DEFAULT_STALE_CACHE_TTL } = {}) => {
        const item = await readPersistentCache(key, expire, Math.max(staleExpire, expire));
        return item && !item.stale ? item.data : null;
    },
    write: (key, data) => writePersistentCache(key, data),
    clear: async () => {
        memoryCache.clear();
        inflightLoads.clear();
        const database = await openDatabase();
        if (database) database.close();
    }
});

window.addEventListener("classrecordcacheclearing", () => {
    memoryCache.clear();
    inflightLoads.clear();
});

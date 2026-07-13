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


window.addEventListener("classrecordcacheclearing", () => {
    memoryCache.clear();
    inflightLoads.clear();
});

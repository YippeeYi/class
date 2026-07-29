/*
 * Hidden quiz image adapter.
 * It keeps quiz-specific rendering separate while delegating every private
 * resource read to ClassRecordData's access-scoped image cache and signer.
 */
(() => {
    const inflight = new Map();
    const cacheReads = new Map();

    const getKey = (path) => {
        const source = String(path || '').trim();
        return window.ClassRecordData?.normalizePrivateStoragePath?.(source) || source.replace(/^\/+/, '');
    };

    const getMemoryAsset = (path) => {
        const key = getKey(path);
        if (!key) return null;
        return window.ClassRecordData?.getPreloadedAsset?.(key) || null;
    };

    const readCachedAsset = (path) => {
        const key = getKey(path);
        if (!key) return Promise.resolve(null);
        const memory = getMemoryAsset(key);
        if (memory?.url) return Promise.resolve(memory);
        if (cacheReads.has(key)) return cacheReads.get(key);
        const read = Promise.resolve(window.ClassRecordData?.readCachedAsset?.(key, { priority: 'high' }) || null)
            .finally(() => cacheReads.delete(key));
        cacheReads.set(key, read);
        return read;
    };

    const load = (path, { force = false } = {}) => {
        const key = getKey(path);
        if (!key || !window.ClassRecordData?.preloadAsset) return Promise.reject(new Error('Hidden quiz image is unavailable.'));
        if (inflight.has(key)) return inflight.get(key);
        const task = (async () => {
            if (force) await window.ClassRecordData.invalidatePreloadedAsset?.(key);
            else {
                const cached = await readCachedAsset(key);
                if (cached?.url) return { asset: cached, cacheHit: true };
            }
            const url = await window.ClassRecordData.preloadAsset(key, { priority: 'high', forceRefresh: force });
            const asset = window.ClassRecordData.getPreloadedAsset?.(key) || (url ? { url, width: 0, height: 0 } : null);
            if (!asset?.url) throw new Error('Hidden quiz image could not be loaded.');
            return { asset, cacheHit: false };
        })();
        const reusable = task.finally(() => inflight.delete(key));
        inflight.set(key, reusable);
        return reusable;
    };

    window.addEventListener?.('classrecordcacheclearing', () => {
        inflight.clear();
        cacheReads.clear();
    });
    window.addEventListener?.('pagehide', () => {
        inflight.clear();
        cacheReads.clear();
    });

    window.ClassRecordQuizSecretImage = Object.freeze({ getKey, getMemoryAsset, readCachedAsset, load });
})();

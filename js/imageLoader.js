/*
 * One image request coordinator for UI images.  It deliberately knows nothing
 * about credentials: secureData supplies the private-object resolver, while
 * public callers use loadPublic().  Keys are stable resource identifiers, not
 * signed URLs, so in-flight work and decoded results can be shared safely.
 */
(() => {
    const VERSION = 'v1';
    const PUBLIC_CACHE = `classRecord-image-previews-${VERSION}`;
    const PUBLIC_TTL = 24 * 60 * 60 * 1000;
    const MAX_CONCURRENT = 4;
    const memory = new Map();
    const pending = new Map();
    const queue = [];
    let active = 0;

    const publicRequest = (key) => new Request(`${location.origin}/.classrecord-image-cache/${VERSION}/${encodeURIComponent(key)}`);
    const cacheHintKey = (key) => `classRecord:image-cache-hint:${VERSION}:${key}`;
    const hasHint = (key) => {
        try {
            const cachedAt = Number(localStorage.getItem(cacheHintKey(key)) || 0);
            if (cachedAt && Date.now() - cachedAt < PUBLIC_TTL) return true;
            if (cachedAt) localStorage.removeItem(cacheHintKey(key));
        } catch (_) {}
        return false;
    };
    const setHint = (key) => { try { localStorage.setItem(cacheHintKey(key), String(Date.now())); } catch (_) {} };
    const clearHint = (key) => { try { localStorage.removeItem(cacheHintKey(key)); } catch (_) {} };

    const decode = (url, priority) => new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.fetchPriority = priority;
        image.onload = async () => {
            try {
                if (typeof image.decode === 'function') await image.decode();
                if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image');
                resolve({ url, width: image.naturalWidth, height: image.naturalHeight });
            } catch (error) { reject(error); }
        };
        image.onerror = () => reject(new Error('Image decode failed'));
        image.src = url;
    });

    const schedule = (work, priority) => new Promise((resolve, reject) => {
        queue.push({ work, priority: priority === 'high' ? 0 : 1, resolve, reject });
        queue.sort((a, b) => a.priority - b.priority);
        run();
    });
    const run = () => {
        while (active < MAX_CONCURRENT && queue.length) {
            const item = queue.shift();
            active += 1;
            Promise.resolve().then(item.work).then(item.resolve, item.reject).finally(() => { active -= 1; run(); });
        }
    };

    const request = (key, loader, { priority = 'low', forceRefresh = false } = {}) => {
        if (!key) return Promise.reject(new Error('Image resource key is required'));
        if (!forceRefresh && memory.has(key)) return Promise.resolve({ ...memory.get(key), cacheHit: true });
        if (!forceRefresh && pending.has(key)) return pending.get(key);
        const promise = schedule(loader, priority)
            .then((result) => {
                if (!result?.url) throw new Error('Image resource unavailable');
                const value = { ...result, cacheHit: Boolean(result.cacheHit) };
                memory.set(key, value);
                return value;
            })
            .finally(() => pending.delete(key));
        pending.set(key, promise);
        return promise;
    };

    const loadPublic = (key, source, { priority = 'low', forceRefresh = false } = {}) => request(key, async () => {
        const requestKey = publicRequest(key);
        let response = null;
        let cacheHit = false;
        if (!forceRefresh && window.caches) {
            try {
                response = await (await caches.open(PUBLIC_CACHE)).match(requestKey);
                const cachedAt = Date.parse(response?.headers.get('x-classrecord-cached-at') || '');
                if (!response || !Number.isFinite(cachedAt) || Date.now() - cachedAt >= PUBLIC_TTL) {
                    if (response) await (await caches.open(PUBLIC_CACHE)).delete(requestKey);
                    response = null;
                } else cacheHit = true;
            } catch (_) { response = null; }
        }
        if (!response) {
            const fetched = await fetch(source, { credentials: 'same-origin', cache: 'force-cache' });
            if (!fetched.ok) throw new Error('Image request failed');
            response = fetched;
            if (window.caches) {
                try {
                    const headers = new Headers(fetched.headers);
                    headers.set('x-classrecord-cached-at', new Date().toISOString());
                    await (await caches.open(PUBLIC_CACHE)).put(requestKey, new Response(await fetched.clone().blob(), { headers }));
                    setHint(key);
                } catch (_) {}
            }
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        try { return { ...(await decode(objectUrl, priority)), cacheHit }; }
        catch (error) {
            URL.revokeObjectURL(objectUrl);
            if (cacheHit && window.caches) {
                try { await (await caches.open(PUBLIC_CACHE)).delete(requestKey); } catch (_) {}
                clearHint(key);
            }
            throw error;
        }
    }, { priority, forceRefresh });

    const forget = async (key, { publicCache = false } = {}) => {
        memory.delete(key); pending.delete(key); clearHint(key);
        if (publicCache && window.caches) {
            try { await (await caches.open(PUBLIC_CACHE)).delete(publicRequest(key)); } catch (_) {}
        }
    };
    const clear = () => { memory.clear(); pending.clear(); queue.splice(0); };
    window.addEventListener('classrecordcacheclearing', clear);
    window.ClassRecordImageLoader = Object.freeze({ request, loadPublic, forget, clear, peek: (key) => memory.get(key) || null, hasPersistentHint: hasHint, decode, maxConcurrent: MAX_CONCURRENT });
})();

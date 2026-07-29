#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const entries = new Map();
const cache = {
    async match(request) { return entries.get(request.url)?.clone() || undefined; },
    async put(request, response) { entries.set(request.url, response.clone()); },
    async delete(request) { return entries.delete(request.url); }
};
let networkRequests = 0;
let inFlight = 0;
let peak = 0;
const window = {
    addEventListener() {},
    localStorage: null,
    caches: { open: async () => cache }
};
const storage = new Map();
const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
};
class MockImage {
    set src(value) {
        this._src = value;
        this.naturalWidth = 1600;
        this.naturalHeight = 900;
        queueMicrotask(() => this.onload?.());
    }
    async decode() {}
}
const context = vm.createContext({
    window,
    location: { origin: 'https://class.example.test' },
    localStorage,
    caches: { open: async () => cache },
    Request,
    Response,
    Headers,
    Blob,
    URL,
    Image: MockImage,
    Promise,
    setTimeout,
    clearTimeout,
    fetch: async () => {
        networkRequests += 1;
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight -= 1;
        return new Response(new Blob(['image']), { status: 200, headers: { 'content-type': 'image/png' } });
    }
});
const source = await readFile(new URL('../js/imageLoader.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
const loader = window.ClassRecordImageLoader;

const [first, second] = await Promise.all([
    loader.loadPublic('background:one', '/one.jpg', { priority: 'high' }),
    loader.loadPublic('background:one', '/one.jpg', { priority: 'high' })
]);
assert.equal(networkRequests, 1, 'same stable key must share an in-flight request');
assert.equal(first.url, second.url, 'deduped callers must receive the same decoded image');
await loader.loadPublic('background:one', '/one.jpg');
assert.equal(networkRequests, 1, 'memory cache must avoid a second download');

loader.clear();
const restored = await loader.loadPublic('background:one', '/one.jpg');
assert.equal(restored.cacheHit, true, 'Cache Storage entry must survive memory clearing');
assert.equal(networkRequests, 1, 'persistent cache hit must avoid a network request');

const staleKey = new Request('https://class.example.test/.classrecord-image-cache/v1/background%3Astale');
await cache.put(staleKey, new Response(new Blob(['old']), {
    headers: { 'x-classrecord-cached-at': new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }
}));
await loader.loadPublic('background:stale', '/stale.jpg');
assert.equal(networkRequests, 2, 'expired persistent entries must be refreshed');

loader.clear();
await Promise.all(Array.from({ length: 10 }, (_, index) => loader.loadPublic(`background:${index}`, `/${index}.jpg`)));
assert.ok(peak <= loader.maxConcurrent, 'image queue must cap parallel network work');
console.log('Passed shared image loader cache, deduplication, expiry, and concurrency checks.');

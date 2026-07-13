#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const signedRequests = [];
const createSignedUrl = async (path, expiresIn, options) => {
    signedRequests.push({ path, expiresIn, options });
    if (path.includes('fallback') && options?.transform) return { data: null, error: new Error('transform unavailable') };
    const variant = options?.transform ? `preview-${options.transform.width}` : 'original';
    return { data: { signedUrl: `https://storage.example.test/${variant}/${path}` }, error: null };
};

class MockImage {
    set src(value) {
        this._src = value;
        this.naturalWidth = value.includes('/preview-') ? 1200 : 4000;
        this.naturalHeight = value.includes('/preview-') ? 1800 : 6000;
        queueMicrotask(() => this.onload?.());
    }
    get src() { return this._src; }
}

const storage = new Map();
const window = {
    CLASS_RECORD_SUPABASE: {
        url: 'https://project.supabase.co',
        anonKey: 'public-anon-key',
        storage: { privateBucket: 'classrecord-private' }
    },
    ClassRecordSupabase: {
        getClient: async () => ({ storage: { from: () => ({ createSignedUrl }) } })
    },
    addEventListener() {}
};
const context = vm.createContext({
    console,
    window,
    Image: MockImage,
    document: { scripts: [], head: { appendChild() {} }, createElement() { return {}; } },
    sessionStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); }
    },
    setTimeout,
    clearTimeout
});

const source = await readFile(new URL('../js/secureData.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
const data = window.ClassRecordData;
const path = 'images/record-pages/01.jpeg';

const previewUrl = await data.preloadAsset(path, {
    priority: 'high',
    transform: data.displayTransforms.written
});
assert.match(previewUrl, /\/preview-1200\//);
assert.deepEqual({ ...signedRequests[0].options.transform }, { width: 1200, height: 1800, quality: 78, resize: 'contain' });
assert.equal(data.getPreloadedAsset(path, { transform: data.displayTransforms.written }).width, 1200);

const originalUrl = await data.signAssetUrl(path);
assert.match(originalUrl, /\/original\//);
assert.notEqual(originalUrl, previewUrl);
assert.equal(signedRequests[1].options, undefined);
assert.equal(await data.signAssetUrl(path), originalUrl);
assert.equal(signedRequests.length, 2, 'original and preview URLs must use separate caches');

await data.signAssetUrl(path, { forceRefresh: true });
assert.equal(signedRequests.length, 3, 'forced original refresh must bypass only the original cache');
assert.equal(signedRequests[2].options, undefined);

const fallbackUrl = await data.preloadAsset('images/record-pages/fallback.jpeg', {
    transform: data.displayTransforms.written
});
assert.match(fallbackUrl, /\/original\//);
const afterFallbackUrl = await data.preloadAsset('images/record-pages/after-fallback.jpeg', {
    transform: data.displayTransforms.written
});
assert.match(afterFallbackUrl, /\/original\//);
assert.equal(signedRequests.at(-1).options, undefined, 'unsupported transformations must fall back without repeated transform failures');

console.log('Passed transformed preview, original URL isolation, refresh, and transformation fallback checks.');

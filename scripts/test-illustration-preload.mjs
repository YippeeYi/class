#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const requested = [];
const sourceCalls = [];
const ready = new Map();
const sourceSizes = new Map([
    ['data/attachments/record.png', { width: 2400, height: 1350 }],
    ['data/attachments/message.jpg', { width: 900, height: 1600 }],
    ['data/attachments/supplement.webp', { width: 1280, height: 720 }],
    ['data/attachments/material.gif', { width: 640, height: 640 }]
]);
const variantKey = (path, options = {}) => `${path}::${options.transform ? 'preview' : 'original'}`;
const makeLoader = (name, value) => async () => {
    sourceCalls.push(name);
    return value;
};
const window = {
    addEventListener() {},
    waitForAccess: async () => ({ verified: true }),
    PeopleStore: { people: [] },
    ClassRecordData: {
        isEnabled: () => true,
        loadRecords: makeLoader('records', [{ content: '[[illu:record.png|记录插图]]' }]),
        loadPageMessages: makeLoader('messages', [{ content: '[[illu:message.jpg|箴言插图]]' }]),
        loadPageSupplements: makeLoader('supplements', [{ content: '[[illu:supplement.webp|补充插图]]' }]),
        loadMaterials: makeLoader('materials', [{ content: '[[illu:material.gif|资料插图]][[illu:record.png|重复]]' }]),
        preloadAsset: async (path, options) => {
            requested.push({ path, options });
            const original = sourceSizes.get(path);
            const preview = options.transform
                ? { width: Math.min(960, original.width), height: Math.round(Math.min(960, original.width) * original.height / original.width) }
                : original;
            const asset = { url: `https://storage.test/${options.transform ? 'preview/' : ''}${path}`, ...preview };
            ready.set(variantKey(path, options), asset);
            return asset.url;
        },
        getPreloadedAsset: (path, options) => ready.get(variantKey(path, options)) || null
    }
};

const context = vm.createContext({
    console,
    window,
    Image: class {},
    URL,
    performance,
    location: { href: 'https://example.test/index.html' },
    sessionStorage: { setItem() {} },
    document: {
        addEventListener() {},
        getElementById() { return null; }
    },
    requestAnimationFrame() {},
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {}
});

const source = await readFile(new URL('../js/recordRenderer.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
const result = await window.ClassRecordIllustrationMetadataPromise;

assert.deepEqual(sourceCalls.sort(), ['materials', 'messages', 'records', 'records', 'supplements', 'supplements']);
assert.deepEqual([...new Set(requested.map((item) => item.path))].sort(), [
    'data/attachments/material.gif',
    'data/attachments/message.jpg',
    'data/attachments/record.png',
    'data/attachments/supplement.webp'
]);
assert.ok(requested.every((item) => item.options.priority === 'low'), 'all illustration preloads must remain low-priority startup work');
assert.ok(requested.some((item) => item.options.transform === null), 'metadata warmup must obtain dimensions from original assets');
assert.ok(requested.some((item) => item.options.transform?.width === 960), 'display thumbnails may warm in parallel with original metadata');
assert.equal(requested.filter((item) => item.options.transform === null).length, 4, 'every unique illustration must have one original metadata request');
assert.equal(requested.filter((item) => item.options.transform?.width === 960).length, 4, 'every unique illustration may warm one display preview in parallel');
assert.deepEqual({ ...result }, { total: 4, loaded: 4 });
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/message.jpg') }, { width: 900, height: 1600, ratio: 9 / 16 });
assert.deepEqual({ ...window.illuSizeCache.get('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });

console.log('Passed all-source illustration metadata and mixed-aspect preload checks.');

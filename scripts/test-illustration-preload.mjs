#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const requested = [];
const sourceCalls = [];
const ready = new Map();
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
            ready.set(path, { url: `https://storage.test/${path}`, width: 800, height: 600 });
            return ready.get(path).url;
        },
        getPreloadedAsset: (path) => ready.get(path) || null
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

assert.deepEqual(sourceCalls.sort(), ['materials', 'messages', 'records', 'supplements']);
assert.deepEqual(requested.map((item) => item.path).sort(), [
    'data/attachments/material.gif',
    'data/attachments/message.jpg',
    'data/attachments/record.png',
    'data/attachments/supplement.webp'
]);
assert.ok(requested.every((item) => item.options.priority === 'low' && item.options.transform?.width === 960), 'metadata warmup must preload the same thumbnail variant used by markers');
assert.deepEqual({ ...result }, { total: 4, loaded: 4 });
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/record.png') }, { width: 800, height: 600 });

console.log('Passed automatic four-source illustration metadata preload checks.');

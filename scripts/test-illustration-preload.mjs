#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const metadataRequests = [];
const sourceCalls = [];
const batchSignCalls = [];
let singleSignCalls = 0;
const sourceSizes = new Map([
    ['data/attachments/record.png', { width: 2400, height: 1350 }],
    ['data/attachments/quote.png', { width: 900, height: 1600 }],
    ['data/attachments/message.png', { width: 1280, height: 720 }],
    ['data/attachments/supplement.png', { width: 720, height: 1280 }],
    ['data/attachments/material.png', { width: 640, height: 640 }],
    ['data/attachments/credits.png', { width: 1024, height: 768 }]
]);
const pngHeader = ({ width, height }) => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
};
const source = (name, value) => async () => {
    sourceCalls.push(name);
    return value;
};
const window = {
    addEventListener() {},
    waitForAccess: async () => ({ verified: true }),
    PeopleStore: { people: [] },
    ClassRecordData: {
        isEnabled: () => true,
        loadRecords: source('records', [{ content: '[[illu:record.png|record]]' }]),
        loadPageMessages: source('messages', [{ content: '[[illu:message.png|message]]' }]),
        loadPageSupplements: source('supplements', [{ content: '[[illu:supplement.png|supplement]]' }]),
        loadMaterials: source('materials', [{ content: '[[illu:material.png|material]]' }]),
        loadCreditsPage: source('credits', { thanks: ['[[illu:credits.png|credits]]'] }),
        signAssetUrls: async (paths) => {
            batchSignCalls.push([...paths]);
            return new Map(paths.map((path) => [path, `https://storage.test/${path}`]));
        },
        signAssetUrl: async (path) => {
            singleSignCalls += 1;
            return `https://storage.test/${path}`;
        }
    },
    loadAllQuotes: source('quotes', [{ quote: '[[illu:quote.png|quote]]' }])
};
window.cacheReadyPromise = Promise.resolve('page-critical-data-ready');

const context = vm.createContext({
    console,
    window,
    Image: class {},
    URL,
    performance,
    location: { href: 'https://example.test/index.html' },
    sessionStorage: { setItem() {} },
    document: { addEventListener() {}, getElementById() { return null; } },
    requestAnimationFrame() {},
    fetch: async (url, options) => {
        const path = new URL(url).pathname.slice(1);
        metadataRequests.push({ path, options });
        const bytes = pngHeader(sourceSizes.get(path));
        return { ok: true, arrayBuffer: async () => bytes.buffer, headers: { get: () => 'image/png' } };
    },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {}
});

const renderer = await readFile(new URL('../js/recordRenderer.js', import.meta.url), 'utf8');
vm.runInContext(renderer, context);
const result = await window.ClassRecordIllustrationMetadataPromise;

assert.deepEqual(sourceCalls.sort(), ['credits', 'materials', 'messages', 'quotes', 'records', 'supplements']);
assert.deepEqual(metadataRequests.map((item) => item.path).sort(), [...sourceSizes.keys()].sort());
assert.ok(metadataRequests.every((item) => item.options.headers.Range === 'bytes=0-65535'), 'all-data warming must request only bounded image headers');
assert.equal(batchSignCalls.flat().length, 6, 'all discovered illustration paths must be batch-signed before metadata fetches');
assert.equal(singleSignCalls, 0, 'all-content metadata warming must not wait for one signed URL at a time');
assert.equal(result.total, 6);
assert.equal(result.loaded, 6);
assert.deepEqual([...result.failedPaths], []);
assert.equal(await window.cacheReadyPromise, 'page-critical-data-ready', 'metadata warming must not block page content');
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });

const wideFrame = window.calculateIllustrationPreviewFrame(2400, 1350, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
const tallFrame = window.calculateIllustrationPreviewFrame(900, 1600, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
assert.equal(wideFrame.ratio, 16 / 9);
assert.equal(tallFrame.ratio, 9 / 16);
console.log('Passed all-content illustration metadata and non-blocking preload checks.');

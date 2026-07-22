#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const metadataRequests = [];
const sourceCalls = [];
const ready = new Map();
const sourceSizes = new Map([
    ['data/attachments/record.png', { width: 2400, height: 1350 }],
    ['hidden/data/attachments/hidden-record.png', { width: 1024, height: 768 }],
    ['data/attachments/message.jpg', { width: 900, height: 1600 }],
    ['data/attachments/supplement.webp', { width: 1280, height: 720 }],
    ['hidden/data/attachments/hidden-supplement.webp', { width: 720, height: 1280 }],
    ['data/attachments/material.gif', { width: 640, height: 640 }]
]);
const pngHeader = ({ width, height }) => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
};
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
        loadRecords: async ({ hidden }) => {
            sourceCalls.push(hidden ? 'hidden-records' : 'records');
            return [{ content: hidden ? '[[illu:hidden/hidden-record.png|隐藏记录插图]]' : '[[illu:record.png|记录插图]]' }];
        },
        loadPageMessages: makeLoader('messages', [{ content: '[[illu:message.jpg|箴言插图]]' }]),
        loadPageSupplements: async ({ hidden }) => {
            sourceCalls.push(hidden ? 'hidden-supplements' : 'supplements');
            return [{ content: hidden ? '[[illu:hidden/hidden-supplement.webp|隐藏补充插图]]' : '[[illu:supplement.webp|补充插图]]' }];
        },
        loadMaterials: makeLoader('materials', [{ content: '[[illu:material.gif|资料插图]][[illu:record.png|重复]]' }]),
        signAssetUrl: async (path) => `https://storage.test/${path}`
    }
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
    document: {
        addEventListener() {},
        getElementById() { return null; }
    },
    requestAnimationFrame() {},
    fetch: async (url, options) => {
        const path = new URL(url).pathname.slice(1);
        metadataRequests.push({ path, options });
        const bytes = pngHeader(sourceSizes.get(path));
        return {
            ok: true,
            arrayBuffer: async () => bytes.buffer,
            headers: { get: () => 'image/png' }
        };
    },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {}
});

const source = await readFile(new URL('../js/recordRenderer.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
const result = await window.ClassRecordIllustrationMetadataPromise;

assert.deepEqual(sourceCalls.sort(), ['hidden-records', 'hidden-supplements', 'materials', 'messages', 'records', 'supplements']);
assert.deepEqual(metadataRequests.map((item) => item.path).sort(), [
    'data/attachments/material.gif',
    'data/attachments/message.jpg',
    'data/attachments/record.png',
    'data/attachments/supplement.webp',
    'hidden/data/attachments/hidden-record.png',
    'hidden/data/attachments/hidden-supplement.webp'
]);
assert.ok(metadataRequests.every((item) => item.options.headers.Range === 'bytes=0-65535'), 'metadata warmup must request only the bounded image header range');
assert.equal(metadataRequests.length, 6, 'every unique illustration must have one metadata request and no preview-image warmup');
assert.equal(result.total, 6);
assert.equal(result.loaded, 6);
assert.deepEqual([...result.failedPaths], []);
assert.deepEqual(Object.fromEntries(Object.entries(result.sourceStates).map(([name, state]) => [name, state.status])), {
    records: 'loaded',
    hiddenRecords: 'loaded',
    pageMessages: 'loaded',
    pageSupplements: 'loaded',
    hiddenPageSupplements: 'loaded',
    materials: 'loaded'
});
assert.equal(await window.cacheReadyPromise, 'page-critical-data-ready', 'page rendering must remain gated by the all-source metadata scan');
assert.equal(window.illuSizeCacheReport.loaded, 6, 'the startup report must expose cache coverage for verification');
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/message.jpg') }, { width: 900, height: 1600, ratio: 9 / 16 });
assert.deepEqual({ ...window.getIllustrationSourceDimensions('hidden/data/attachments/hidden-record.png') }, { width: 1024, height: 768, ratio: 4 / 3 });
assert.deepEqual({ ...window.illuSizeCache.get('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });
const wideFrame = window.calculateIllustrationPreviewFrame(2400, 1350, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
const tallFrame = window.calculateIllustrationPreviewFrame(900, 1600, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
const squareFrame = window.calculateIllustrationPreviewFrame(640, 640, { viewportWidth: 390, viewportHeight: 280, horizontalChrome: 22, verticalChrome: 22 });
const smallFrame = window.calculateIllustrationPreviewFrame(80, 60, { viewportWidth: 390, viewportHeight: 280, horizontalChrome: 22, verticalChrome: 22 });
assert.equal(wideFrame.ratio, 16 / 9, 'wide previews must retain their cached source ratio');
assert.equal(tallFrame.ratio, 9 / 16, 'tall previews must retain their cached source ratio');
assert.equal(squareFrame.ratio, 1, 'small-screen previews must retain square source ratio');
assert.equal(smallFrame.ratio, 4 / 3, 'small source images must retain their cached source ratio');
assert.ok(squareFrame.tooltipWidth <= 366 && squareFrame.tooltipHeight <= 256, 'the fixed frame must remain wholly inside a narrow viewport without cropping');

console.log('Passed all-source illustration metadata and mixed-aspect preload checks.');

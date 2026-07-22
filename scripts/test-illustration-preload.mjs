#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const metadataRequests = [];
const pngHeader = (width, height) => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
};

const window = {
    addEventListener() {},
    PeopleStore: { people: [] },
    ClassRecordData: {
        isEnabled: () => true,
        signAssetUrl: async (path) => `https://storage.test/${path}`
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
    fetch: async (url, options) => {
        const path = new URL(url).pathname.slice(1);
        metadataRequests.push({ path, options });
        const bytes = pngHeader(2400, 1350);
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

assert.equal(window.ClassRecordIllustrationMetadataPromise, undefined, 'page startup must not scan every historical illustration');
assert.equal(metadataRequests.length, 0, 'loading the renderer alone must not request illustration metadata');

const result = await window.preloadIllustrationsFromContent('[ [ignored] ] [[illu:record.png|record illustration]] [[illu:record.png|duplicate]]');
assert.equal(metadataRequests.length, 1, 'visible content must warm each illustration path once');
assert.equal(metadataRequests[0].path, 'data/attachments/record.png');
assert.equal(metadataRequests[0].options.headers.Range, 'bytes=0-65535', 'metadata warming must request only a bounded image header range');
assert.equal(result.total, 1);
assert.equal(result.loaded, 1);
assert.deepEqual([...result.failedPaths], []);
assert.deepEqual({ ...window.getIllustrationSourceDimensions('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });
assert.deepEqual({ ...window.illuSizeCache.get('data/attachments/record.png') }, { width: 2400, height: 1350, ratio: 16 / 9 });

const wideFrame = window.calculateIllustrationPreviewFrame(2400, 1350, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
const tallFrame = window.calculateIllustrationPreviewFrame(900, 1600, { viewportWidth: 1200, viewportHeight: 800, horizontalChrome: 22, verticalChrome: 22 });
const squareFrame = window.calculateIllustrationPreviewFrame(640, 640, { viewportWidth: 390, viewportHeight: 280, horizontalChrome: 22, verticalChrome: 22 });
assert.equal(wideFrame.ratio, 16 / 9, 'wide previews must retain their cached source ratio');
assert.equal(tallFrame.ratio, 9 / 16, 'tall previews must retain their cached source ratio');
assert.equal(squareFrame.ratio, 1, 'small-screen previews must retain square source ratio');
assert.ok(squareFrame.tooltipWidth <= 366 && squareFrame.tooltipHeight <= 256, 'the fixed frame must remain wholly inside a narrow viewport without cropping');

console.log('Passed on-demand illustration metadata and mixed-aspect preview checks.');

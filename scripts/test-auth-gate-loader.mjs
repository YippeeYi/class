#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const listeners = new Map();
const staticImageLoader = {
    src: 'https://class.example.test/js/imageLoader.js',
    dataset: {},
    addEventListener() { throw new Error('an already-loaded static image script must not be awaited'); }
};
const window = {
    location: { pathname: '/auth.html', href: 'https://class.example.test/auth.html', replace() {} },
    ClassRecordImageLoader: {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent() {},
    clearAllSiteCache: async () => {}
};
const document = {
    scripts: [staticImageLoader],
    documentElement: { classList: { add() {}, remove() {} } },
    createElement() { return { dataset: {}, addEventListener() {} }; },
    head: {
        appendChild(script) {
            if (script.src.endsWith('supabaseClient.js')) {
                window.ClassRecordSupabase = { isConfigured: () => true };
            }
            queueMicrotask(() => script.onload?.());
        }
    }
};
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const context = vm.createContext({ window, document, localStorage: storage, sessionStorage: storage, URL, Promise, setTimeout, clearTimeout, queueMicrotask, Event: class {}, CustomEvent: class {} });
const source = await readFile(new URL('../js/authGate.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
const result = await Promise.race([
    window.waitForAccess(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('auth gate remained pending')), 100))
]);
assert.equal(result.verified, true);
console.log('Passed auth gate handling for an already-executed shared image loader.');

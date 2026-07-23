#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/cacheLoader.js', import.meta.url), 'utf8');
const storage = new Map();

function createRuntime() {
    const listeners = new Map();
    const window = {
        addEventListener(type, callback) {
            listeners.set(type, callback);
        }
    };
    const context = vm.createContext({
        window,
        sessionStorage: {
            getItem(key) { return storage.get(key) || null; },
            setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        Date,
        JSON,
        Map,
        Promise,
        Number
    });
    vm.runInContext(source, context);
    return { window, listeners };
}

let firstLoads = 0;
const firstPage = createRuntime();
const firstResult = await firstPage.window.loadWithCache({
    key: 'records:visible',
    sessionExpire: 60_000,
    loader: async () => {
        firstLoads += 1;
        return [{ id: 'r-1', content: 'cached content' }];
    }
});
assert.equal(firstLoads, 1);
assert.equal(firstResult[0].id, 'r-1');
assert.ok(storage.has('classRecord:dataCache:v2:records:visible'), 'public data must be cached for the current browser session');

const secondPage = createRuntime();
const cachedResult = await secondPage.window.loadWithCache({
    key: 'records:visible',
    sessionExpire: 60_000,
    loader: async () => {
        throw new Error('a warm session cache must not fetch the same public data again');
    }
});
assert.equal(cachedResult[0].content, 'cached content');

let privateLoads = 0;
await secondPage.window.loadWithCache({
    key: 'records:hidden',
    sessionExpire: 0,
    loader: async () => {
        privateLoads += 1;
        return [{ id: 'hidden-1' }];
    }
});
const thirdPage = createRuntime();
await thirdPage.window.loadWithCache({
    key: 'records:hidden',
    sessionExpire: 0,
    loader: async () => {
        privateLoads += 1;
        return [{ id: 'hidden-1' }];
    }
});
assert.equal(privateLoads, 2, 'hidden records must never be persisted in the session data cache');

console.log('Passed session data cache reuse and private-data exclusion checks.');

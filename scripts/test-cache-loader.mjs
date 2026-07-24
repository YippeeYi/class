#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/cacheLoader.js', import.meta.url), 'utf8');
const storage = new Map();
const localStorage = new Map([['classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: 'test-access-token', authorizedAt: '2026-07-24T00:00:00.000Z' })]]);

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
        localStorage: {
            getItem(key) { return localStorage.get(key) || null; }
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
assert.ok(storage.has('classRecord:dataCache:v4:access-2026-07-24T00:00:00.000Z:records:visible'), 'access-scoped data must be cached for the current browser session');

const secondPage = createRuntime();
const cachedResult = await secondPage.window.loadWithCache({
    key: 'records:visible',
    sessionExpire: 60_000,
    loader: async () => {
        throw new Error('a warm session cache must not fetch the same public data again');
    }
});
assert.equal(cachedResult[0].content, 'cached content');

localStorage.set('classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: 'new-test-access-token', authorizedAt: '2026-07-25T00:00:00.000Z' }));
const changedAccessPage = createRuntime();
let changedAccessLoads = 0;
await changedAccessPage.window.loadWithCache({
    key: 'records:visible',
    sessionExpire: 60_000,
    loader: async () => { changedAccessLoads += 1; return [{ id: 'r-2' }]; }
});
assert.equal(changedAccessLoads, 1, 'a new invite access session must not reuse an earlier session cache');

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

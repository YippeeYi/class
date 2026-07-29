#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'js/quizSecretImage.js'), 'utf8');
const ready = new Map();
let cacheReads = 0;
let preloadCalls = 0;
let invalidations = 0;
let deferredResolve;
let failNext = false;

const sandbox = {
  window: {
    addEventListener() {},
    ClassRecordData: {
      normalizePrivateStoragePath: (path) => String(path || '').replace(/^\/+/, ''),
      getPreloadedAsset: (path) => ready.get(path) || null,
      readCachedAsset: async (path) => {
        cacheReads += 1;
        return path === 'images/quiz/persisted.png' ? { url: 'blob:persisted', width: 1200, height: 800 } : null;
      },
      invalidatePreloadedAsset: async (path) => {
        invalidations += 1;
        ready.delete(path);
      },
      preloadAsset: async (path, options) => {
        preloadCalls += 1;
        if (failNext) {
          failNext = false;
          throw new Error('network failed');
        }
        if (path === 'images/quiz/concurrent.png') {
          await new Promise((resolve) => { deferredResolve = resolve; });
        }
        const asset = { url: `blob:${path}`, width: 1200, height: 800 };
        ready.set(path, asset);
        assert.equal(options.priority, 'high');
        return asset.url;
      }
    }
  }
};
vm.runInNewContext(source, sandbox, { filename: 'quizSecretImage.js' });
const loader = sandbox.window.ClassRecordQuizSecretImage;

ready.set('images/quiz/memory.png', { url: 'blob:memory', width: 640, height: 480 });
assert.equal(loader.getMemoryAsset('/images/quiz/memory.png').url, 'blob:memory', 'stable private paths must find the in-memory cache immediately');
assert.equal((await loader.load('images/quiz/memory.png')).cacheHit, true, 'memory cache hits must not request a signed asset');
assert.equal(preloadCalls, 0, 'memory cache hits must not download again');

const persisted = await loader.readCachedAsset('images/quiz/persisted.png');
assert.equal(persisted.url, 'blob:persisted', 'a persistent private cache hit must be surfaced before a network load');
assert.equal(preloadCalls, 0, 'persistent cache probes must not download an image');

const first = loader.load('images/quiz/concurrent.png');
const second = loader.load('/images/quiz/concurrent.png');
await new Promise((resolve) => setImmediate(resolve));
assert.equal(preloadCalls, 1, 'concurrent callers for one stable resource must share one preload');
deferredResolve();
const [one, two] = await Promise.all([first, second]);
assert.equal(one.asset.url, two.asset.url, 'concurrent callers must receive the same ready asset');

failNext = true;
await assert.rejects(loader.load('images/quiz/retry.png'), /network failed/, 'failed loads must reject so the UI can render a retry state');
const retried = await loader.load('images/quiz/retry.png', { force: true });
assert.equal(retried.cacheHit, false, 'retry must request a fresh asset instead of returning the failed result');
assert.equal(invalidations, 1, 'retry must clear the scoped stale asset before reloading');
assert.ok(cacheReads >= 3, 'cache reads must precede normal network loads');

console.log('Passed hidden quiz image cache-hit, persistence, de-duplication, and retry checks.');

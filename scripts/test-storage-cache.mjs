import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { privateAssetCacheControl, repairStorageCache } from './storage-cache.mjs';
assert.equal(privateAssetCacheControl('images/record-pages/01.jpeg'), 'private, max-age=180');
assert.equal(privateAssetCacheControl('images/quiz/a.jpg'), 'private, max-age=180');
assert.equal(privateAssetCacheControl('hidden/a.jpg'), 'private, max-age=180');
assert.equal(privateAssetCacheControl('data/attachments/a.jpg'), 'private, max-age=600');
const root = await mkdtemp(path.join(os.tmpdir(), 'class-storage-cache-'));
const bytes = Buffer.from('unchanged fixture image');
let writes = 0;
let cacheControl = '3600';
const request = async (url, options = {}) => {
    if (url.includes('/list/')) return [{ name: 'fixture.jpg', metadata: { cacheControl, size: bytes.length, eTag: createHash('md5').update(bytes).digest('hex') } }, { name: 'correct.jpg', metadata: { cacheControl: 'private, max-age=600' } }];
    if (url.includes('/info/')) return { cache_control: cacheControl, size: bytes.length, content_type: 'image/jpeg', version: 'v1', etag: 'same-hash', metadata: { attribution: 'preserved' } };
    if (options.method === 'PUT') {
        writes++;
        assert.deepEqual(options.body, bytes);
        assert.deepEqual(JSON.parse(Buffer.from(options.headers['x-metadata'], 'base64')), { attribution: 'preserved' });
        cacheControl = options.headers['Cache-Control'];
        return {};
    }
    assert.equal(options.responseType, 'buffer');
    return bytes;
};
try {
    assert.deepEqual(await repairStorageCache({ request, root, bucket: 'private' }), { planned: 1, repaired: 0 });
    assert.equal(writes, 0);
    const result = await repairStorageCache({ request, root, bucket: 'private', apply: true });
    assert.equal(result.repaired, 1);
    assert.deepEqual(await readFile(path.join(root, result.backup, 'fixture.jpg')), bytes);
    assert.equal(writes, 1);
    assert.deepEqual(await repairStorageCache({ request, root, bucket: 'private', apply: true }), { planned: 0, repaired: 0 });
    assert.equal(writes, 1, 'reruns must not re-upload repaired resources');
    console.log('Storage cache repair passed: valid private headers, dry run, backup, unchanged bytes/metadata and idempotence.');
} finally { await rm(root, { recursive: true, force: true }); }

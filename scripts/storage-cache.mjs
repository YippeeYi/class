import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export function privateAssetCacheControl(asset) {
    const sensitive = asset === 'images/private/meal-map.png'
        || /^(hidden\/|images\/(record-pages|quiz)\/)/u.test(asset);
    return `private, max-age=${sensitive ? 180 : 600}`;
}

// Repair only malformed legacy headers. Live bytes are backed up and re-uploaded
// unchanged via Storage's API; never write directly to storage.objects.
export async function repairStorageCache({ request, bucket, root, apply = false }) {
    const targets = [];
    const walk = async (prefix = '') => {
        for (let offset = 0; ; offset += 1000) {
            const rows = await request(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefix, offset, limit: 1000, sortBy: { column: 'name', order: 'asc' } })
            });
            for (const row of rows) {
                assert.ok(row.name && !/[\\/]/u.test(row.name) && row.name !== '.' && row.name !== '..');
                const asset = prefix ? `${prefix}/${row.name}` : row.name;
                if (row.metadata === null) await walk(asset);
                else if (/^\d+$/u.test(row.metadata?.cacheControl || '')) targets.push(asset);
            }
            if (rows.length < 1000) break;
        }
    };
    await walk();
    if (!apply || !targets.length) return { planned: targets.length, repaired: 0 };
    const backup = path.join(root, 'private-assets', 'backups', `storage-cache-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(backup, { recursive: true });
    let repaired = 0;
    // Serial maintenance avoids competing with normal viewers or overwriting a
    // resource changed since it was downloaded. Partial runs are safely resumable.
    for (const asset of targets) {
        const encoded = `${encodeURIComponent(bucket)}/${asset.split('/').map(encodeURIComponent).join('/')}`;
        const freshInfo = () => request(`/storage/v1/object/info/${encoded}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        const info = await freshInfo();
        if (!/^\d+$/u.test(info.cache_control || '')) continue;
        assert.ok(!info.is_versioned, 'Versioned objects require a separate version-aware migration');
        const bytes = await request(`/storage/v1/object/${encoded}`, { responseType: 'buffer' });
        assert.equal(bytes.length, info.size, 'Object changed while reading');
        const destination = path.join(backup, asset);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, bytes);
        await fs.writeFile(`${destination}.metadata.json`, JSON.stringify({ ...info, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
        const current = await freshInfo();
        assert.equal(current.version, info.version, 'Object changed during backup; stop before overwriting');
        await request(`/storage/v1/object/${encoded}`, {
            method: 'PUT',
            headers: {
                'Content-Type': info.content_type,
                'Cache-Control': privateAssetCacheControl(asset),
                'x-metadata': Buffer.from(JSON.stringify(info.metadata || {})).toString('base64')
            },
            body: bytes
        });
        const listing = await request(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: path.posix.dirname(asset) === '.' ? '' : path.posix.dirname(asset), search: path.posix.basename(asset), limit: 100 })
        });
        const verified = listing.find((item) => item.name === path.posix.basename(asset))?.metadata;
        assert.equal(verified?.cacheControl, privateAssetCacheControl(asset));
        assert.equal(verified.size, info.size);
        assert.equal(verified.eTag.replaceAll('"', ''), createHash('md5').update(bytes).digest('hex'), 'Image bytes must remain identical');
        repaired++;
        if (repaired % 10 === 0) console.log(`Storage cache headers repaired: ${repaired}/${targets.length}`);
    }
    return { planned: targets.length, repaired, backup: path.relative(root, backup) };
}

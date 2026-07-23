#!/usr/bin/env node
/* Upload the ignored local meal map to the existing private bucket. This
 * script never prints credentials, the remote object key, or signed URLs. */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = String(process.env.CLASS_RECORD_BUCKET || 'classrecord-private').trim();
const candidates = ['map.png'];

if (!url || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load the local .env values, then retry.');
    process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(bucket)) {
    console.error('CLASS_RECORD_BUCKET is invalid.');
    process.exit(1);
}

const sources = [];
for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if ((await fs.stat(file).catch(() => null))?.isFile()) sources.push(file);
}
if (sources.length === 0) {
    console.error('Missing local map.png. Keep the original file in the project root; it is intentionally ignored by Git.');
    process.exit(1);
}
if (sources.length > 1) {
    console.error('Found both map.png and map.PNG. Keep exactly one source file so the intended image is unambiguous.');
    process.exit(1);
}

const source = sources[0];
const body = await fs.readFile(source);
if (body.length < 24 || body.subarray(0, 8).compare(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) !== 0) {
    console.error('map.png is not a valid PNG file. No upload was attempted.');
    process.exit(1);
}
const width = body.readUInt32BE(16);
const height = body.readUInt32BE(20);
if (!width || !height) {
    console.error('map.png has invalid dimensions. No upload was attempted.');
    process.exit(1);
}

const request = async (endpoint, options = {}) => {
    let response;
    try {
        response = await fetch(`${url}${endpoint}`, {
            ...options,
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, ...(options.headers || {}) }
        });
    } catch {
        throw new Error('Network request failed. Check SUPABASE_URL and your connection.');
    }
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('Supabase authorization failed. Check that the local service-role key is current.');
        throw new Error(`Supabase request failed (HTTP ${response.status}).`);
    }
    return response;
};

try {
    await request(`/storage/v1/object/${encodeURIComponent(bucket)}/images/private/meal-map.png`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=180', 'x-upsert': 'true' },
        body
    });
    await request('/rest/v1/class_private_assets?on_conflict=asset_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ asset_key: 'meal-map', width, height, updated_at: new Date().toISOString() }])
    });
    console.log(`Meal map uploaded successfully (${width}×${height}, image/png).`);
} catch (error) {
    console.error(`Meal map upload failed: ${error.message}`);
    process.exitCode = 1;
}

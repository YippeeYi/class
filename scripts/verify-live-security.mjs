#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const configSource = await readFile(new URL('js/supabaseConfig.js', root), 'utf8');
const url = configSource.match(/\burl:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, '');
const anonKey = configSource.match(/\banonKey:\s*["']([^"']+)["']/)?.[1];
const bucket = configSource.match(/\bprivateBucket:\s*["']([^"']+)["']/)?.[1] || 'classrecord-private';
const assetArgument = process.argv.find((value) => value.startsWith('--asset='));
const knownAsset = assetArgument?.slice('--asset='.length) || 'images/quiz/lamian/01.png';

assert.ok(url && anonKey, 'Unable to read Supabase URL/anon key from js/supabaseConfig.js');
assert.ok(!knownAsset.includes('..') && !knownAsset.startsWith('/'), 'Invalid --asset path');

const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
};

const request = (path, options = {}) => fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
});

const listResponse = await request(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 100, offset: 0 })
});
if (listResponse.ok) {
    const listed = await listResponse.json();
    assert.deepEqual(listed, [], 'FAIL: unauthenticated anon request can list private Storage objects');
}

const objectPath = knownAsset.split('/').map(encodeURIComponent).join('/');
const downloadResponse = await request(`/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${objectPath}`);
assert.equal(downloadResponse.ok, false, 'FAIL: unauthenticated anon request can download a private object');

const signResponse = await request(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 })
});
if (signResponse.ok) {
    const signed = await signResponse.json();
    assert.ok(!signed?.signedURL && !signed?.signedUrl, 'FAIL: unauthenticated anon request can create a signed URL');
}

const contentTables = [
    'class_records',
    'class_people',
    'class_record_pages',
    'class_page_messages',
    'class_page_supplements',
    'class_materials',
    'class_quiz_questions',
    'class_credits_page'
];

for (const table of contentTables) {
    const response = await request(`/rest/v1/${table}?select=*&limit=1`, {
        headers: { Accept: 'application/json' }
    });
    if (!response.ok) continue;
    const rows = await response.json();
    assert.deepEqual(rows, [], `FAIL: unauthenticated anon request can read ${table}`);
}

console.log(`PASS: unauthenticated anon cannot list, download, sign ${knownAsset}, or read protected tables.`);

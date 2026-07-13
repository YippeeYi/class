#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const configSource = await readFile(new URL('js/supabaseConfig.js', root), 'utf8');
const url = configSource.match(/\burl:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, '');
const anonKey = configSource.match(/\banonKey:\s*["']([^"']+)["']/)?.[1];
const bucket = configSource.match(/\bprivateBucket:\s*["']([^"']+)["']/)?.[1] || 'classrecord-private';
const assetArgument = process.argv.find((value) => value.startsWith('--asset='));
const knownAsset = assetArgument?.slice('--asset='.length) || 'images/record-pages/01.jpeg';
const sensitiveAsset = 'images/quiz/lamian/01.png';
const accessToken = String(process.env.CLASS_RECORD_ACCESS_TOKEN || '').trim();
const invalidToken = '0'.repeat(64);

assert.ok(url && anonKey, 'Unable to read Supabase URL/anon key from js/supabaseConfig.js');
assert.ok(!knownAsset.includes('..') && !knownAsset.startsWith('/'), 'Invalid --asset path');

const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
};

const request = (path, options = {}, token = '') => fetch(`${url}${path}`, {
    ...options,
    headers: {
        ...headers,
        ...(token ? { 'x-class-record-access': token } : {}),
        ...(options.headers || {})
    }
});

const signObject = async (token, expiresIn, assetPath = knownAsset) => {
    const encodedPath = assetPath.split('/').map(encodeURIComponent).join('/');
    const response = await request(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn })
    }, token);
    const body = await response.json().catch(() => ({}));
    return { response, signedUrl: body?.signedURL || body?.signedUrl || '' };
};

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

const unauthorizedSign = await signObject('', 60);
assert.ok(!unauthorizedSign.response.ok || !unauthorizedSign.signedUrl, 'FAIL: unauthenticated anon request can create a signed URL');

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

const invalidAccessResponse = await request('/rest/v1/rpc/has_class_record_access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
}, invalidToken);
assert.equal(invalidAccessResponse.ok, true, 'invalid-token access RPC failed unexpectedly');
assert.equal(await invalidAccessResponse.json(), false, 'FAIL: a fabricated localStorage token obtained access');

const invalidRecordResponse = await request('/rest/v1/class_records?select=id&limit=1', {
    headers: { Accept: 'application/json' }
}, invalidToken);
if (invalidRecordResponse.ok) {
    assert.deepEqual(await invalidRecordResponse.json(), [], 'FAIL: a fabricated bearer token can read records');
}

console.log(`PASS: unauthenticated and fabricated-token requests cannot list, download, sign ${knownAsset}, or read protected tables.`);

if (accessToken) {
    assert.equal(accessToken.length, 64, 'CLASS_RECORD_ACCESS_TOKEN must be the 64-character browser access token');
    const accessResponse = await request('/rest/v1/rpc/has_class_record_access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    }, accessToken);
    assert.equal(accessResponse.ok, true, 'authorized access RPC failed');
    assert.equal(await accessResponse.json(), true, 'provided access token is expired or revoked');

    const adminResponse = await request('/rest/v1/rpc/has_class_record_admin_access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    }, accessToken);
    assert.equal(adminResponse.ok, true, 'administrator access RPC failed');
    const isAdmin = await adminResponse.json();

    const recordResponse = await request('/rest/v1/class_records?select=id&limit=1', {
        headers: { Accept: 'application/json' }
    }, accessToken);
    assert.equal(recordResponse.ok, true, 'authorized token could not query ordinary records');

    const authorizedSign = await signObject(accessToken, 5);
    assert.equal(authorizedSign.response.ok, true, 'authorized token could not sign the known ordinary asset');
    assert.ok(authorizedSign.signedUrl, 'authorized signing returned no URL');
    const signedTarget = new URL(authorizedSign.signedUrl, url).href;
    const immediateDownload = await fetch(signedTarget, { redirect: 'follow' });
    assert.equal(immediateDownload.ok, true, 'newly signed URL did not download immediately');
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const expiredDownload = await fetch(signedTarget, { redirect: 'follow' });
    assert.equal(expiredDownload.ok, false, 'short-lived signed URL remained usable after expiry');

    const quizResponse = await request('/rest/v1/class_quiz_questions?select=id&limit=1', {
        headers: { Accept: 'application/json' }
    }, accessToken);
    assert.equal(quizResponse.ok, true, 'quiz permission query failed');
    const quizRows = await quizResponse.json();
    const sensitiveSign = await signObject(accessToken, 5, sensitiveAsset);
    if (isAdmin) {
        assert.ok(Array.isArray(quizRows) && quizRows.length > 0, 'admin token could not read hidden quiz rows');
        assert.ok(sensitiveSign.response.ok && sensitiveSign.signedUrl, 'admin token could not sign a hidden quiz image');
    } else {
        assert.deepEqual(quizRows, [], 'normal token can read admin-only hidden quiz rows');
        assert.ok(!sensitiveSign.response.ok || !sensitiveSign.signedUrl, 'normal token can sign an admin-only hidden quiz image');
    }

    console.log(`PASS: authorized ${isAdmin ? 'admin' : 'normal'} token, Storage boundary, and signed URL expiry checks passed.`);
}

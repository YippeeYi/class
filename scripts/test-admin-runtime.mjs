import assert from 'node:assert/strict';

import { createAdminRequest, parseAdminArguments } from './admin-runtime.mjs';

const audit = parseAdminArguments(['audit', '--json']);
assert.equal(audit.command, 'audit');
assert.equal(audit.validateOnly, true);
assert.equal(audit.dryRun, false);
assert.deepEqual(audit.commandArgs, ['--json']);

const publication = parseAdminArguments(['publish', '--confirm-publish']);
assert.equal(publication.confirmPublish, true);
assert.equal(publication.validateOnly, false);
assert.equal(publication.shouldPrune, true);

assert.equal(parseAdminArguments(['upload', '--concurrency=99']).uploadConcurrency, 8);
assert.equal(parseAdminArguments(['upload', '--concurrency=0']).uploadConcurrency, 3);
assert.equal(parseAdminArguments(['upload', '--concurrency=1']).uploadConcurrency, 1);

let attempts = 0;
const waits = [];
const requests = [];
const request = createAdminRequest({
    url: 'https://example.supabase.co/',
    serviceRoleKey: 'service-key',
    fetchImpl: async (url, options) => {
        attempts += 1;
        requests.push({ url, options });
        if (attempts < 3) return { ok: false, status: 503 };
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ ok: true })
        };
    },
    wait: async (milliseconds) => waits.push(milliseconds)
});

assert.deepEqual(await request('/rest/v1/example', { headers: { Prefer: 'return=minimal' } }), { ok: true });
assert.equal(attempts, 3);
assert.deepEqual(waits, [250, 500]);
assert.equal(requests[0].url, 'https://example.supabase.co/rest/v1/example');
assert.deepEqual(requests[0].options.headers, {
    apikey: 'service-key',
    Authorization: 'Bearer service-key',
    Prefer: 'return=minimal'
});

let badRequestAttempts = 0;
const badRequest = createAdminRequest({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-key',
    fetchImpl: async () => {
        badRequestAttempts += 1;
        return { ok: false, status: 400 };
    },
    wait: async () => assert.fail('non-retryable responses must not wait')
});
await assert.rejects(() => badRequest('/rest/v1/example'), /HTTP 400/);
assert.equal(badRequestAttempts, 1);

console.log('Admin runtime checks passed.');

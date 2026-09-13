import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { createAdminRequest, parseAdminArguments } from './admin-runtime.mjs';

const audit = parseAdminArguments(['audit', '--json']);
assert.equal(audit.command, 'audit');
assert.equal(audit.validateOnly, true);
assert.deepEqual(audit.commandArgs, ['--json']);

const publication = parseAdminArguments(['publish', '--confirm-publish']);
assert.equal(publication.confirmPublish, true);
assert.equal(publication.validateOnly, false);
assert.equal(publication.shouldPrune, true);

assert.equal(publication.uploadConcurrency, 3);
assert.equal(parseAdminArguments(['publish']).validateOnly, true);

// Exercise npm's actual argument forwarding without loading credentials or
// invoking the real publisher. The temporary admin script only prints argv.
if (process.env.npm_execpath) {
    const fixture = await mkdtemp(path.join(tmpdir(), 'class-content-cli-'));
    try {
        const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
        await mkdir(path.join(fixture, 'scripts'));
        await writeFile(path.join(fixture, 'package.json'), JSON.stringify({
            private: true,
            scripts: {
                'content:audit': scripts['content:audit'],
                'content:plan': scripts['content:plan'],
                'content:publish': scripts['content:publish']
            }
        }));
        await writeFile(path.join(fixture, 'scripts/admin.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)));');
        for (const [name, expected] of [
            ['content:audit', ['audit']],
            ['content:plan', ['publish']],
            ['content:publish', ['publish', '--confirm-publish']]
        ]) {
            const { stdout, stderr } = await promisify(execFile)(process.execPath, [
                process.env.npm_execpath, '--prefix', fixture, 'run', '--silent', name
            ], { cwd: fixture });
            assert.deepEqual(JSON.parse(stdout.trim()), expected, `${name} must forward the publisher arguments`);
            assert.doesNotMatch(stderr, /Unknown cli config/i, `${name} must not pass publisher flags to npm`);
        }
        console.log('Content npm commands forward audit/plan/publish arguments without CLI warnings.');
    } finally {
        await rm(fixture, { recursive: true, force: true });
    }
}

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

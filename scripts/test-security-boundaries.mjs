#!/usr/bin/env node

import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const [setupSql, checkSql, uploader, secureData, authGate, gitignore] = await Promise.all([
    read('sql/setup.sql'), read('sql/check.sql'), read('scripts/admin.mjs'),
    read('js/secureData.js'), read('js/authGate.js'), read('.gitignore')
]);

assert.match(setupSql, /create table if not exists public\.class_records/, 'setup must create content tables');
assert.match(setupSql, /create policy "classrecord_private_read"[\s\S]*has_class_record_access\(\)[\s\S]*has_class_record_admin_access\(\)/, 'Storage reads must require invite access and admin access for restricted paths');
assert.match(setupSql, /create table if not exists public\.class_private_assets/, 'setup must create private asset metadata');
assert.match(setupSql, /invite_request_fingerprint[\s\S]*rapid_origin_change/, 'setup must include the final session hardening');
assert.match(checkSql, /storage_select_policy_count = 1/, 'check must audit the single Storage SELECT policy');
assert.match(checkSql, /content\.no_anon_write_grant/, 'check must audit anonymous write grants');
assert.match(checkSql, /schema\.quiz_required_columns/, 'check must audit schema drift');
assert.match(uploader, /const contentRoot = 'private-assets\/content'/, 'uploader must use the private source root');
assert.match(uploader, /--confirm-prune/, 'remote pruning must require explicit confirmation');
assert.match(uploader, /MAX_REQUEST_ATTEMPTS = 3/, 'uploader must bound network retries');
assert.match(uploader, /uploadConcurrency/, 'uploader must control upload concurrency');
assert.match(uploader, /invites generate/, 'the unified admin entry point must generate one-time invite codes');
assert.match(uploader, /invites list/, 'the unified admin entry point must list invite-code usage states');
assert.match(uploader, /invites check/, 'the unified admin entry point must check one invite code by its peppered hash');
assert.match(uploader, /const select = 'id,used,used_at,expires_at,access_level,note,created_at'/, 'invite lists must exclude code hashes');
assert.doesNotMatch(uploader, /SUPABASE_SERVICE_ROLE_KEY[^\n]*console\.log/, 'uploader must not log service keys');
assert.doesNotMatch(secureData, /sessionStorage\.setItem\(SIGNED_URL_SESSION_KEY/, 'signed URLs must stay memory-only');
assert.match(secureData, /sensitiveSignedUrlExpiresIn/, 'sensitive assets must have a shorter URL lifetime');
assert.match(authGate, /refreshInviteAccess/, 'access must be revalidated by the server');
assert.match(gitignore, /^private-assets\/$/m, 'all private sources must be ignored');

const sqlFiles = (await readdir(new URL('sql/', root))).filter((name) => name.endsWith('.sql')).sort();
assert.deepEqual(sqlFiles, ['check.sql', 'setup.sql'], 'only the final setup and check SQL files may remain');
await access(new URL('private-assets/', root));
console.log('Passed final SQL, upload, cache-boundary, and private-source checks.');

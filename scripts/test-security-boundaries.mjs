#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const listFiles = async (directory = '.') => {
    const entries = await readdir(new URL(`${directory.replace(/\/$/, '')}/`, root), { withFileTypes: true });
    const output = [];
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'private-assets') continue;
        const relative = directory === '.' ? entry.name : `${directory}/${entry.name}`;
        if (entry.isDirectory()) output.push(...await listFiles(relative));
        else if (entry.isFile()) output.push(relative);
    }
    return output;
};

const [setupSql, checkSql, phase2Sql, finalAccessSql, migration, secureData, quizApp, authGate, siteCache] = await Promise.all([
    read('docs/supabase-setup.sql'),
    read('docs/supabase-security-check.sql'),
    read('docs/supabase-phase2-security.sql'),
    read('docs/supabase-final-access-security.sql'),
    read('scripts/migrate-secure-content.mjs'),
    read('js/secureData.js'),
    read('js/quizApp.js'),
    read('js/authGate.js'),
    read('js/siteCache.js')
]);

assert.match(setupSql, /where n\.nspname = 'storage'[\s\S]*c\.relname = 'objects'[\s\S]*drop policy if exists %I on storage\.objects/, 'setup must remove every historical Storage policy');
assert.match(setupSql, /create policy "classrecord_private_read"[\s\S]*bucket_id = 'classrecord-private'[\s\S]*has_class_record_access\(\)[\s\S]*name !~ '\^hidden\/'[\s\S]*has_class_record_admin_access\(\)/, 'the only Storage read policy must enforce invite and hidden-prefix admin access');
assert.match(setupSql, /name ~ '\^\(data\/attachments\/\|images\/record-pages\/\)/, 'ordinary Storage reads must be restricted to explicit binary roots');
assert.match(setupSql, /name ~ '\^images\/quiz\/[\s\S]*has_class_record_admin_access\(\)/, 'quiz images must require administrator access');
assert.match(setupSql, /create policy "class_quiz_questions_read"[\s\S]*has_class_record_access\(\)[\s\S]*has_class_record_admin_access\(\)/, 'quiz rows must require administrator access');
assert.match(setupSql, /alter table public\.class_quiz_questions[\s\S]*add column if not exists content_key text/, 'setup reruns must upgrade legacy quiz schemas');
assert.match(setupSql, /notify pgrst, 'reload schema'/, 'setup must refresh the PostgREST schema cache');
assert.doesNotMatch(setupSql, /name !~ '\(\^\|\/\)H\[0-9\]/, 'Storage authorization must not depend on Hxx file names');
assert.match(setupSql, /revoke all on public\.class_records from public, anon, authenticated/, 'content table write grants must be reset');
assert.match(setupSql, /c\.relname in \([\s\S]*'invite_codes'[\s\S]*drop policy if exists %I on %I\.%I/, 'private invite tables must have historical policies removed');

assert.match(checkSql, /storage_select_policy_count = 1 and storage_only_allowed_policy_ok/, 'security audit must require exactly one allowed Storage SELECT policy');
assert.match(checkSql, /storage\.no_extra_select_policy/, 'security audit must fail additional Storage SELECT policies');
assert.match(checkSql, /content\.no_anon_write_grant/, 'security audit must check anon database write grants');
assert.match(checkSql, /content\.no_write_policy/, 'security audit must reject database write policies');
assert.match(checkSql, /private\.no_policy/, 'security audit must reject old policies on private invite tables');
assert.match(checkSql, /content\.admin_only_policy/, 'security audit must verify admin-only content tables');
assert.match(checkSql, /schema\.quiz_required_columns/, 'security audit must detect legacy quiz schema drift');
assert.match(checkSql, /invite\.absolute_session_lifetime/, 'security audit must verify the absolute session lifetime');
assert.match(checkSql, /invite\.multi_axis_rate_limit/, 'security audit must verify multi-axis invite throttling');
assert.match(checkSql, /fingerprint_definition ilike '%rate:ip:%'[\s\S]*verify_definition ilike '%rate:code:%'[\s\S]*verify_definition ilike '%rate:global%'/, 'rate-limit audit must inspect the IP helper and verification RPC separately');
assert.match(phase2Sql, /created_at > now\(\) - interval '365 days'/, 'phase 2 migration must enforce an absolute server-side lifetime');
assert.match(phase2Sql, /revoke_all_invite_access_sessions/, 'phase 2 migration must provide global session revocation');
assert.doesNotMatch(phase2Sql.match(/create or replace function public\.verify_invite_code[\s\S]*?\$\$;/)?.[0] || '', /delete from public\.invite_code_attempts/, 'invite verification must not clean history inline');
assert.match(finalAccessSql, /expires_at timestamptz/, 'final migration must persist an explicit absolute expiry');
assert.match(finalAccessSql, /last_origin_hash/, 'final migration must support pseudonymous origin-change detection');
assert.match(finalAccessSql, /high_refresh_rate[\s\S]*rapid_origin_change/, 'final migration must record both high-frequency and rapid-origin-change risks');
assert.doesNotMatch(finalAccessSql, /user_agent|raw_ip|client_ip|ip_address/i, 'session anomaly metadata must not store raw device or IP identifiers');
assert.match(finalAccessSql, /get_invite_access_session_overview/, 'final migration must provide a token-free administrator overview');
assert.match(finalAccessSql, /list_invite_access_sessions/, 'final migration must provide token-free session inspection');
assert.match(finalAccessSql, /revoke all on function public\.list_invite_access_sessions\(\) from public, anon, authenticated/, 'session inspection must not be callable by the browser anon role');

assert.match(migration, /const storageUploadManifest = new Map\(\)/, 'migration must use an explicit Storage upload manifest');
assert.match(migration, /await validateDatabaseSchema\(\);[\s\S]*await importRecords\(\)/, 'migration must validate its database schema before writing');
assert.match(migration, /allowedStorageRoots = \['data\/attachments\/', 'images\/record-pages\/', 'images\/quiz\/'\]/, 'migration must use a narrow binary asset root allowlist');
assert.match(migration, /source JSON is never copied to Storage/, 'migration must document that JSON is database-only');
assert.doesNotMatch(migration, /\.\.\.await walkFiles\('data'\)/, 'migration must not upload the data directory recursively');
assert.doesNotMatch(migration, /if \(ext === '\.json'\) return 'application\/json'/, 'JSON must not be an allowed Storage upload type');
assert.match(migration, /const remoteFiles = await listStorageObjects\(''\)/, '--prune must remove legacy objects across the dedicated bucket');
assert.match(migration, /private-assets\/\$\{storagePath\.slice\('images\/'\.length\)\}/, 'quiz images must be sourced from the ignored private-assets directory');

assert.match(secureData, /normalizeQuizImagePath/, 'quiz Storage paths must be validated');
assert.doesNotMatch(secureData, /expiresIn\s*=\s*60\s*\*\s*30|expiresIn\s*\|\|\s*60\s*\*\s*30/, 'signed URL lifetime must not be hard-coded to thirty minutes');
assert.doesNotMatch(secureData, /sessionStorage\.setItem\(SIGNED_URL_SESSION_KEY/, 'signed URLs must remain memory-only');
assert.match(secureData, /sensitiveSignedUrlExpiresIn/, 'sensitive assets must use a shorter configured lifetime');
assert.match(secureData, /image: normalizeQuizImagePath/, 'quiz rows must retain only validated private object paths');
assert.match(quizApp, /data-secure-src="\$\{escapeHtml\(currentQuestion\.imagePath\)\}"/, 'quiz images must be rendered as private Storage references');
assert.match(quizApp, /ClassRecordData\?\.resolveAssetElements\?\.\(questionText\)/, 'quiz images must be resolved through the signed URL loader');
assert.doesNotMatch(quizApp, /<img src="\$\{escapeHtml\(currentQuestion\.imagePath\)\}"/, 'quiz images must never use the raw Storage path as a public URL');
assert.match(quizApp, /if \(!secretAdminAccess\) return \[\]/, 'hidden quiz rows must not load for normal invite sessions');
assert.match(quizApp, /ClassRecordSupabase\?\.hasAdminAccess/, 'hidden quiz unlock must use the server-verified administrator session');
assert.match(authGate, /ACCESS_MAX_ABSOLUTE_DAYS = 365/, 'the browser gate must mirror the server absolute lifetime for early cleanup');
assert.doesNotMatch(authGate, /item\?\.verified\s*!==\s*true/, 'local verified=true must not be treated as authority');
assert.match(authGate, /refreshInviteAccess/, 'page access must still be confirmed by the server token refresh');
assert.doesNotMatch(authGate, /(?:location|history)[^\n]*(?:token|accessToken)|URLSearchParams[^\n]*(?:token|accessToken)/i, 'bearer tokens must never enter URLs or browser history');
assert.doesNotMatch(authGate, /console\.[a-z]+\([^\n]*(?:token|accessToken)/i, 'bearer tokens must never be logged');
assert.doesNotMatch(siteCache, /console\[method\]\(label,\s*safe,\s*error\)/, 'diagnostics must not log raw Supabase errors that could carry request details');

const repositoryFiles = await listFiles();
const forbiddenPublicFiles = repositoryFiles.filter((file) => (
    file.startsWith('images/quiz/lamian/')
));
assert.deepEqual(forbiddenPublicFiles, [], `sensitive source files must not exist in deployable directories: ${forbiddenPublicFiles.join(', ')}`);

const gitignore = await read('.gitignore');
assert.match(gitignore, /^data\/$/m, 'database source JSON directory must be ignored');
assert.match(gitignore, /^images\/record-pages\/$/m, 'private record page source directory must be ignored');
assert.match(gitignore, /^images\/quiz\/lamian\/$/m, 'private quiz source directory must be ignored');
assert.match(gitignore, /^private-assets\/$/m, 'all local private migration sources must be ignored');

let trackedFiles;
try {
    const { stdout } = await execFileAsync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: fileURLToPath(root) }
    );
    const candidates = stdout.split('\0').filter(Boolean).map((file) => file.replace(/\\/g, '/'));
    const existing = await Promise.all(candidates.map(async (file) => {
        try {
            await access(new URL(file, root));
            return file;
        } catch {
            return '';
        }
    }));
    trackedFiles = existing.filter(Boolean);
    const forbiddenTracked = trackedFiles.filter((file) => (
        file.startsWith('data/')
        || file.startsWith('images/record-pages/')
        || file.startsWith('images/quiz/lamian/')
        || file.startsWith('private-assets/')
    ));
    assert.deepEqual(forbiddenTracked, [], `sensitive JSON, hidden answers, and private images must not be tracked: ${forbiddenTracked.join(', ')}`);
} catch (error) {
    if (error?.code !== 'EPERM') throw error;
    // Some managed sandboxes prohibit child processes. The deployable-directory
    // and ignore checks above still run; CI and normal local runs execute Git.
    trackedFiles = repositoryFiles;
}

const frontendFiles = trackedFiles.filter((file) => file.endsWith('.html') || file.startsWith('js/'));
for (const file of frontendFiles) {
    const source = await read(file);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|INVITE_CODE_PEPPER/, `${file} must not contain backend secrets`);
}

console.log('Passed Storage policy, database grant, migration allowlist, private quiz, and tracked-secret checks.');

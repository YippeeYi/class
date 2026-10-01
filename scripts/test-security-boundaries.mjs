import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { readFrontend, root } from './test-react-helpers.mjs'

const auth = await readFrontend('src/features/auth/auth-context.tsx')
const data = await readFrontend('src/services/data.ts')
const config = await readFrontend('src/services/supabase.ts')
const setupSql = await readFile(path.join(root, 'sql/setup.sql'), 'utf8')
const levelTwelveMigration = await readFile(path.join(root, 'supabase/migrations/20261001120000_private_merge_qb_level_12.sql'), 'utf8')
const gameAssetsMigration = await readFile(path.join(root, 'supabase/migrations/20261001130000_private_game_assets.sql'), 'utf8')
const gameAssetsRollback = await readFile(path.join(root, 'supabase/rollbacks/20261001130000_private_game_assets.down.sql'), 'utf8')
const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'))
const hiddenConsumers = await Promise.all(
  ['src/features/archive/archive-context.tsx', 'src/pages/search-page.tsx', 'src/pages/timeline-page.tsx', 'src/pages/quiz-page.tsx'].map(readFrontend),
)

assert.match(auth, /refresh_invite_access/, 'server-side access refresh is required')
assert.match(auth, /90 \* 24 \* 60 \* 60/, '90-day idle boundary is missing')
assert.match(auth, /365 \* 24 \* 60 \* 60/, '365-day absolute boundary is missing')
assert.match(data, /has_class_record_admin_access/, 'admin-only data must check server access')
assert.match(data, /loadRecordPages[\s\S]*persistent: false/, 'scan rows must remain memory-only and protected by administrator RLS')
for (const source of hiddenConsumers) {
  assert.doesNotMatch(source, /loadRecords\(\{\s*hidden:\s*true/, 'hidden ordinary records must not enter archive, search, statistics, or quiz consumers')
}
for (const type of ['messages', 'supplements']) {
  assert.ok(data.includes(`key: hidden ? 'page-${type}:hidden' : 'page-${type}'`))
}
assert.match(data, /persistent: !hidden[\s\S]*sessionTtl: hidden \? 0 : undefined/)
assert.match(
  setupSql,
  /class_record_pages_read[\s\S]*public\.has_class_record_access\(\) and public\.has_class_record_admin_access\(\)/,
  'all original written pages must be administrator-only at the table boundary',
)
assert.match(
  setupSql,
  /name ~ '\^images\/record-pages\/[\s\S]*public\.has_class_record_admin_access\(\)/,
  'all original written-page objects must be administrator-only in Storage',
)
assert.match(
  setupSql,
  /class_page_messages_read[\s\S]*using \(public\.has_class_record_access\(\) and \(not hidden or public\.has_class_record_admin_access\(\)\)\)/,
  'hidden auxiliary records must require administrator access',
)
assert.doesNotMatch(config, /service_role|SERVICE_ROLE/, 'service role material must never enter the frontend')
for (const sql of [setupSql, gameAssetsMigration]) {
  assert.ok(sql.includes('images/games/[a-z0-9]+'), 'game assets need a distinct validated Storage namespace')
  assert.match(sql, /public\.has_class_record_access\(\)/, 'game art keeps invite-based access')
}
assert.match(setupSql, /values \('classrecord-private', 'classrecord-private', false\)/, 'new buckets remain private')
assert.match(gameAssetsMigration, /update storage\.buckets set public = false/, 'game assets keep a private bucket')
for (const sql of [levelTwelveMigration, gameAssetsRollback]) {
  assert.ok(sql.includes('images/games/merge-qb/(0[1-9]|1[0-2])'), 'existing QB paths remain accessible')
}
const gamePathPattern = gameAssetsMigration.match(/name ~ '([^']*images\/games\/[^']+)'/)?.[1]
assert.ok(gamePathPattern, 'game path policy is missing')
const gamePathAllowed = new RegExp(gamePathPattern)
for (const asset of ['images/games/merge-qb/01.png', 'images/games/another-game/impact.ogg']) {
  assert.match(asset, gamePathAllowed)
}
for (const asset of [
  'images/games/../quiz/picture.png', 'images/games/merge-qb/../picture.png',
  'images/games/merge-qb/nested/picture.png', 'images/games/merge-qb/evil.exe',
  'images/quiz/another-game/picture.png', 'images/games/merge-qb/01.png/extra',
]) {
  assert.doesNotMatch(asset, gamePathAllowed)
}
const storageDb = new PGlite()
try {
  await storageDb.exec(`
    create role anon;
    create role authenticated;
    create schema storage;
    grant usage on schema storage to anon, authenticated;
    create table storage.buckets (id text primary key, public boolean not null);
    create table storage.objects (bucket_id text not null, name text not null);
    grant select on storage.objects to anon, authenticated;
    alter table storage.objects enable row level security;
    insert into storage.buckets values ('classrecord-private', true);
    create function public.has_class_record_access() returns boolean language sql stable
      as $$ select current_setting('test.valid_access', true) = 'true' $$;
    create function public.has_class_record_admin_access() returns boolean language sql stable
      as $$ select current_setting('test.admin_access', true) = 'true' $$;
  `)
  await storageDb.exec(levelTwelveMigration)
  await storageDb.exec(gameAssetsMigration)
  await storageDb.exec(gameAssetsMigration)
  assert.equal((await storageDb.query("select public from storage.buckets where id = 'classrecord-private'")).rows[0].public, false)
  await storageDb.exec(`insert into storage.objects values
    ('classrecord-private', 'images/games/merge-qb/01.png'),
    ('classrecord-private', 'images/games/another-game/impact.ogg'),
    ('classrecord-private', 'images/games/../quiz/picture.png'),
    ('classrecord-private', 'images/games/merge-qb/../picture.png'),
    ('classrecord-private', 'images/quiz/secret.png'),
    ('other-bucket', 'images/games/another-game/impact.ogg')`)
  await storageDb.exec('set role anon')
  const readable = async () => (await storageDb.query('select name from storage.objects order by name')).rows.map((row) => row.name)
  assert.deepEqual(await readable(), [], 'without an invitation, no private game resources are readable')
  await storageDb.exec("set test.valid_access = 'true'")
  assert.deepEqual(await readable(), ['images/games/another-game/impact.ogg', 'images/games/merge-qb/01.png'])
  await storageDb.exec("set test.admin_access = 'true'")
  assert.deepEqual(await readable(), [
    'images/games/another-game/impact.ogg', 'images/games/merge-qb/01.png', 'images/quiz/secret.png',
  ])
  await storageDb.exec('reset role')
  await storageDb.exec(gameAssetsRollback)
  await storageDb.exec('set role anon')
  assert.deepEqual(await readable(), ['images/games/merge-qb/01.png', 'images/quiz/secret.png'])
  await storageDb.exec('reset role')
} finally {
  await storageDb.close()
}
for (const prefix of ['/data/(.*)', '/images/quiz/(.*)', '/images/private/(.*)']) {
  assert.ok(vercel.rewrites.some((rule) => rule.source === prefix), `${prefix} deployment boundary is missing`)
}
console.log('React security boundary checks passed.')

const orderRpc = setupSql.slice(setupSql.indexOf('create or replace function public.get_class_record_order'))
assert.match(orderRpc, /public.has_class_record_access\(\)/)
assert.match(orderRpc, /not r.hidden or \(include_hidden and public.has_class_record_admin_access\(\)\)/)
assert.match(orderRpc, /returns table \(file_name text, page text\)/)
assert.doesNotMatch(orderRpc, /select scan.image_path|returns[^;]*image_path/)

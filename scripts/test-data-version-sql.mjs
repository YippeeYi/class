import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const tables = ['class_records', 'class_people', 'class_record_pages', 'class_page_messages', 'class_page_supplements', 'class_materials', 'class_quiz_questions', 'class_credits_page', 'class_private_assets']
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create function public.has_class_record_access() returns boolean language sql as $$ select current_setting('test.valid_access', true) = 'true' $$;
    create table public.invite_access_sessions (id int);
    ${tables.map((name) => `create table public.${name} (id int primary key, value text);`).join('\n')}`)
  await db.exec(await readFile('supabase/migrations/20260918000000_business_data_version.sql', 'utf8'))
  const revision = async () => (await db.query('select revision::text from class_data_version')).rows[0].revision
  let before = BigInt(await revision())
  for (const table of tables) {
    for (const statement of [`insert into ${table} values (1, 'before')`, `update ${table} set value = 'after' where id = 1`, `delete from ${table} where id = 1`, `truncate ${table}`]) {
      await db.exec(statement)
      assert.equal(BigInt(await revision()), ++before, `${statement} advances the business version`)
    }
  }
  await db.exec('begin; insert into class_records values (2, \'aborted\'); rollback;')
  assert.equal(BigInt(await revision()), before, 'rolled-back transactions must not publish a revision')
  await db.exec('insert into invite_access_sessions values (1)')
  assert.equal(BigInt(await revision()), before, 'auth changes must not invalidate business data')
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from class_data_version'), /permission denied/)
  await assert.rejects(db.query('select get_class_data_version()'), /Valid invitation access required/)
  await assert.rejects(db.query('update class_data_version set revision = 9'), /permission denied/)
  await db.exec("set test.valid_access = 'true'")
  assert.equal((await db.query('select get_class_data_version() as version')).rows[0].version, String(before))
  await db.exec("set test.valid_access = 'false'")
  await assert.rejects(db.query('select get_class_data_version()'), /Valid invitation access required/)
  await db.exec('reset role')
  await db.exec(await readFile('supabase/rollbacks/20260918000000_business_data_version.down.sql', 'utf8'))
  assert.equal((await db.query("select to_regclass('public.class_data_version') as name")).rows[0].name, null)
  assert.equal((await db.query('select count(*)::int as count from invite_access_sessions')).rows[0].count, 1, 'rollback leaves auth intact')
  console.log('PostgreSQL data revisions passed: all nine tables, insert/update/delete/truncate, transaction rollback, protected RPC, auth isolation and migration rollback.')
} finally { await db.close() }

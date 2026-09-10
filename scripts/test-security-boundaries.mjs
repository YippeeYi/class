import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readFrontend, root } from './test-react-helpers.mjs'

const auth = await readFrontend('src/features/auth/auth-context.tsx')
const data = await readFrontend('src/services/data.ts')
const config = await readFrontend('src/services/supabase.ts')
const setupSql = await readFile(path.join(root, 'sql/setup.sql'), 'utf8')
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
for (const prefix of ['/data/(.*)', '/images/quiz/(.*)', '/images/private/(.*)']) {
  assert.ok(vercel.rewrites.some((rule) => rule.source === prefix), `${prefix} deployment boundary is missing`)
}
console.log('React security boundary checks passed.')

const orderRpc = setupSql.slice(setupSql.indexOf('create or replace function public.get_class_record_order'))
assert.match(orderRpc, /public.has_class_record_access\(\)/)
assert.match(orderRpc, /not r.hidden or \(include_hidden and public.has_class_record_admin_access\(\)\)/)
assert.match(orderRpc, /returns table \(file_name text, page text\)/)
assert.doesNotMatch(orderRpc, /select scan.image_path|returns[^;]*image_path/)

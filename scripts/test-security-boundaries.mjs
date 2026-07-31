import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readFrontend, root } from './test-react-helpers.mjs'

const auth = await readFrontend('src/features/auth/auth-context.tsx')
const data = await readFrontend('src/services/data.ts')
const config = await readFrontend('src/services/supabase.ts')
const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'))

assert.match(auth, /refresh_invite_access/, 'server-side access refresh is required')
assert.match(auth, /90 \* 24 \* 60 \* 60/, '90-day idle boundary is missing')
assert.match(auth, /365 \* 24 \* 60 \* 60/, '365-day absolute boundary is missing')
assert.match(data, /has_class_record_admin_access/, 'admin-only data must check server access')
assert.doesNotMatch(config, /service_role|SERVICE_ROLE/, 'service role material must never enter the frontend')
for (const prefix of ['/data/(.*)', '/images/quiz/(.*)', '/images/private/(.*)']) {
  assert.ok(vercel.rewrites.some((rule) => rule.source === prefix), `${prefix} deployment boundary is missing`)
}
console.log('React security boundary checks passed.')

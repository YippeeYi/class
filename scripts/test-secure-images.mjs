import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const data = await readFrontend('src/services/data.ts')
assert.match(data, /createSignedUrl/, 'private images must use Supabase signed URLs')
assert.match(data, /Math\.min\(900, Math\.max\(30, expiresIn\)\)/, 'signed URL lifetime must be bounded')
assert.match(data, /normalizePrivatePath/, 'private paths must be normalized before signing')
assert.match(data, /segment === '\.\.'/, 'path traversal must be rejected')
assert.match(data, /images\/private\/meal-map\.png/, 'meal map must use the private object path')
console.log('React secure image checks passed.')

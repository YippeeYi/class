import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const gate = await readFrontend('src/features/auth/access-gate.tsx')
const auth = await readFrontend('src/features/auth/auth-context.tsx')
const app = await readFrontend('src/app.tsx')
assert.match(gate, /rememberTarget\(target\)/, 'the gate must remember the protected target')
assert.match(gate, /Navigate to="\/auth"/, 'anonymous visitors must be redirected to auth')
assert.match(auth, /verify_invite_code/, 'invite codes must be verified by RPC')
assert.match(auth, /accessToken/, 'verified access token must be persisted')
assert.match(app, /path="\/auth\.html"/, 'legacy auth URL must remain compatible')
console.log('React access gate checks passed.')

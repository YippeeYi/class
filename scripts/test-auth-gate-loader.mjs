import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const gate = await readFrontend('src/features/auth/access-gate.tsx')
const auth = await readFrontend('src/features/auth/auth-context.tsx')
const authPage = await readFrontend('src/pages/auth-page.tsx')
assert.match(gate, /rememberTarget\(target\)/, 'the gate must remember the protected target')
assert.match(gate, /Navigate to="\/auth"/, 'anonymous visitors must be redirected to auth')
assert.match(auth, /verify_invite_code/, 'invite codes must be verified by RPC')
assert.match(auth, /accessToken/, 'verified access token must be persisted')
assert.match(authPage, /disabled=\{submitting \|\| auth\.state === 'loading'\}/, 'the invite input must be locked while verification is running')
assert.doesNotMatch(auth, /\.html/, 'auth target handling must not include legacy HTML compatibility')
console.log('React access gate checks passed.')

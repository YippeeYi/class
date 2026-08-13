import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const gate = await readFrontend('src/features/auth/access-gate.tsx')
const auth = await readFrontend('src/features/auth/auth-context.tsx')
const authPage = await readFrontend('src/pages/auth-page.tsx')
assert.match(gate, /rememberTarget\(target\)/, 'the gate must remember the protected target')
assert.match(gate, /Navigate to="\/auth"/, 'anonymous visitors must be redirected to auth')
assert.match(auth, /verify_invite_code/, 'invite codes must be verified by RPC')
assert.match(auth, /accessToken/, 'verified access token must be persisted')
assert.match(
  auth,
  /!raw && !lastVisitRaw[\s\S]*shouldClear: false/,
  'a normal anonymous visit must not run the destructive cache-clearing path',
)
assert.match(
  auth,
  /function rememberTarget[\s\S]*try[\s\S]*sessionStorage\.setItem/,
  'redirect state must degrade safely when session storage is unavailable',
)
assert.match(authPage, /const pending = submitting \|\| auth\.state === 'loading'/, 'invite verification must expose one shared pending state')
assert.ok((authPage.match(/disabled=\{pending\}/g) || []).length >= 2, 'the invite input and submit button must be locked while verification is running')
assert.match(authPage, /aria-busy=\{pending \|\| undefined\}/, 'the shadcn submit button must expose its async state')
assert.doesNotMatch(auth, /\.html/, 'auth target handling must not include legacy HTML compatibility')
console.log('React access gate checks passed.')

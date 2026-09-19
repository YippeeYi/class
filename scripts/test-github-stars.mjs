import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend } from './test-react-helpers.mjs'
const entries = new Map([['classRecord:inviteAccess', 'untouched'], ['classRecord:businessVersion', '7']])
globalThis.localStorage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
let calls = 0
let count = 17
let status = 200
let now = Date.now()
const realNow = Date.now
Date.now = () => now
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.github.com/repos/YippeeYi/class')
  assert.equal(options.credentials, 'omit')
  assert.equal(Object.keys(options.headers).some((key) => /authorization|class-record/i.test(key)), false)
  calls++
  return new Response(JSON.stringify({ stargazers_count: count }), { status, headers: { 'content-type': 'application/json' } })
}
const config = { configFile: false, root: frontend, resolve: { alias: { '@': path.join(frontend, 'src') } }, server: { middlewareMode: true }, logLevel: 'silent' }
const vite = await createServer(config)
try {
  const service = await vite.ssrLoadModule('/src/services/github-stars.ts')
  assert.equal(service.getGitHubStars(), null)
  await Promise.all(Array.from({ length: 20 }, service.refreshGitHubStars))
  assert.equal(calls, 1)
  assert.equal(service.getGitHubStars(), 17)
  await service.refreshGitHubStars()
  assert.equal(calls, 1)
  now += 31 * 60_000
  count = 23
  await service.refreshGitHubStars()
  assert.equal(service.getGitHubStars(), 23)
  now += 31 * 60_000
  status = 429
  await service.refreshGitHubStars()
  assert.equal(service.getGitHubStars(), 23, 'rate limiting retains the last real count')
  const before = calls
  await service.refreshGitHubStars()
  assert.equal(calls, before, 'failure backoff avoids request storms')
  now += 6 * 60_000
  status = 200
  count = -1
  await service.refreshGitHubStars()
  assert.equal(service.getGitHubStars(), 23, 'invalid counts are never displayed')
  assert.equal(entries.get('classRecord:inviteAccess'), 'untouched')
  assert.equal(entries.get('classRecord:businessVersion'), '7')
  const reopened = await createServer(config)
  try {
    const next = await reopened.ssrLoadModule('/src/services/github-stars.ts')
    assert.equal(next.getGitHubStars(), 23, 'last good count survives full navigation')
  } finally { await reopened.close() }
  console.log('GitHub Stars passed: real response parsing, dedupe, TTL refresh, rate-limit fallback, persistence and auth/business isolation.')
} finally {
  Date.now = realNow
  await vite.close()
}

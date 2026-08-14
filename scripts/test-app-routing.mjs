import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend } from './test-react-helpers.mjs'

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { normalizeAppPathname } = await vite.ssrLoadModule('/src/lib/app-route.ts')
  assert.equal(normalizeAppPathname('/'), '/')
  assert.equal(normalizeAppPathname('/records'), '/records')
  assert.equal(normalizeAppPathname('/records/'), '/records')
  assert.equal(normalizeAppPathname('/records///'), '/records')
  assert.equal(normalizeAppPathname('/records/unknown'), '/records/unknown')
  console.log('React application route checks passed.')
} finally {
  await vite.close()
}

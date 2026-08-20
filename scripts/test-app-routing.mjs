import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend, readFrontend } from './test-react-helpers.mjs'

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
  const { formatDocumentTitle } = await vite.ssrLoadModule('/src/hooks/use-document-title.ts')
  assert.equal(normalizeAppPathname('/'), '/')
  assert.equal(normalizeAppPathname('/records'), '/records')
  assert.equal(normalizeAppPathname('/records/'), '/records')
  assert.equal(normalizeAppPathname('/records///'), '/records')
  assert.equal(normalizeAppPathname('/records/unknown'), '/records/unknown')
  assert.equal(formatDocumentTitle(), '编日史')
  assert.equal(formatDocumentTitle('记录'), '记录 · 编日史')
  const pageFiles = (await readdir(path.join(frontend, 'src/pages'))).filter((file) =>
    file.endsWith('-page.tsx'),
  )
  for (const file of pageFiles) {
    const source = await readFrontend(`src/pages/${file}`)
    assert.match(source, /useDocumentTitle\(/, `${file} must use the shared document title rule`)
    assert.doesNotMatch(source, /document\.title\s*=/, `${file} must not hard-code document.title`)
  }
  console.log('React application route checks passed.')
} finally {
  await vite.close()
}

import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildMediaDimensionManifests } from './media-manifest.mjs'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'class-media-manifest-'))
try {
  const png = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
  png.writeUInt32BE(640, 16)
  png.writeUInt32BE(360, 20)
  await fs.writeFile(path.join(root, 'image.png'), png)
  await fs.writeFile(path.join(root, 'hidden.svg'), '<svg viewBox="0 0 300 600"></svg>')
  await fs.writeFile(path.join(root, 'invalid.jpg'), 'not an image')
  const assets = new Map([
    ['data/attachments/image.png', { remotePath: 'data/attachments/image.png', localPath: 'image.png' }],
    ['images/record-pages/page.png', { remotePath: 'images/record-pages/page.png', localPath: 'image.png' }],
    ['hidden/data/attachments/hidden.svg', { remotePath: 'hidden/data/attachments/hidden.svg', localPath: 'hidden.svg' }],
    ['data/attachments/invalid.jpg', { remotePath: 'data/attachments/invalid.jpg', localPath: 'invalid.jpg' }],
    ['images/quiz/secret.png', { remotePath: 'images/quiz/secret.png', localPath: 'image.png' }],
  ])
  assert.deepEqual(await buildMediaDimensionManifests(root, assets), {
    public: { 'data/attachments/image.png': [640, 360], 'images/record-pages/page.png': [640, 360] },
    hidden: { 'hidden/data/attachments/hidden.svg': [300, 600] },
  })
  console.log('Protected media dimension manifest checks passed.')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}

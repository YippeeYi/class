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
  const {
    buildSupplementalRecords,
    recordAnchorId,
    recordDisplayNumber,
    recordStableKey,
    recordWrittenHref,
  } = await vite.ssrLoadModule('/src/lib/record-identity.ts')
  const message = { page: '7', content: '箴言正文', author: 'alice' }
  const supplement = {
    id: 'private-source.json',
    fileName: 'private-source.json',
    page: '7',
    supplementIndex: 2,
    author: 'bob',
    content: '补充正文',
    hidden: false,
    importance: 'normal',
    date: '',
    time: '',
  }
  const [messageRecord, supplementRecord] = buildSupplementalRecords([message], [supplement])

  assert.equal(recordDisplayNumber(messageRecord), '#箴-007')
  assert.equal(recordDisplayNumber(supplementRecord), '#补-007-02')
  assert.equal(messageRecord.fileName, '')
  assert.equal(supplementRecord.fileName, '')
  assert.doesNotMatch(JSON.stringify([messageRecord.id, supplementRecord.id]), /\.json/i)
  assert.equal(messageRecord.date, '', 'a missing proverb date must stay absent')
  assert.equal(supplementRecord.date, '', 'a missing supplement date must stay absent')
  assert.notEqual(recordStableKey(messageRecord), recordStableKey(supplementRecord))
  assert.notEqual(recordAnchorId(messageRecord), recordAnchorId(supplementRecord))
  assert.match(recordWrittenHref(supplementRecord), /^\/records\?view=written#record-/)

  const [, sameMessage] = buildSupplementalRecords(
    [{ page: '1', content: '新增正文', author: 'alice' }, message],
    [],
  )
  assert.equal(
    recordDisplayNumber(sameMessage),
    '#箴-007',
    'adding an earlier page must not renumber an existing proverb',
  )
} finally {
  await vite.close()
}

console.log('Record identity checks passed.')

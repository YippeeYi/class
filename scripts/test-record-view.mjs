import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const page = await readFrontend('src/pages/records-page.tsx')
const card = await readFrontend('src/components/archive/record-card.tsx')
assert.match(page, /value="list"/, 'list view is missing')
assert.match(page, /value="written"/, 'written view is missing')
assert.match(page, /year.*month.*important/s, 'record filters are incomplete')
assert.match(page, /qibaishihuaxia/, 'admin hidden-record sequence was not preserved')
assert.match(page, /hasAdminAccess/, 'hidden records must check admin access')
assert.match(card, /RecordCard/, 'record card component is missing')
assert.match(card, /signAssetUrl\(attachment\.file\)/, 'attachments must be signed on demand')
console.log('React record view checks passed.')

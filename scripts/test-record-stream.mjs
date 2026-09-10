import assert from 'node:assert/strict'
import { loadTypescriptModule } from './test-react-helpers.mjs'

const { buildRecordStream, orderedRecordStream, visibleRecords, recordAnnotation, writtenStreamPages } = await loadTypescriptModule('src/lib/record-stream.ts')
const { buildSupplementalRecords, recordStableKey } = await loadTypescriptModule('src/lib/record-identity.ts')
const ordinary = (fileName, hidden = false) => ({
  fileName, id: fileName, recordIndex: 1, date: '', time: '', author: '', recorder: '',
  content: '正文', text: '正文', importance: 'normal', attachments: [], hidden,
})
const extra = buildSupplementalRecords(
  [{ page: '01', author: '', content: '箴言', annotation: '[[red:注解]]' }],
  [2, 1].map((index) => ({ page: '1', supplementIndex: index, author: '', content: '补充', date: '', time: '', annotation: '补充注解' })),
)
const records = [ordinary('2025-01-03.json'), ...extra, ordinary('2025-01-02.json', true), ordinary('2025-01-01.json'), ordinary('unmapped.json')]
const positions = records.filter((r) => r.fileName && r.fileName !== 'unmapped.json').map((r) => ({ fileName: r.fileName, page: r.fileName.includes('03') ? '02' : '1' }))
const expected = ['message:01', 'supplement:1:1', 'supplement:1:2', 'record:2025-01-01', 'record:2025-01-03', 'record:unmapped']
const keys = (items) => items.map(recordStableKey)
const normal = buildRecordStream(records, positions)
assert.deepEqual(keys(orderedRecordStream(normal)), expected)
assert.deepEqual(keys(orderedRecordStream(normal, true)), [...expected].reverse())
const all = buildRecordStream(records, positions, true)
assert.equal(orderedRecordStream(all).length, records.length)
assert.deepEqual(keys(orderedRecordStream(all)).slice(0, 5), [...expected.slice(0, 4), 'record:2025-01-02'])
assert.equal(visibleRecords(records).some((r) => r.hidden), false)
assert.equal(visibleRecords(records, true).length, records.length)
assert.deepEqual(keys(orderedRecordStream(buildRecordStream(records, positions))), expected, 'leaving hidden mode must preserve public order')
assert.deepEqual(keys(orderedRecordStream(buildRecordStream([...records, ...records], positions))), expected, 'merged records must not duplicate')
const pages = writtenStreamPages([{ page: '01', hidden: false }, { page: '02', hidden: false }, { page: 'H01', hidden: true }], all)
assert.deepEqual(pages.map((p) => p.page), ['01', '02', ''])
assert.deepEqual(keys(pages.flatMap((p) => all.find((g) => g.page === String(Number(p.page || 0)).replace(/^0$/, ''))?.records || [])), keys(orderedRecordStream(all)), 'written page expansion must equal the forward list, including unmapped records')
for (const empty of [undefined, null, '', ' \n\t ', 123, {}]) assert.equal(recordAnnotation(empty), undefined)
assert.equal(recordAnnotation(' [[red:注解]] '), '[[red:注解]]')
assert.equal(extra[0].annotation, '[[red:注解]]')
assert.equal(extra[1].annotation, '补充注解')
const protectedExtra = buildSupplementalRecords(
  [{ page: 'H01', author: '', content: '隐藏箴言', hidden: true, annotation: '隐藏注解' }],
  [{ page: 'H01', supplementIndex: 1, author: '', content: '隐藏补充', date: '', time: '', hidden: true }],
)
assert.ok(protectedExtra.every((item) => item.hidden))
assert.deepEqual(visibleRecords(protectedExtra), [])
assert.equal(visibleRecords(protectedExtra, true).length, 2)
assert.deepEqual(keys(orderedRecordStream(buildRecordStream([...records, ...protectedExtra], positions))), expected)
const protectedStream = buildRecordStream([...records, ...protectedExtra], positions, true)
assert.equal(orderedRecordStream(protectedStream).length, records.length + 2)
assert.deepEqual(keys(orderedRecordStream(protectedStream, true)), keys(orderedRecordStream(protectedStream)).reverse())
console.log('Record stream ordering, visibility, identity and annotation checks passed.')

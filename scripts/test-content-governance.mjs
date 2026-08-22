import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  auditPublication,
  buildPublicationDiff,
  publicationSummary,
  safeSnapshotPath,
} from './archive-governance.mjs'

const root = process.cwd()

const goodTables = new Map([
  [
    'class_records',
    {
      onConflict: 'file_name',
      rows: [
        {
          file_name: 'r1.json',
          record_id: 'r1',
          record_date: '2026-08-23',
          author: 'p1',
          content:
            '[[person:p1|人物]][[record:r1|本记录]][[material:m1|资料]][[quote:q1|原话]]',
          hidden: false,
          raw: {},
        },
      ],
    },
  ],
  [
    'class_people',
    {
      onConflict: 'id',
      rows: [{ id: 'p1', name: '测试人物', bio: '', raw: {} }],
    },
  ],
  [
    'class_record_pages',
    {
      onConflict: 'page',
      rows: [
        {
          page: '01',
          start_file: 'r1.json',
          end_file: 'r1.json',
          hidden: false,
          raw: {},
        },
      ],
    },
  ],
  ['class_page_messages', { onConflict: 'page', rows: [] }],
  ['class_page_supplements', { onConflict: 'file_name', rows: [] }],
  [
    'class_materials',
    {
      onConflict: 'id',
      rows: [{ id: 'm1', material_id: 'm1', title: '资料', content: '正文', raw: {} }],
    },
  ],
])

const storageAssets = new Map([
  [
    'data/attachments/a.png',
    { localPath: 'private-assets/content/attachments/a.png', remotePath: 'data/attachments/a.png' },
  ],
])

const goodAudit = auditPublication({ tables: goodTables, storageAssets })
assert.equal(goodAudit.ok, true)
assert.deepEqual(goodAudit.errors, [])
assert.equal(goodAudit.summary.quotes, 1)

const brokenTables = new Map(
  [...goodTables].map(([table, plan]) => [
    table,
    { ...plan, rows: plan.rows.map((row) => ({ ...row, raw: { ...(row.raw || {}) } })) },
  ]),
)
brokenTables.get('class_records').rows[0] = {
  ...brokenTables.get('class_records').rows[0],
  content: '[[record:missing.json|损坏引用]]',
  hidden: true,
  record_date: '2026-02-31',
}
const brokenAudit = auditPublication({
  tables: brokenTables,
  storageAssets,
  missingAssets: [...storageAssets.values()],
})
assert.equal(brokenAudit.ok, false)
const brokenCodes = new Set(brokenAudit.errors.map((issue) => issue.code))
assert.ok(brokenCodes.has('record.date'))
assert.ok(brokenCodes.has('record.hidden-drift'))
assert.ok(brokenCodes.has('reference.record'))
assert.ok(brokenCodes.has('asset.missing'))

const localTables = new Map([
  [
    'class_records',
    {
      onConflict: 'file_name',
      rows: [
        { file_name: 'same.json', content: 'same', updated_at: 'local-time' },
        { file_name: 'changed.json', content: 'local' },
        { file_name: 'new.json', content: 'new' },
      ],
    },
  ],
])
const remoteTables = new Map([
  [
    'class_records',
    [
      { file_name: 'same.json', content: 'same', updated_at: 'remote-time' },
      { file_name: 'changed.json', content: 'remote' },
      { file_name: 'old.json', content: 'old' },
    ],
  ],
])
const publicationDiff = buildPublicationDiff({
  tables: localTables,
  remoteTables,
  storageAssets: new Map([
    ['existing.png', {}],
    ['new.png', {}],
  ]),
  remoteStorage: ['existing.png', 'old.png'],
})
assert.deepEqual(publicationDiff.database.class_records, {
  added: ['new.json'],
  updated: ['changed.json'],
  unchanged: ['same.json'],
  removed: ['old.json'],
})
assert.deepEqual(publicationDiff.storage, {
  added: ['new.png'],
  replaced: ['existing.png'],
  removed: ['old.png'],
})
assert.deepEqual(publicationSummary(publicationDiff).database.class_records, {
  added: 1,
  updated: 1,
  unchanged: 1,
  removed: 1,
})

const snapshotPath = safeSnapshotPath(root, 'private-exports/publish-snapshots/test', 'database/table.json')
assert.equal(
  snapshotPath,
  path.join(root, 'private-exports/publish-snapshots/test/database/table.json'),
)
assert.throws(
  () => safeSnapshotPath(root, 'private-exports/publish-snapshots/test', '../../outside.json'),
  /escaped its root/,
)

const [adminSource, dataSource, setupSql, checkSql] = await Promise.all([
  fs.readFile(path.join(root, 'scripts/admin.mjs'), 'utf8'),
  fs.readFile(path.join(root, 'frontend/src/services/data.ts'), 'utf8'),
  fs.readFile(path.join(root, 'sql/setup.sql'), 'utf8'),
  fs.readFile(path.join(root, 'sql/check.sql'), 'utf8'),
])

assert.match(adminSource, /publish --confirm-publish/)
assert.match(adminSource, /Created pre-publication snapshot/)
assert.match(adminSource, /sessions revoke --id UUID --confirm-revoke/)
const storagePruner = adminSource.slice(
  adminSource.indexOf('const pruneStorage'),
  adminSource.indexOf('const uploadPrivateFiles'),
)
assert.match(storagePruner, /if \(validateOnly \|\| dryRun\)/)
const peopleImporter = adminSource.slice(
  adminSource.indexOf('const importPeople'),
  adminSource.indexOf('const importPageSupplements'),
)
assert.doesNotMatch(peopleImporter, /sort_order/)
assert.match(dataSource, /query = query\.eq\('hidden', hidden\)/)
assert.doesNotMatch(dataSource, /raw->>hidden/)

const openLimiterBranch = setupSql.slice(
  setupSql.indexOf('if recent_failures >= 20'),
  setupSql.indexOf('end if;', setupSql.indexOf('if recent_failures >= 20')),
)
assert.doesNotMatch(openLimiterBranch, /insert into public\.invite_code_attempts/i)
assert.match(checkSql, /invite\.rate_limit_no_write_amplification/)

console.log('Content governance tests passed.')

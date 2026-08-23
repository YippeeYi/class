import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsRoot = path.join(root, 'supabase', 'migrations')
const rollbacksRoot = path.join(root, 'supabase', 'rollbacks')
const migrationPattern = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/
const rollbackPattern = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.down\.sql$/
const baselineName = '20260823000000_baseline.sql'
const config = await readFile(path.join(root, 'supabase', 'config.toml'), 'utf8')
assert.match(config, /\[db\.migrations\][\s\S]*enabled = true/u)
assert.match(config, /\[db\.seed\][\s\S]*enabled = false/u)

const migrations = (await readdir(migrationsRoot))
  .filter((name) => name.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right, 'en'))
assert.ok(migrations.length > 0, 'at least one database migration is required')
assert.equal(migrations[0], baselineName, 'the immutable production baseline migration is missing')

const versions = new Set()
for (const name of migrations) {
  const match = migrationPattern.exec(name)
  assert.ok(match, `invalid migration filename: ${name}`)
  assert.ok(!versions.has(match[1]), `duplicate migration version: ${match[1]}`)
  versions.add(match[1])
  const sql = await readFile(path.join(migrationsRoot, name), 'utf8')
  assert.ok(sql.trim(), `empty migration: ${name}`)
  assert.doesNotMatch(sql, /\b(?:COMMIT|ROLLBACK)\s*;/iu, `${name} must not manage the CLI transaction`)
}

const rollbacks = (await readdir(rollbacksRoot))
  .filter((name) => name.endsWith('.down.sql'))
  .sort((left, right) => left.localeCompare(right, 'en'))
const rollbackMigrations = new Set()
for (const name of rollbacks) {
  const match = rollbackPattern.exec(name)
  assert.ok(match, `invalid rollback filename: ${name}`)
  const migrationName = `${match[1]}_${match[2]}.sql`
  assert.ok(migrations.includes(migrationName), `rollback has no matching migration: ${name}`)
  rollbackMigrations.add(migrationName)
}
for (const name of migrations.slice(1)) {
  assert.ok(rollbackMigrations.has(name), `migration requires a reviewed rollback companion: ${name}`)
}

if (migrations.length === 1) {
  const [setup, baseline] = await Promise.all([
    readFile(path.join(root, 'sql', 'setup.sql'), 'utf8'),
    readFile(path.join(migrationsRoot, baselineName), 'utf8'),
  ])
  assert.equal(baseline.replace(/\r\n/g, '\n'), setup.replace(/\r\n/g, '\n'))
}

console.log(
  `Database migration checks passed: migrations=${migrations.length}, rollback-companions=${rollbacks.length}.`,
)

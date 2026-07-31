import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const data = await readFrontend('src/services/data.ts')
assert.match(data, /const promises = new Map/, 'data requests need a shared promise cache')
assert.match(data, /promises\.delete\(key\)/, 'failed or forced resources must be evicted')
assert.match(data, /export function clearDataCache/, 'access removal must be able to clear data cache')
assert.match(data, /cached<RecordItem\[]>/, 'record reads must use the shared cache')
console.log('React data cache checks passed.')

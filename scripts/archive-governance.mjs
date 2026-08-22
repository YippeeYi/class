import path from 'node:path'

const VOLATILE_COLUMNS = new Set(['updated_at'])

const asText = (value) => String(value ?? '').trim()

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    )
  }
  return value ?? null
}

const comparableRow = (row, columns) => {
  return stableValue(
    Object.fromEntries(
      columns
        .filter((column) => !VOLATILE_COLUMNS.has(column))
        .map((column) => [column, row?.[column]]),
    ),
  )
}

const validCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(value))
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

const stringsIn = (value, output = []) => {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => stringsIn(item, output))
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => stringsIn(item, output))
  }
  return output
}

const markersIn = (value) => {
  const markers = []
  for (const source of stringsIn(value)) {
    for (const match of source.matchAll(/\[\[(person|author|record|material|quote):([^|\]\r\n]+)/g)) {
      markers.push({ type: match[1], id: match[2].trim() })
    }
  }
  return markers
}

const tableRows = (tables, name) => tables.get(name)?.rows || []

export function auditPublication({ tables, storageAssets, missingAssets = [] }) {
  const errors = []
  const warnings = []
  const add = (severity, code, message) => {
    ;(severity === 'error' ? errors : warnings).push({ code, message })
  }

  const records = tableRows(tables, 'class_records')
  const people = tableRows(tables, 'class_people')
  const pages = tableRows(tables, 'class_record_pages')
  const messages = tableRows(tables, 'class_page_messages')
  const supplements = tableRows(tables, 'class_page_supplements')
  const materials = tableRows(tables, 'class_materials')

  if (!records.length) add('error', 'records.empty', '没有可发布的普通记录。')
  if (!people.length) add('error', 'people.empty', '没有可发布的人物资料。')

  const recordIds = new Set()
  const recordTargets = new Set()
  for (const row of records) {
    const fileName = asText(row.file_name)
    const recordId = asText(row.record_id)
    if (!fileName || !fileName.toLowerCase().endsWith('.json')) {
      add('error', 'record.file-name', `记录文件名无效：${fileName || '(empty)'}`)
    }
    if (!recordId) add('error', 'record.id', `记录缺少 ID：${fileName || '(unknown)'}`)
    if (recordIds.has(recordId)) add('error', 'record.duplicate-id', `记录 ID 重复：${recordId}`)
    recordIds.add(recordId)
    recordTargets.add(fileName)
    recordTargets.add(fileName.replace(/\.json$/i, ''))
    recordTargets.add(recordId)
    if (!asText(row.content)) add('error', 'record.content', `记录正文为空：${fileName}`)
    if (!validCalendarDate(row.record_date)) {
      add('error', 'record.date', `记录日期不是有效日历日期：${fileName} (${row.record_date})`)
    }
    const rawHidden = row.raw?.hidden === true
    if (rawHidden !== (row.hidden === true)) {
      add('error', 'record.hidden-drift', `记录 hidden 列与 raw.hidden 不一致：${fileName}`)
    }
  }

  const peopleIds = new Set()
  for (const row of people) {
    const id = asText(row.id || row.person_id)
    if (!id) add('error', 'person.identity', '人物缺少 ID。')
    else if (!asText(row.name)) add('warning', 'person.name', `人物缺少姓名：${id}`)
    if (peopleIds.has(id)) add('error', 'person.duplicate-id', `人物 ID 重复：${id}`)
    peopleIds.add(id)
  }

  const materialIds = new Set()
  for (const row of materials) {
    const id = asText(row.material_id || row.id)
    if (!id || !asText(row.title) || !asText(row.content)) {
      add('error', 'material.required', `资料缺少 ID、标题或正文：${id || '(empty)'}`)
    }
    if (materialIds.has(id)) add('error', 'material.duplicate-id', `资料 ID 重复：${id}`)
    materialIds.add(id)
  }

  const pageIds = new Set(pages.map((row) => asText(row.page)).filter(Boolean))
  for (const row of pages) {
    const page = asText(row.page)
    for (const [column, label] of [
      ['start_file', '起始记录'],
      ['end_file', '结束记录'],
    ]) {
      const target = asText(row[column])
      if (target && !recordTargets.has(target) && !recordTargets.has(target.replace(/\.json$/i, ''))) {
        add('error', 'page.record-range', `书面页 ${page} 的${label}不存在：${target}`)
      }
    }
    const rawHidden = row.raw?.hidden === true
    if (rawHidden !== (row.hidden === true)) {
      add('error', 'page.hidden-drift', `书面页 hidden 列与 raw.hidden 不一致：${page}`)
    }
  }

  for (const row of [...messages, ...supplements]) {
    const page = asText(row.page)
    if (page && !pageIds.has(page)) {
      add('warning', 'page.unmapped-content', `页 ${page} 有箴言或补充，但不在书面页清单中。`)
    }
  }

  const quoteOwners = new Map()
  const contentRows = [...records, ...people, ...messages, ...supplements, ...materials]
  for (const row of contentRows) {
    const owner = asText(row.file_name || row.id || row.page || row.material_id || 'unknown')
    const canonicalContent = [
      row.content,
      row.bio,
      row.sections,
      row.thanks,
      row.original_images,
    ]
    for (const marker of markersIn(canonicalContent)) {
      if (!marker.id) {
        add('error', 'markup.empty-reference', `${owner} 含有空引用。`)
        continue
      }
      if ((marker.type === 'person' || marker.type === 'author') && !peopleIds.has(marker.id)) {
        add('warning', 'reference.person', `${owner} 引用了不存在的人物：${marker.id}`)
      } else if (marker.type === 'record' && !recordTargets.has(marker.id)) {
        add('error', 'reference.record', `${owner} 引用了不存在的记录：${marker.id}`)
      } else if (marker.type === 'material' && !materialIds.has(marker.id)) {
        add('error', 'reference.material', `${owner} 引用了不存在的资料：${marker.id}`)
      } else if (marker.type === 'quote') {
        const previous = quoteOwners.get(marker.id)
        if (previous && previous !== owner) {
          add('error', 'reference.quote-duplicate', `名言 ID ${marker.id} 同时出现在 ${previous} 与 ${owner}。`)
        } else quoteOwners.set(marker.id, owner)
      }
    }
  }

  for (const row of records) {
    const author = asText(row.author)
    if (author && author !== '???' && !peopleIds.has(author)) {
      add('warning', 'record.author', `记录 ${row.file_name} 的记录人未出现在人物表：${author}`)
    }
  }

  for (const item of missingAssets) {
    add('error', 'asset.missing', `引用的私有资源不存在：${item.localPath} → ${item.remotePath}`)
  }

  const remotePaths = [...storageAssets.keys()]
  const unsafe = remotePaths.filter((value) => {
    const normalized = value.replace(/\\/g, '/')
    return (
      normalized.startsWith('/') ||
      normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    )
  })
  unsafe.forEach((value) => add('error', 'asset.path', `资源远端路径不安全：${value}`))

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      tables: tables.size,
      records: records.length,
      people: people.length,
      pages: pages.length,
      messages: messages.length,
      supplements: supplements.length,
      materials: materials.length,
      quotes: quoteOwners.size,
      assets: storageAssets.size,
    },
  }
}

export function comparePublicationTable(plan, remoteRows) {
  const key = plan.onConflict
  const localByKey = new Map(plan.rows.map((row) => [asText(row[key]), row]))
  const remoteByKey = new Map(remoteRows.map((row) => [asText(row[key]), row]))
  const added = []
  const updated = []
  const unchanged = []
  const removed = []

  for (const [id, row] of localByKey) {
    const remote = remoteByKey.get(id)
    if (!remote) {
      added.push(id)
      continue
    }
    const columns = Object.keys(row)
    const same = JSON.stringify(comparableRow(row, columns)) === JSON.stringify(comparableRow(remote, columns))
    ;(same ? unchanged : updated).push(id)
  }
  for (const id of remoteByKey.keys()) {
    if (!localByKey.has(id)) removed.push(id)
  }
  return { added, updated, unchanged, removed }
}

export function buildPublicationDiff({ tables, remoteTables, storageAssets, remoteStorage }) {
  const database = {}
  for (const [table, plan] of tables) {
    database[table] = comparePublicationTable(plan, remoteTables.get(table) || [])
  }
  const desired = new Set(storageAssets.keys())
  const remote = new Set(remoteStorage)
  return {
    database,
    storage: {
      added: [...desired].filter((name) => !remote.has(name)).sort(),
      replaced: [...desired].filter((name) => remote.has(name)).sort(),
      removed: [...remote].filter((name) => !desired.has(name)).sort(),
    },
  }
}

export function publicationSummary(diff) {
  const database = Object.fromEntries(
    Object.entries(diff.database).map(([table, value]) => [
      table,
      Object.fromEntries(Object.entries(value).map(([key, items]) => [key, items.length])),
    ]),
  )
  return {
    database,
    storage: Object.fromEntries(
      Object.entries(diff.storage).map(([key, items]) => [key, items.length]),
    ),
  }
}

export function safeSnapshotPath(root, snapshotRoot, relativePath) {
  const base = path.resolve(root, snapshotRoot)
  const target = path.resolve(base, relativePath)
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error(`Snapshot path escaped its root: ${relativePath}`)
  }
  return target
}

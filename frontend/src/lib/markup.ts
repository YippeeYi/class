export type MarkupNode =
  | { type: 'text'; value: string }
  | {
      type: 'style'
      style: 'del' | 'under' | 'red' | 'hide' | 'sup' | 'sub' | 'center' | 'right'
      children: MarkupNode[]
    }
  | {
      type: 'reference'
      kind: 'person' | 'author' | 'quote' | 'record' | 'material'
      id: string
      labelSource: string
      children: MarkupNode[]
    }
  | { type: 'annotation'; note: string; children: MarkupNode[] }
  | { type: 'illustration'; path: string; children: MarkupNode[] }
  | { type: 'stack'; kind: 'frac' | 'arrow'; top: MarkupNode[]; bottom: MarkupNode[] }
  | { type: 'table'; rows: MarkupNode[][][] }

export type MarkupReferences = {
  participantIds: string[]
  extraAuthorIds: string[]
  quoteIds: string[]
  illustrationPaths: string[]
  personMarkers: Array<{ id: string; label: string }>
  quoteMarkers: Array<{ id: string; quote: string; label: string }>
}

const treeCache = new Map<string, MarkupNode[]>()
const referenceCache = new Map<string, MarkupReferences>()

function escapedAt(source: string, index: number) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function balancedEnd(source: string, start: number) {
  let depth = 1
  for (let index = start + 2; index < source.length - 1; index += 1) {
    if (!escapedAt(source, index) && source.startsWith('[[', index)) {
      depth += 1
      index += 1
    } else if (!escapedAt(source, index) && source.startsWith(']]', index)) {
      depth -= 1
      if (depth === 0) return index + 2
      index += 1
    }
  }
  return -1
}

function separatorIndex(source: string) {
  let depth = 0
  for (let index = 0; index < source.length; index += 1) {
    if (escapedAt(source, index)) continue
    if (source.startsWith('[[', index)) {
      depth += 1
      index += 1
    } else if (source.startsWith(']]', index) && depth > 0) {
      depth -= 1
      index += 1
    } else if (source[index] === '|' && depth === 0) return index
  }
  return -1
}

function splitOnce(source: string) {
  const index = separatorIndex(source)
  return index < 0 ? null : ([source.slice(0, index), source.slice(index + 1)] as const)
}

function splitAll(source: string) {
  const result: string[] = []
  let rest = source
  while (rest) {
    const index = separatorIndex(rest)
    if (index < 0) break
    result.push(rest.slice(0, index))
    rest = rest.slice(index + 1)
  }
  result.push(rest)
  return result
}

function illustrationPath(value: string) {
  const raw = value.trim()
  const hasControlCharacter = Array.from(raw).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!raw || /[\\?#%]/.test(raw) || hasControlCharacter || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(raw))
    return ''
  const hidden = raw.startsWith('hidden/')
  const file = hidden ? raw.slice(7) : raw
  if (!file || file.includes('/') || !/\.(?:png|jpe?g|gif|webp|svg)$/i.test(file)) return ''
  return `${hidden ? 'hidden/' : ''}data/attachments/${file}`
}

function textNode(value: string): MarkupNode {
  return { type: 'text', value }
}

function parseSquare(body: string, raw: string, depth: number): MarkupNode {
  const colon = body.indexOf(':')
  if (colon < 1) return textNode(raw)
  const kind = body.slice(0, colon)
  const payload = body.slice(colon + 1)
  const styles = new Set(['del', 'under', 'red', 'hide', 'sup', 'sub', 'center', 'right'])
  if (styles.has(kind) && payload) {
    return {
      type: 'style',
      style: kind as Extract<MarkupNode, { type: 'style' }>['style'],
      children: parseNodes(payload, depth + 1),
    }
  }
  if (kind === 'table') {
    const parts = splitAll(payload)
    const dimensions = /^(\d{1,2})x(\d{1,2})$/.exec(parts.shift() || '')
    if (!dimensions) return textNode(raw)
    const rowCount = Math.min(30, Number(dimensions[1]))
    const columnCount = Math.min(12, Number(dimensions[2]))
    const rows = Array.from({ length: rowCount }, (_, row) =>
      Array.from({ length: columnCount }, (_, column) =>
        parseNodes(parts[row * columnCount + column] || '', depth + 1),
      ),
    )
    return { type: 'table', rows }
  }
  const pair = splitOnce(payload)
  if (!pair) return textNode(raw)
  const [first, second] = pair
  if (
    ['person', 'author', 'quote', 'record', 'material'].includes(kind) &&
    /^[a-zA-Z0-9_.-]+$/.test(first)
  ) {
    return {
      type: 'reference',
      kind: kind as Extract<MarkupNode, { type: 'reference' }>['kind'],
      id: first.replace(kind === 'record' ? /\.json$/i : /$^/, ''),
      labelSource: second,
      children: parseNodes(second, depth + 1),
    }
  }
  if (kind === 'anno')
    return { type: 'annotation', note: first, children: parseNodes(second, depth + 1) }
  if (kind === 'illu') {
    const path = illustrationPath(first)
    return path
      ? { type: 'illustration', path, children: parseNodes(second, depth + 1) }
      : textNode(raw)
  }
  if (kind === 'frac' || kind === 'arrow')
    return {
      type: 'stack',
      kind,
      top: parseNodes(first, depth + 1),
      bottom: parseNodes(second, depth + 1),
    }
  return textNode(raw)
}

function parseNodes(source: string, depth = 0): MarkupNode[] {
  if (depth > 24) return [textNode(source)]
  const nodes: MarkupNode[] = []
  let plain = ''
  const flush = () => {
    if (plain) nodes.push(textNode(plain))
    plain = ''
  }
  for (let index = 0; index < source.length; ) {
    if (
      source[index] === '\\' &&
      index + 1 < source.length &&
      '\\|[]'.includes(source[index + 1] || '')
    ) {
      plain += source[index + 1]
      index += 2
      continue
    }
    if (source.startsWith('[[', index)) {
      const end = balancedEnd(source, index)
      if (end > 0) {
        flush()
        const raw = source.slice(index, end)
        nodes.push(parseSquare(raw.slice(2, -2), raw, depth))
        index = end
        continue
      }
    }
    plain += source[index]
    index += 1
  }
  flush()
  return nodes
}

export function parseMarkup(value: unknown) {
  const source = String(value ?? '')
  const cached = treeCache.get(source)
  if (cached) return cached
  const tree = parseNodes(source)
  if (treeCache.size > 2000) treeCache.clear()
  treeCache.set(source, tree)
  return tree
}

function nodesToText(nodes: MarkupNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.value
      if (
        node.type === 'style' ||
        node.type === 'reference' ||
        node.type === 'annotation' ||
        node.type === 'illustration'
      )
        return nodesToText(node.children)
      if (node.type === 'stack') return `${nodesToText(node.top)} ${nodesToText(node.bottom)}`
      return node.rows.flat().map(nodesToText).join(' ')
    })
    .join('')
}

export function stripMarkup(value: unknown) {
  return nodesToText(parseMarkup(value))
}

export function extractMarkupReferences(value: unknown) {
  const source = String(value ?? '')
  const cached = referenceCache.get(source)
  if (cached) return cached
  const participants = new Set<string>()
  const authors = new Set<string>()
  const quotes = new Set<string>()
  const illustrations = new Set<string>()
  const personMarkers: MarkupReferences['personMarkers'] = []
  const quoteMarkers: MarkupReferences['quoteMarkers'] = []
  const visit = (nodes: MarkupNode[]) => {
    for (const node of nodes) {
      if (node.type === 'reference') {
        if (node.kind === 'person') {
          participants.add(node.id)
          personMarkers.push({ id: node.id, label: node.labelSource })
        }
        if (node.kind === 'author') authors.add(node.id)
        if (node.kind === 'quote') {
          quotes.add(node.id)
          quoteMarkers.push({ id: node.id, quote: node.labelSource, label: node.labelSource })
        }
        visit(node.children)
      } else if (node.type === 'illustration') {
        illustrations.add(node.path)
        visit(node.children)
      } else if (node.type === 'style' || node.type === 'annotation') visit(node.children)
      else if (node.type === 'stack') {
        visit(node.top)
        visit(node.bottom)
      } else if (node.type === 'table') node.rows.flat().forEach(visit)
    }
  }
  visit(parseMarkup(source))
  const result = {
    participantIds: [...participants],
    extraAuthorIds: [...authors],
    quoteIds: [...quotes],
    illustrationPaths: [...illustrations],
    personMarkers,
    quoteMarkers,
  }
  if (referenceCache.size > 2000) referenceCache.clear()
  referenceCache.set(source, result)
  return result
}

export function extractParticipantIds(value: unknown) {
  return extractMarkupReferences(value).participantIds
}

export function extractAuthorIds(record: { author?: string; content?: string }) {
  return [
    ...new Set([record.author || '', ...extractMarkupReferences(record.content).extraAuthorIds]),
  ].filter(Boolean)
}

export function extractQuoteMarkers(value: unknown) {
  return extractMarkupReferences(value).quoteMarkers
}

export function countTextCharacters(value: unknown) {
  return (
    stripMarkup(value).match(/[\u4e00-\u9fffA-Za-z0-9\u2460-\u2473\u3251-\u325f\u32b1-\u32bf]/g) ||
    []
  ).length
}

export function recordAnchor(record: { fileName?: string; id?: string }) {
  return `record-${String(record.fileName || record.id || '')
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

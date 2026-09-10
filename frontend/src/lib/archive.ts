export function normalizeText(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('zh-CN')
}

export function normalizeRecordKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/^data\/record\//i, '')
    .replace(/\.json$/i, '')
}

export function unique<T>(items: T[]) {
  return [...new Set(items)]
}

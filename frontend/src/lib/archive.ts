export function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

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

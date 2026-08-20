import { getStoredAccessToken } from '@/features/auth/auth-storage'
import { extractQuoteMarkers } from '@/lib/markup'
import { buildSupplementalRecords } from '@/lib/record-identity'
import { clearRuntimeCache, loadCached } from '@/services/cache'
import { getSupabase, supabaseConfig } from '@/services/supabase'
import type {
  CreditsPage,
  Material,
  PageMessage,
  PageSupplement,
  Person,
  QuizQuestion,
  Quote,
  RecordItem,
  RecordPage,
} from '@/types/domain'

type Row = Record<string, unknown>
const signedUrls = new Map<string, { promise: Promise<string>; refreshAt: number }>()
export const DEFAULT_ASSET_PREVIEW_WIDTH = 1280
export const DEFAULT_ASSET_PREVIEW_QUALITY = 72
export type AssetVariant = 'original' | 'preview'
type AssetSignOptions = {
  expiresIn?: number
  forceRefresh?: boolean
  variant?: AssetVariant
  width?: number
  quality?: number
}

function cached<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  return loadCached({ key, loader, force })
}

function objectValue(value: unknown): Row {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function bool(value: unknown) {
  return value === true || text(value).trim().toLowerCase() === 'true'
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : []
}

function currentClient() {
  const token = getStoredAccessToken()
  if (!token) throw new Error('访问凭证不可用，请重新验证邀请码。')
  return getSupabase(token)
}

export function clearDataCache() {
  signedUrls.clear()
  clearRuntimeCache()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => signedUrls.clear())
}

export function loadRecords({ hidden = false, force = false } = {}) {
  return loadCached<RecordItem[]>({
    key: `records:${hidden}`,
    force,
    persistent: !hidden,
    sessionTtl: hidden ? 0 : undefined,
    loader: async () => {
      let query = currentClient()
        .from(supabaseConfig.tables.records)
        .select('*')
        .order('record_index', { ascending: true })
      query = hidden
        ? query.eq('raw->>hidden', 'true')
        : query.or('raw->>hidden.is.null,raw->>hidden.neq.true')
      const { data, error } = await query
      if (error) throw error
      return ((data || []) as Row[])
        .map((row, index) => {
          const raw = objectValue(row.raw)
          const fileName = text(row.file_name || raw.fileName || raw.id || `record-${index + 1}`)
          const content = text(row.content || raw.text || raw.content)
          const attachments = Array.isArray(row.attachments)
            ? row.attachments
            : Array.isArray(raw.attachments)
              ? raw.attachments
              : []
          return {
            ...raw,
            id: text(row.record_id || raw.id || fileName),
            fileName,
            recordIndex: Number(row.record_index ?? raw.recordIndex ?? index + 1),
            date: text(row.record_date || raw.date),
            time: text(row.record_time || raw.time),
            author: text(row.author || raw.author || raw.recorder),
            recorder: text(row.author || raw.recorder || raw.author),
            content,
            text: content,
            importance: text(row.importance || raw.importance),
            attachments: attachments.filter((item): item is { file: string; name?: string } => {
              return Boolean(item && typeof item === 'object' && text((item as Row).file))
            }),
            hidden: bool(Object.hasOwn(raw, 'hidden') ? raw.hidden : row.hidden),
            imagePath: text(row.image_path || raw.imagePath || raw.image || raw.pageImage),
          } satisfies RecordItem
        })
        .filter((item) => item.hidden === hidden)
    },
  })
}

export function loadPeople(force = false) {
  return cached<Person[]>(
    'people',
    async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.people)
        .select('*')
        .order('id', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[]).map((row, index) => {
        const raw = objectValue(row.raw)
        return {
          ...raw,
          id: text(row.person_id || raw.id || raw.name || `person-${index + 1}`),
          name: text(row.name || raw.name || raw.displayName || raw.display_name),
          aliases: stringList(row.aliases || raw.aliases),
          alias: text(row.alias || raw.alias),
          role: text(row.role || raw.role || 'student'),
          subject: text(row.subject ?? raw.subject),
          main: row.main === true || raw.main === true,
          bio: text(row.bio || raw.bio),
          avatarUrl: text(row.avatar_url || raw.avatarUrl || raw.avatar),
        }
      }) as Person[]
    },
    force,
  )
}

export async function loadQuotes(records?: RecordItem[]) {
  return cached<Quote[]>('quotes', async () => {
    const source = records || (await loadRecords())
    const map = new Map<string, Quote>()
    for (const record of source) {
      for (const marker of extractQuoteMarkers(record.content)) {
        if (!marker.id || map.has(marker.id)) continue
        map.set(marker.id, {
          id: marker.id,
          quote: marker.quote,
          content: marker.quote,
          recordFile: record.fileName || record.id,
          sourceDate: record.date,
        })
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sourceDate.localeCompare(b.sourceDate) || a.id.localeCompare(b.id),
    )
  })
}

export function loadMaterials(force = false) {
  return cached<Material[]>(
    'materials',
    async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.materials)
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[])
        .map((row, index) => {
          const raw = objectValue(row.raw)
          return {
            ...raw,
            id: text(row.material_id || raw.id || `material-${index + 1}`),
            title: text(row.title || raw.title || raw.name),
            content: text(row.content || raw.content || raw.description),
          } as Material
        })
        .filter((item) => item.id && item.title)
    },
    force,
  )
}

export function loadQuizQuestions(force = false) {
  return loadCached<QuizQuestion[]>({
    key: 'quiz',
    force,
    persistent: false,
    sessionTtl: 0,
    loader: async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.quizQuestions)
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[]).map((row, index) => {
        const raw = objectValue(row.raw)
        const contentKeys = [
          row.content_key,
          row.question_group,
          raw.contentKey,
          raw.content,
          raw.group,
        ]
          .map(text)
          .filter(Boolean)
        return {
          ...raw,
          id: text(raw.id || row.id || `quiz-${index + 1}`),
          contentKey: contentKeys[0] || '',
          contentKeys: [...new Set(contentKeys)],
          type: text(row.question_type || raw.type || 'choice'),
          prompt: text(row.prompt || raw.prompt),
          choices: stringList(row.choices || raw.choices),
          answer: text(row.answer || raw.answer),
          explanation: text(row.explanation || raw.explanation),
          image: normalizePrivatePath(row.image_path || raw.image || raw.imagePath, 'images/quiz/'),
          imageVersion: text(row.updated_at || raw.updatedAt || raw.imageVersion),
        }
      }) as QuizQuestion[]
    },
  })
}

export function loadRecordPages(hidden = false) {
  return loadCached<RecordPage[]>({
    key: `record-pages:${hidden}`,
    persistent: !hidden,
    sessionTtl: hidden ? 0 : undefined,
    loader: async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.recordPages)
        .select('*')
        .eq('hidden', hidden)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[]).map((row, index) => {
        const raw = objectValue(row.raw)
        return {
          ...raw,
          page: text(row.page ?? raw.page ?? index + 1),
          startFile: text(row.start_file || raw.startFile || raw.start),
          endFile: text(row.end_file || raw.endFile || raw.end),
          imagePath: normalizePrivatePath(row.image_path || raw.imagePath || raw.image),
          hidden: bool(row.hidden ?? raw.hidden),
        } as RecordPage
      })
    },
  })
}

export function loadPageMessages(force = false) {
  return cached<PageMessage[]>(
    'page-messages',
    async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.pageMessages)
        .select('*')
        .order('page', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[])
        .map((row) => {
          const raw = objectValue(row.raw)
          return {
            ...raw,
            page: text(row.page ?? raw.page).trim(),
            content: text(row.content || raw.content || raw.text),
            author: text(row.author || raw.author || raw.recorder),
          } as PageMessage
        })
        .filter((item) => item.page && item.content)
    },
    force,
  )
}

export function loadPageSupplements({ hidden = false, force = false } = {}) {
  return loadCached<PageSupplement[]>({
    key: `page-supplements:${hidden}`,
    force,
    persistent: !hidden,
    sessionTtl: hidden ? 0 : undefined,
    loader: async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.pageSupplements)
        .select('*')
        .eq('hidden', hidden)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data || []) as Row[])
        .map((row, index) => {
          const raw = objectValue(row.raw)
          const page = text(row.page ?? raw.page).trim()
          const supplementIndex = Number(row.supplement_index ?? raw.supplementIndex ?? index + 1)
          return {
            ...raw,
            id: text(row.file_name || raw.id || `supplement-${page}-${supplementIndex}`),
            fileName: text(row.file_name || raw.fileName),
            page,
            supplementIndex,
            author: text(row.author || raw.author || raw.recorder),
            content: text(row.content || raw.content || raw.text),
            hidden: bool(row.hidden ?? raw.hidden),
            importance: text(raw.importance || 'normal'),
            date: text(raw.date),
            time: text(raw.time),
          } as PageSupplement
        })
        .filter((item) => item.page && item.content && item.hidden === hidden)
    },
  })
}

export async function loadSupplementalRecords({ hidden = false, force = false } = {}) {
  const [messages, supplements] = await Promise.all([
    hidden ? Promise.resolve([]) : loadPageMessages(force),
    loadPageSupplements({ hidden, force }),
  ])
  return buildSupplementalRecords(messages, supplements)
}

function normalizeTextItems(value: unknown) {
  if (!Array.isArray(value)) return text(value).trim() ? [text(value).trim()] : []
  return value
    .map((item) =>
      typeof item === 'object' && item
        ? text((item as Row).content || (item as Row).text || (item as Row).label)
        : text(item),
    )
    .map((item) => item.trim())
    .filter(Boolean)
}

export function loadCredits(force = false) {
  return cached<CreditsPage | null>(
    'credits',
    async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.creditsPage)
        .select('*')
        .eq('id', 'main')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as Row
      const raw = objectValue(row.raw)
      const sectionsSource = row.sections ?? raw.sections
      const imagesSource = row.original_images ?? raw.originalImages ?? raw.original_images
      return {
        id: text(row.id || raw.id || 'main'),
        title: text(row.title ?? raw.title),
        sections: (Array.isArray(sectionsSource) ? sectionsSource : []).map((value, index) => {
          const item = objectValue(value)
          return {
            id: text(item.id || `section-${index + 1}`),
            title: text(item.title || item.name),
            members: normalizeTextItems(item.members || item.items || item.content || item.text),
          }
        }),
        thanks: normalizeTextItems(row.thanks ?? raw.thanks),
        originalImages: (Array.isArray(imagesSource) ? imagesSource : []).map((value, index) => {
          const item = objectValue(value)
          return {
            id: text(item.id || `image-${index + 1}`),
            title: text(item.title || item.name),
            content: text(item.content || item.text || item.description),
          }
        }),
        updatedAt: text(row.updated_at || raw.updatedAt || raw.updated_at),
      }
    },
    force,
  )
}

export async function hasAdminAccess() {
  const { data, error } = await currentClient().rpc('has_class_record_admin_access', {})
  return !error && data === true
}

export function normalizePrivatePath(value: unknown, requiredPrefix = '') {
  const raw = text(value).trim().replace(/^\/+/, '').replace(/\\/g, '/')
  if (
    !raw ||
    /^https?:\/\//i.test(raw) ||
    raw.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  )
    return ''
  const bucketPrefix = `${supabaseConfig.bucket}/`
  const path = raw.startsWith(bucketPrefix) ? raw.slice(bucketPrefix.length) : raw
  return requiredPrefix && !path.startsWith(requiredPrefix) ? '' : path
}

function isSensitivePath(path: string) {
  return (
    path === 'images/private/meal-map.png' ||
    path.startsWith('hidden/') ||
    path.startsWith('images/quiz/')
  )
}

export async function signAssetUrl(path: string, options: number | AssetSignOptions = {}) {
  const safePath = normalizePrivatePath(path)
  if (!safePath) return ''
  const settings: AssetSignOptions = typeof options === 'number' ? { expiresIn: options } : options
  const variant = settings.variant || 'original'
  const width = Math.round(
    Math.min(2048, Math.max(160, settings.width || DEFAULT_ASSET_PREVIEW_WIDTH)),
  )
  const quality = Math.round(
    Math.min(92, Math.max(40, settings.quality || DEFAULT_ASSET_PREVIEW_QUALITY)),
  )
  const configured = isSensitivePath(safePath) ? 180 : 600
  const expiresIn = Math.min(configured, Math.max(30, settings.expiresIn || configured))
  const key = `asset:${safePath}:${expiresIn}:${variant}:${variant === 'preview' ? `${width}:${quality}` : 'source'}`
  if (settings.forceRefresh) signedUrls.delete(key)
  const cachedUrl = signedUrls.get(key)
  if (cachedUrl && cachedUrl.refreshAt > Date.now()) return cachedUrl.promise
  const promise = (async () => {
    // Storage transformations keep the original object path and RLS policy while
    // producing a separately cached, modern-format rendition for inline display.
    const { data, error } = await currentClient()
      .storage.from(supabaseConfig.bucket)
      .createSignedUrl(
        safePath,
        Math.min(900, Math.max(30, expiresIn)),
        variant === 'preview' ? { transform: { width, quality, resize: 'contain' } } : undefined,
      )
    if (error) throw error
    return data.signedUrl
  })().catch((error) => {
    signedUrls.delete(key)
    throw error
  })
  signedUrls.set(key, { promise, refreshAt: Date.now() + expiresIn * 800 })
  return promise
}

export function loadMealMapMetadata(force = false) {
  return loadCached<{ width: number; height: number } | null>({
    key: 'private-asset:meal-map:dimensions',
    force,
    loader: async () => {
      const { data, error } = await currentClient()
        .from(supabaseConfig.tables.privateAssets)
        .select('asset_key,width,height,updated_at')
        .eq('asset_key', 'meal-map')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { width: Number(data.width) || 4838, height: Number(data.height) || 2721 }
    },
  })
}

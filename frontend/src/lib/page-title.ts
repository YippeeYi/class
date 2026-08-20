import { normalizeAppPathname } from '@/lib/app-route'

export const SITE_TITLE = '编日史'

export const NAVIGATION_PAGE_NAMES = {
  '/': '导览',
  '/records': '记录',
  '/people': '人物',
  '/quotes': '名言',
  '/timeline': '统计',
  '/search': '搜索',
  '/quiz': '答题',
  '/materials': '资料',
  '/map': '地图',
  '/backgrounds': '风格',
  '/credits': '致谢',
} as const

export type PageName = (typeof NAVIGATION_PAGE_NAMES)[keyof typeof NAVIGATION_PAGE_NAMES]

const ROUTE_PAGE_NAMES: Readonly<Record<string, PageName | '验证' | '错误'>> = {
  ...NAVIGATION_PAGE_NAMES,
  '/person': NAVIGATION_PAGE_NAMES['/people'],
  '/auth': '验证',
  '/404': '错误',
}

export function pageNameForPath(pathname: string) {
  return ROUTE_PAGE_NAMES[normalizeAppPathname(pathname)] || '错误'
}

export function formatRouteDocumentTitle(pathname: string) {
  return `${SITE_TITLE}·${pageNameForPath(pathname)}`
}

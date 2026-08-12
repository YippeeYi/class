import {
  BookOpenText,
  BrainCircuit,
  ChartNoAxesCombined,
  FileText,
  Home,
  Image,
  LogOut,
  Map as MapIcon,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router'

import { PAGE_HEADER_ACTIONS_ID, PageHeaderProvider } from '@/components/layout/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/auth-context'
import { completeRecordJump, isRecordJumpActive } from '@/lib/record-navigation'
import { preloadRoute } from '@/lib/route-preload'
import { cn } from '@/lib/utils'

const navigation = [
  { to: '/', label: '导览', icon: Home },
  { to: '/records', label: '记录', icon: BookOpenText },
  { to: '/people', label: '人物', icon: Users },
  { to: '/quotes', label: '名言', icon: MessageSquareQuote },
  { to: '/timeline', label: '统计', icon: ChartNoAxesCombined },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/quiz', label: '答题', icon: BrainCircuit },
  { to: '/materials', label: '资料', icon: FileText },
  { to: '/map', label: '地图', icon: MapIcon },
  { to: '/backgrounds', label: '风格', icon: Image },
  { to: '/credits', label: '致谢', icon: Sparkles },
]

const FULLSCREEN_STORAGE_KEY = 'classRecord:keepFullscreen'
const viewportLockedPaths = new Set(['/materials', '/quiz', '/map'])
const wideContentPaths = new Set(['/timeline'])

function navigationPath(pathname: string) {
  return pathname === '/person' ? '/people' : pathname
}

function RouteScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef<{ pathname: string; search: string } | null>(null)

  useLayoutEffect(() => {
    const last = previous.current
    const isInitialRender = last === null
    const changedPage = last?.pathname !== location.pathname
    const changedPerson = location.pathname === '/person' && last?.search !== location.search
    // Record links own their one clamped movement. Resetting here in the same
    // layout commit races the records page when its data is already cached and
    // produces the visible overshoot/rebound that normal route resets avoid.
    const recordJumpOwnsScroll = location.pathname === '/records' && isRecordJumpActive()
    if (location.pathname !== '/records' && isRecordJumpActive()) completeRecordJump()
    if (
      !recordJumpOwnsScroll &&
      (isInitialRender || (navigationType !== 'POP' && (changedPage || changedPerson)))
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    previous.current = { pathname: location.pathname, search: location.search }
  }, [location.pathname, location.search, navigationType])

  return null
}

function CloseMobileSidebar() {
  const { setOpenMobile } = useSidebar()
  useEffect(() => {
    setOpenMobile(false)
  }, [setOpenMobile])
  return null
}

function AppSidebar({ onClearAccess }: { onClearAccess: () => Promise<void> }) {
  const location = useLocation()
  const activePath = navigationPath(location.pathname)

  return (
    <Sidebar collapsible="icon" className="app-sidebar">
      <CloseMobileSidebar key={location.pathname} />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="编日史"
              onPointerEnter={() => void preloadRoute('/')}
              onFocus={() => void preloadRoute('/')}
              render={<Link to="/" />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                编
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading font-semibold">编日史</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Class Archive</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主要导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({ to, label, icon: Icon }) => {
                const isActive =
                  to === '/'
                    ? activePath === '/'
                    : activePath === to || activePath.startsWith(`${to}/`)
                const destination =
                  location.pathname === to
                    ? {
                        pathname: location.pathname,
                        search: location.search,
                        hash: location.hash,
                      }
                    : to

                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      className="transition-colors duration-150 data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary/90 data-active:hover:text-sidebar-primary-foreground"
                      onPointerEnter={() => void preloadRoute(to)}
                      onFocus={() => void preloadRoute(to)}
                      render={<NavLink to={destination} />}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <SidebarMenuButton tooltip="移除访问权限">
                    <LogOut />
                    <span>移除访问权限</span>
                  </SidebarMenuButton>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>移除本机访问权限？</AlertDialogTitle>
                  <AlertDialogDescription>
                    这会清除本机保存的访问凭证、档案缓存和私有图片缓存；下次访问需要新的邀请码。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void onClearAccess()}>
                    移除并清理
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail className="after:rounded-full after:transition-colors after:duration-200 hover:after:bg-sidebar-primary/55 active:after:bg-sidebar-primary" />
    </Sidebar>
  )
}

export function AppShell() {
  const { clearAccess } = useAuth()
  const location = useLocation()
  const isViewportLocked = viewportLockedPaths.has(location.pathname)
  const isWideContent = wideContentPaths.has(location.pathname)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [registeredTitle, setRegisteredTitle] = useState<{
    token: symbol
    title: string
  } | null>(null)
  const registerTitle = useCallback((title: string) => {
    const token = Symbol(title)
    setRegisteredTitle({ token, title })
    return () => setRegisteredTitle((current) => (current?.token === token ? null : current))
  }, [])
  const sectionTitle = navigation.find((item) => item.to === navigationPath(location.pathname))
  const pageTitle = sectionTitle?.label || registeredTitle?.title || '档案'

  useEffect(() => {
    const root = document.documentElement
    if (isViewportLocked) {
      root.dataset.viewportLocked = 'true'
      document.body.dataset.viewportLocked = 'true'
    } else {
      delete root.dataset.viewportLocked
      delete document.body.dataset.viewportLocked
    }
    return () => {
      delete root.dataset.viewportLocked
      delete document.body.dataset.viewportLocked
    }
  }, [isViewportLocked])

  useEffect(() => {
    const update = () => {
      const active = Boolean(document.fullscreenElement)
      setFullscreen(active)
      try {
        if (active) sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, '1')
        else sessionStorage.removeItem(FULLSCREEN_STORAGE_KEY)
      } catch {
        // Fullscreen remains usable when storage is unavailable.
      }
    }
    const shouldRestore = () => {
      try {
        return sessionStorage.getItem(FULLSCREEN_STORAGE_KEY) === '1'
      } catch {
        return false
      }
    }
    const restore = (event?: PointerEvent) => {
      if (event?.target instanceof Element && event.target.closest('[data-fullscreen-toggle]'))
        return
      if (!shouldRestore() || document.fullscreenElement || !document.fullscreenEnabled) return
      void document.documentElement.requestFullscreen().catch(() => undefined)
    }
    const preserveBeforeExit = () => {
      if (!document.fullscreenElement) return
      try {
        sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, '1')
      } catch {
        // Ignore storage failures during navigation.
      }
    }
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('pointerdown', restore, { once: true, capture: true })
    window.addEventListener('pagehide', preserveBeforeExit)
    restore()
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('pointerdown', restore, true)
      window.removeEventListener('pagehide', preserveBeforeExit)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // Fullscreen may be blocked by browser or embedding policy.
    }
  }

  return (
    <PageHeaderProvider registerTitle={registerTitle}>
      <TooltipProvider>
        <SidebarProvider>
          <RouteScrollManager />
          <a
            href="#page-content"
            className="sr-only fixed left-3 top-3 z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only"
          >
            跳到主要内容
          </a>
          <AppSidebar onClearAccess={clearAccess} />
          <SidebarInset
            className={cn('app-main-surface', isViewportLocked && 'h-svh min-h-0 overflow-hidden')}
          >
            <header className="app-topbar sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/70 px-3 sm:px-4">
              <SidebarTrigger />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-2">
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbLink
                      render={<Link to="/" />}
                      className="truncate font-heading text-base font-semibold text-foreground sm:text-lg"
                    >
                      编日史
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="shrink-0 text-muted-foreground/70" />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate text-sm font-medium sm:text-base">
                      {pageTitle}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div
                id={PAGE_HEADER_ACTIONS_ID}
                className="ml-auto hidden min-w-0 shrink-0 items-center gap-2 sm:flex"
              />
              {document.fullscreenEnabled && (
                <Button
                  className="shrink-0"
                  data-fullscreen-toggle
                  variant="ghost"
                  size="icon-sm"
                  aria-label={fullscreen ? '退出全屏' : '进入全屏'}
                  title={fullscreen ? '退出全屏' : '进入全屏'}
                  onClick={() => void toggleFullscreen()}
                >
                  {fullscreen ? <Minimize2 /> : <Maximize2 />}
                </Button>
              )}
            </header>
            <div
              id="page-content"
              tabIndex={-1}
              key={location.pathname}
              className={cn(
                'mx-auto w-full px-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:px-7 lg:px-10',
                isViewportLocked
                  ? 'h-[calc(100dvh-4rem)] min-h-0 max-w-[96rem] overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-7 lg:py-5'
                  : 'min-h-[calc(100svh-4rem)] py-5 pb-12 sm:py-6 sm:pb-16 lg:py-7',
                !isViewportLocked && (isWideContent ? 'max-w-[90rem]' : 'max-w-6xl'),
              )}
            >
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </PageHeaderProvider>
  )
}

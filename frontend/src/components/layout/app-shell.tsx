import {
  BookOpenText,
  BrainCircuit,
  Clock3,
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
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

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
import { preloadRoute } from '@/lib/route-preload'
import { cn } from '@/lib/utils'

const navigation = [
  { to: '/', label: '导览', icon: Home },
  { to: '/records', label: '记录', icon: BookOpenText },
  { to: '/people', label: '人物', icon: Users },
  { to: '/quotes', label: '名言', icon: MessageSquareQuote },
  { to: '/timeline', label: '时间线', icon: Clock3 },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/quiz', label: '答题', icon: BrainCircuit },
  { to: '/materials', label: '资料', icon: FileText },
  { to: '/map', label: '觅食地图', icon: MapIcon },
  { to: '/backgrounds', label: '背景', icon: Image },
  { to: '/credits', label: '致谢', icon: Sparkles },
]

const FULLSCREEN_STORAGE_KEY = 'classRecord:keepFullscreen'

function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])
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

  return (
    <Sidebar collapsible="icon">
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
                    ? location.pathname === '/'
                    : location.pathname === to || location.pathname.startsWith(`${to}/`)

                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      className="transition-colors duration-150 data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary/90 data-active:hover:text-sidebar-primary-foreground"
                      onPointerEnter={() => void preloadRoute(to)}
                      onFocus={() => void preloadRoute(to)}
                      render={<NavLink to={to} />}
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
  const isMaterialsPage = location.pathname === '/materials'
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))

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
    <TooltipProvider>
      <SidebarProvider>
        <ScrollToTop key={location.pathname} />
        <a
          href="#page-content"
          className="sr-only fixed left-3 top-3 z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only"
        >
          跳到主要内容
        </a>
        <AppSidebar onClearAccess={clearAccess} />
        <SidebarInset className="bg-background/78">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/84 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <span className="font-heading text-lg font-semibold">编日史</span>
            {document.fullscreenEnabled && (
              <Button
                className="ml-auto"
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
              'mx-auto w-full max-w-6xl px-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:px-7 lg:px-10',
              isMaterialsPage
                ? 'h-[calc(100svh-4rem)] min-h-0 overflow-hidden py-6 pb-20 sm:py-7 sm:pb-20 lg:py-8 lg:pb-20'
                : 'min-h-[calc(100svh-4rem)] py-8 pb-24 sm:py-10 sm:pb-24 lg:py-12 lg:pb-24',
            )}
          >
            <Outlet />
          </div>
          <footer className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40">
            <Button
              size="sm"
              variant={location.pathname === '/credits' ? 'default' : 'outline'}
              className="bg-background/90 shadow-sm backdrop-blur-md transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
              render={<Link to="/credits" />}
              aria-current={location.pathname === '/credits' ? 'page' : undefined}
              onPointerEnter={() => void preloadRoute('/credits')}
              onFocus={() => void preloadRoute('/credits')}
            >
              <Sparkles data-icon="inline-start" />
              制作与致谢
            </Button>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

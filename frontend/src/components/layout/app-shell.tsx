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
            <SidebarMenuButton size="lg" tooltip="编日史" render={<Link to="/" />}>
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
      <SidebarRail />
    </Sidebar>
  )
}

export function AppShell() {
  const { clearAccess } = useAuth()
  const location = useLocation()
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
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
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/82 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <span className="font-heading text-lg font-semibold">编日史</span>
            {document.fullscreenEnabled && (
              <Button
                className="ml-auto"
                variant="ghost"
                size="icon-sm"
                aria-label={fullscreen ? '退出全屏' : '进入全屏'}
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
            className="mx-auto min-h-[calc(100svh-9rem)] w-full max-w-6xl px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12"
          >
            <Outlet />
          </div>
          <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t border-border/60 px-4 py-6 text-xs text-muted-foreground sm:px-7 lg:px-10">
            <span>班级共同记忆档案</span>
            <Link className="text-primary underline-offset-4 hover:underline" to="/credits">
              制作与致谢
            </Link>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

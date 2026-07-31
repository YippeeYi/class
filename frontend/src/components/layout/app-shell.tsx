import {
  BookOpenText,
  BrainCircuit,
  Clock3,
  FileText,
  Home,
  Image,
  LogOut,
  Map as MapIcon,
  MessageSquareQuote,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

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

function AppSidebar({ onClearAccess }: { onClearAccess: () => void }) {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
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
            <SidebarMenuButton tooltip="移除访问权限" onClick={onClearAccess}>
              <LogOut />
              <span>移除访问权限</span>
            </SidebarMenuButton>
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

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar onClearAccess={clearAccess} />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/82 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <span className="font-heading text-lg font-semibold">编日史</span>
          </header>
          <div
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

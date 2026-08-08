import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FilePlus2,
  Trophy,
  Store,
  Bell,
  UserRound,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

const primary: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Ranking", url: "/app/ranking", icon: Trophy },
  { title: "Marketplace", url: "/app/marketplace", icon: Store },
];

const athleteOnly: NavItem[] = [
  { title: "New request", url: "/app/requests/new", icon: FilePlus2 },
];

const account: NavItem[] = [
  { title: "Notifications", url: "/app/notifications", icon: Bell },
  { title: "Profile", url: "/app/profile", icon: UserRound },
  { title: "Settings", url: "/app/settings", icon: SettingsIcon },
];

export function AppSidebar({ isAthlete }: { isAthlete: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (url: string) =>
    url === "/app" ? pathname === "/app" : pathname.startsWith(url);

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <Link to={item.url} className="flex items-center gap-3">
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="text-data text-[0.65rem] uppercase tracking-[0.3em] text-primary">
          {collapsed ? "SF" : "ScienceFit"}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderItems(primary)}
              {isAthlete && renderItems(athleteOnly)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(account)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

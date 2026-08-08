import { useMemo, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, UserRound, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { notificationsQuery, viewerQuery } from "@/lib/queries";

const SEGMENT_LABELS: Record<string, string> = {
  app: "Dashboard",
  requests: "Requests",
  new: "New request",
  challenges: "Challenges",
  builder: "Program builder",
  results: "Results",
  evaluations: "Evaluation",
  ranking: "Ranking",
  marketplace: "Marketplace",
  notifications: "Notifications",
  profile: "Profile",
  settings: "Settings",
};

function label(segment: string) {
  return SEGMENT_LABELS[segment] ?? (segment.length > 12 ? `${segment.slice(0, 8)}…` : segment);
}

function Breadcrumbs() {
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const segments = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const last = index === segments.length - 1;
          return (
            <BreadcrumbItem key={href}>
              {last ? (
                <BreadcrumbPage>{label(segment)}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label(segment)}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: viewer } = useQuery(viewerQuery);
  const { data: notifications } = useQuery(notificationsQuery);

  const unread = notifications?.unread ?? 0;
  const displayName = viewer?.profile?.display_name ?? "Account";
  const isAthlete = Boolean(viewer?.roles?.includes("athlete"));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar isAthlete={isAthlete} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-5">
            <SidebarTrigger aria-label="Toggle navigation" />
            <div className="hidden min-w-0 flex-1 sm:block">
              <Breadcrumbs />
            </div>
            <div className="flex flex-1 items-center justify-end gap-1 sm:flex-none">
              <Link
                to="/app/notifications"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                className="relative inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary"
              >
                <Bell className="size-4" aria-hidden="true" />
                {unread > 0 && (
                  <span className="text-data absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-[0.6rem] leading-4 text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="User menu"
                  className="inline-flex size-10 items-center justify-center rounded-md transition-colors hover:bg-secondary"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-secondary text-xs text-foreground">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/app/profile">
                      <UserRound className="size-4" aria-hidden="true" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/settings">
                      <SettingsIcon className="size-4" aria-hidden="true" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1 px-3 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  History,
  ListChecks,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { athleteDashboardQuery, notificationsQuery } from "@/lib/queries";

const ACTIVE_CHALLENGE_STATES = new Set(["PUBLISHED", "ACTIVE", "LOCKED", "EVALUATING"]);

function formatDate(value: string | null | undefined) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deadlineCountdown(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return null;
  const diffMs = new Date(deadlineAt).getTime() - Date.now();
  if (diffMs <= 0) return "Deadline passed";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d remaining`;
}

type ActivityItem = {
  key: string;
  date: string;
  label: string;
  detail: string;
};

export function AthleteDashboardScreen() {
  const dashboard = useQuery(athleteDashboardQuery);
  const notifications = useQuery(notificationsQuery);

  const challenges = dashboard.data?.challenges ?? [];
  const requests = dashboard.data?.requests ?? [];
  const workoutLogs = dashboard.data?.workoutLogs ?? [];

  const currentChallenges = useMemo(
    () => challenges.filter((c) => ACTIVE_CHALLENGE_STATES.has(c.state)),
    [challenges],
  );

  const completedChallenges = useMemo(
    () => challenges.filter((c) => c.state === "COMPLETED"),
    [challenges],
  );

  const progress = useMemo(() => {
    if (workoutLogs.length === 0) return null;
    const completed = workoutLogs.filter((l) => l.completed).length;
    const recent = workoutLogs.slice(0, 14);
    const recentCompleted = recent.filter((l) => l.completed).length;
    return {
      total: workoutLogs.length,
      completed,
      adherence: Math.round((completed / workoutLogs.length) * 100),
      recentAdherence:
        recent.length === 0 ? 0 : Math.round((recentCompleted / recent.length) * 100),
      recentCount: recent.length,
    };
  }, [workoutLogs]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const r of requests) {
      items.push({
        key: `request-${r.id}`,
        date: r.created_at,
        label: "Request submitted",
        detail: `${r.goal} \u2022 ${r.state}`,
      });
    }
    for (const c of challenges) {
      items.push({
        key: `challenge-${c.id}`,
        date: c.created_at,
        label: "Challenge created",
        detail: `State: ${c.state}`,
      });
    }
    for (const l of workoutLogs.slice(0, 20)) {
      items.push({
        key: `log-${l.id}`,
        date: l.created_at,
        label: l.completed ? "Session completed" : "Session logged",
        detail: formatDate(l.session_date),
      });
    }
    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [requests, challenges, workoutLogs]);

  if (dashboard.isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Couldn&apos;t load your dashboard
            </CardTitle>
            <CardDescription>
              {dashboard.error instanceof Error
                ? dashboard.error.message
                : "An unexpected error occurred."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => dashboard.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = dashboard.data;
  if (!data) return null;

  if (data.athlete === null) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="font-display text-3xl text-foreground">Dashboard</h1>
        <Card className="mt-6 glass">
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              You don&apos;t have an athlete profile yet. Create a training request to begin the
              ScienceFit lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/app/requests/new">Create a request</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { athlete, stats } = data;
  const notificationItems = notifications.data?.notifications ?? [];
  const recentNotifications = notificationItems.slice(0, 5);

  return (
    <div className="space-y-8 p-4 md:p-6">
      <h1 className="font-display text-3xl text-foreground">Dashboard</h1>

      <section aria-labelledby="overview-heading" className="space-y-3">
        <h2 id="overview-heading" className="text-xl font-semibold text-foreground">
          Overview
        </h2>
        <Card className="glass">
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <Badge variant="secondary" className="text-sm">
              {athlete.state.replaceAll("_", " ")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Active challenges: <span className="text-data">{stats.activeChallenges}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Completed challenges: <span className="text-data">{stats.completedChallenges}</span>
            </span>
            {/*
              Performance Score is a coach-only metric under ScienceFit
              governance; athletes never have one, so it is intentionally
              omitted from this dashboard.
            */}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="challenges-heading" className="space-y-3">
        <h2 id="challenges-heading" className="text-xl font-semibold text-foreground">
          Current Challenges
        </h2>
        {currentChallenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no active challenges right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {currentChallenges.map((c) => (
              <Card key={c.id} className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{c.athlete_requests?.goal ?? "Challenge"}</span>
                    <Badge variant="outline">{c.state}</Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {deadlineCountdown(c.deadline_at) ?? "No deadline set"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/app/challenges/$challengeId" params={{ challengeId: c.id }}>
                      View challenge
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="progress-heading" className="space-y-3">
        <h2 id="progress-heading" className="text-xl font-semibold text-foreground">
          Progress
        </h2>
        {progress === null ? (
          <p className="text-sm text-muted-foreground">
            No workout logs yet. Progress will appear once sessions are logged.
          </p>
        ) : (
          <Card className="glass">
            <CardContent className="flex flex-wrap gap-6 pt-6">
              <div>
                <p className="text-xs text-muted-foreground">Sessions logged</p>
                <p className="text-data text-2xl">{progress.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-data text-2xl">{progress.completed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overall adherence</p>
                <p className="text-data text-2xl">{progress.adherence}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Adherence (last {progress.recentCount})
                </p>
                <p className="text-data text-2xl">{progress.recentAdherence}%</p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="stats-heading" className="space-y-3">
        <h2 id="stats-heading" className="text-xl font-semibold text-foreground">
          Statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Requests", stats.totalRequests],
            ["Active challenges", stats.activeChallenges],
            ["Completed challenges", stats.completedChallenges],
            ["Programs delivered", stats.programsDelivered],
            ["Sessions logged", stats.sessionsLogged],
            ["Sessions completed", stats.completedSessions],
          ].map(([label, value]) => (
            <Card key={label as string} className="glass">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-data text-2xl">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="notifications-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="notifications-heading" className="text-xl font-semibold text-foreground">
            Notifications
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/notifications">View all</Link>
          </Button>
        </div>
        {notifications.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : recentNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <Card className="glass">
            <CardContent className="divide-y divide-border pt-6">
              {recentNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-warm-gray" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="activity-heading" className="space-y-3">
        <h2
          id="activity-heading"
          className="flex items-center gap-2 text-xl font-semibold text-foreground"
        >
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between border-b border-border pb-2 text-sm"
              >
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.detail}</span>
                <span className="text-xs text-warm-gray">{formatDateTime(item.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2
          id="history-heading"
          className="flex items-center gap-2 text-xl font-semibold text-foreground"
        >
          <History className="h-5 w-5" aria-hidden="true" />
          Challenge History
        </h2>
        {completedChallenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed challenges yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Goal</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Results</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedChallenges.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.athlete_requests?.goal ?? "\u2014"}</TableCell>
                  <TableCell>{formatDate(c.completed_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="link" size="sm">
                      <Link
                        to="/app/challenges/$challengeId/results"
                        params={{ challengeId: c.id }}
                      >
                        View results
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {requests.length === 0 && (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <ClipboardList className="mb-2 h-5 w-5" aria-hidden="true" />
          You haven&apos;t submitted any requests yet.{" "}
          <Link to="/app/requests/new" className="text-primary underline">
            Create your first request
          </Link>
          .
        </div>
      )}
    </div>
  );
}

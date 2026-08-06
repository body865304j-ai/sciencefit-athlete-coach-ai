import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ShieldAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coachDashboardQuery } from "@/lib/queries";
import { MARKETPLACE_GATES, performanceTier } from "@/lib/domain";

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

function evaluationsOf<T>(value: T | T[] | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function programState(program: {
  submitted_at: string | null;
  locked_at: string | null;
}) {
  if (program.locked_at) return "locked";
  if (program.submitted_at) return "submitted";
  return "draft";
}

type TimelineItem = {
  key: string;
  date: string;
  label: string;
};

export function CoachDashboardScreen() {
  const dashboard = useQuery(coachDashboardQuery);

  const invitations = dashboard.data?.invitations ?? [];
  const programs = dashboard.data?.programs ?? [];
  const scoreHistory = dashboard.data?.scoreHistory ?? [];

  const availableChallenges = useMemo(
    () =>
      invitations.filter(
        (i) =>
          i.status === "INVITED" &&
          i.challenges !== null &&
          i.challenges.state !== "LOCKED" &&
          i.challenges.state !== "COMPLETED" &&
          i.challenges.state !== "ARCHIVED",
      ),
    [invitations],
  );

  const pendingReviews = useMemo(
    () =>
      programs.filter((p) =>
        evaluationsOf(p.evaluations).some(
          (e) =>
            e.status === "QUEUED" ||
            e.status === "RUNNING" ||
            e.escalation_level !== "NONE",
        ),
      ),
    [programs],
  );

  const latestScore = scoreHistory.length > 0
    ? scoreHistory[scoreHistory.length - 1]
    : null;

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const i of invitations) {
      items.push({ key: `inv-invited-${i.id}`, date: i.invited_at, label: "Invitation received" });
      if (i.responded_at) {
        items.push({ key: `inv-responded-${i.id}`, date: i.responded_at, label: "Invitation responded" });
      }
    }
    for (const p of programs) {
      if (p.submitted_at) {
        items.push({ key: `prog-submitted-${p.id}`, date: p.submitted_at, label: `Program submitted: ${p.title}` });
      }
      if (p.locked_at) {
        items.push({ key: `prog-locked-${p.id}`, date: p.locked_at, label: `Program locked: ${p.title}` });
      }
    }
    for (const s of scoreHistory) {
      items.push({ key: `score-${s.id}`, date: s.created_at, label: `Performance Score updated to ${s.performance_score}` });
    }
    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [invitations, programs, scoreHistory]);

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

  if (data.coach === null) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="font-display text-3xl text-foreground">Dashboard</h1>
        <Card className="mt-6 glass">
          <CardHeader>
            <CardTitle>No coach profile yet</CardTitle>
            <CardDescription>
              You don&apos;t have a coach profile. Once you&apos;re verified
              as a coach, challenge invitations and your Performance Score
              will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { coach, stats, rank, totalRanked } = data;
  const tier = performanceTier(coach.performance_score);
  const gates = [
    { label: "Browse marketplace", threshold: MARKETPLACE_GATES.browse },
    { label: "Message athletes", threshold: MARKETPLACE_GATES.message },
    { label: "Accept hires", threshold: MARKETPLACE_GATES.hire },
  ];

  return (
    <div className="space-y-8 p-4 md:p-6">
      <h1 className="font-display text-3xl text-foreground">Dashboard</h1>

      <section aria-labelledby="available-heading" className="space-y-3">
        <h2 id="available-heading" className="text-xl font-semibold text-foreground">
          Available Challenges
        </h2>
        {availableChallenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open invitations right now.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableChallenges.map((i) => (
              <Card key={i.id} className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{i.challenges?.athlete_requests?.goal ?? "Challenge"}</span>
                    <Badge variant="outline">{i.challenges?.state}</Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {deadlineCountdown(i.challenges?.deadline_at) ?? "No deadline set"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      to="/app/challenges/$challengeId"
                      params={{ challengeId: i.challenge_id }}
                    >
                      View challenge
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="programs-heading" className="space-y-3">
        <h2 id="programs-heading" className="text-xl font-semibold text-foreground">
          My Programs
        </h2>
        {programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programs yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Challenge state</TableHead>
                <TableHead className="text-right">Builder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{programState(p)}</Badge>
                  </TableCell>
                  <TableCell>{p.version}</TableCell>
                  <TableCell>{p.challenges?.state ?? "\u2014"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="link" size="sm">
                      <Link
                        to="/app/challenges/$challengeId/builder"
                        params={{ challengeId: p.challenge_id }}
                      >
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="reviews-heading" className="space-y-3">
        <h2 id="reviews-heading" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          Pending Reviews
        </h2>
        {pendingReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No programs are awaiting evaluation or escalation review.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingReviews.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span className="text-foreground">{p.title}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {evaluationsOf(p.evaluations).map((e) => (
                    <Badge key={e.id} variant="outline">
                      {e.status}
                      {e.escalation_level !== "NONE" ? ` \u2022 ${e.escalation_level}` : ""}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="score-heading" className="space-y-3">
        <h2 id="score-heading" className="text-xl font-semibold text-foreground">
          Performance Score
        </h2>
        {coach.performance_score === null ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have a Performance Score yet. It is calculated
            after your first completed evaluation.
          </p>
        ) : (
          <Card className="glass">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-4">
                <p className="text-data text-4xl">{coach.performance_score}</p>
                {tier && <Badge variant="secondary">{tier.name}</Badge>}
              </div>
              {latestScore && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ["Base score", latestScore.base_score],
                    ["Trend bonus", latestScore.trend_bonus],
                    ["Consistency bonus", latestScore.consistency_bonus],
                    ["Volume penalty", latestScore.volume_penalty],
                    ["Submissions counted", latestScore.submissions_counted],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-data text-lg">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="success-heading" className="space-y-3">
        <h2 id="success-heading" className="text-xl font-semibold text-foreground">
          Success Rate
        </h2>
        <Card className="glass">
          <CardContent className="flex flex-wrap gap-6 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Success rate</p>
              <p className="text-data text-2xl">{stats.successRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wins</p>
              <p className="text-data text-2xl">{stats.wins}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Evaluated programs</p>
              <p className="text-data text-2xl">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="ranking-heading" className="space-y-3">
        <h2 id="ranking-heading" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Trophy className="h-5 w-5" aria-hidden="true" />
          Ranking
        </h2>
        <Card className="glass">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {rank === null ? (
                "Not yet ranked."
              ) : (
                <>
                  Ranked <span className="text-data">#{rank}</span> of{" "}
                  <span className="text-data">{totalRanked}</span> coaches
                </>
              )}
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/ranking">View leaderboard</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="marketplace-heading" className="space-y-3">
        <h2 id="marketplace-heading" className="text-xl font-semibold text-foreground">
          Marketplace Status
        </h2>
        <Card className="glass">
          <CardContent className="space-y-3 pt-6">
            {gates.map((gate) => {
              const met = (coach.performance_score ?? -1) >= gate.threshold;
              return (
                <div key={gate.label} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{gate.label}</span>
                  <Badge variant={met ? "secondary" : "outline"}>
                    {met ? "Unlocked" : `Needs ${gate.threshold}`}
                  </Badge>
                </div>
              );
            })}
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/marketplace">Go to marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="timeline-heading" className="space-y-3">
        <h2 id="timeline-heading" className="text-xl font-semibold text-foreground">
          Activity Timeline
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((item) => (
              <li key={item.key} className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="text-xs text-warm-gray">{formatDateTime(item.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { LineChart, CartesianGrid, XAxis, YAxis, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { leaderboardQuery } from "@/lib/queries";
import { performanceTier } from "@/lib/domain";

const chartConfig = {
  performance_score: {
    label: "Performance score",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function bonusLabel(value: number, positiveWord: string, negativeWord: string) {
  if (value > 0) return { label: positiveWord, variant: "secondary" as const };
  if (value < 0) return { label: negativeWord, variant: "outline" as const };
  return { label: "Neutral", variant: "outline" as const };
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString();
}

export function RankingScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(leaderboardQuery);

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4" role="alert">
        <h1 className="font-display text-2xl text-foreground">Ranking</h1>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load the leaderboard."}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const { leaderboard, viewerCoachId, history } = data;
  const isViewerCoach = viewerCoachId !== null;
  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-foreground">Coach ranking</h1>
        {!isViewerCoach ? (
          <p className="text-muted-foreground">
            You are viewing the leaderboard as an athlete; performance history is only available to
            coaches.
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl text-foreground">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground">No ranked coaches yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Performance score</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Specializations</TableHead>
                <TableHead>Marketplace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((row) => {
                const tier = performanceTier(row.performanceScore);
                return (
                  <TableRow
                    key={row.coachId}
                    aria-current={row.isViewer ? "true" : undefined}
                    className={row.isViewer ? "bg-secondary" : undefined}
                  >
                    <TableCell className="text-data">{row.rank}</TableCell>
                    <TableCell className="text-foreground">
                      {row.displayName}
                      {row.isViewer ? (
                        <Badge className="ml-2" variant="secondary">
                          You
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.country ?? "—"}</TableCell>
                    <TableCell className="text-data">{row.performanceScore.toFixed(1)}</TableCell>
                    <TableCell>
                      {tier ? <Badge variant="outline">{tier.name}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.specializations.length > 0 ? row.specializations.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.marketplaceEnabled ? "Enabled" : "Disabled"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {isViewerCoach && history.length > 0 ? (
        <section className="space-y-6">
          <h2 className="font-display text-xl text-foreground">Your performance history</h2>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Performance score over time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <LineChart data={history} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="created_at"
                    tickFormatter={formatTimestamp}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatTimestamp(String(value))}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="performance_score"
                    stroke="var(--color-performance_score)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {latest ? (
            <div className="flex flex-wrap gap-3">
              <Badge
                variant={
                  bonusLabel(Number(latest.trend_bonus), "Trending up", "Trending down").variant
                }
              >
                Trend:{" "}
                {bonusLabel(Number(latest.trend_bonus), "Trending up", "Trending down").label} (
                {Number(latest.trend_bonus).toFixed(1)})
              </Badge>
              <Badge
                variant={
                  bonusLabel(Number(latest.consistency_bonus), "Consistent", "Inconsistent").variant
                }
              >
                Consistency:{" "}
                {bonusLabel(Number(latest.consistency_bonus), "Consistent", "Inconsistent").label} (
                {Number(latest.consistency_bonus).toFixed(1)})
              </Badge>
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 font-display text-xl text-foreground">History detail</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Previous score</TableHead>
                  <TableHead>Base score</TableHead>
                  <TableHead>Trend bonus</TableHead>
                  <TableHead>Consistency bonus</TableHead>
                  <TableHead>Volume penalty</TableHead>
                  <TableHead>Performance score</TableHead>
                  <TableHead>Submissions counted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(row.created_at)}
                    </TableCell>
                    <TableCell className="text-data">
                      {row.previous_score !== null ? Number(row.previous_score).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-data">{Number(row.base_score).toFixed(1)}</TableCell>
                    <TableCell className="text-data">
                      {Number(row.trend_bonus).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-data">
                      {Number(row.consistency_bonus).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-data">
                      {Number(row.volume_penalty).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-data">
                      {Number(row.performance_score).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-data">{row.submissions_counted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

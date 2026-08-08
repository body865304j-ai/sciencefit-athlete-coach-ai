import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
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
import { getChallengeResults } from "@/lib/flow.functions";

interface ChallengeResultsScreenProps {
  challengeId: string;
}

interface ResultRow {
  id: string;
  status: string;
  escalation_level: string;
  overall_score: number | null;
  rank: number | null;
  coWinner: boolean;
  anonymous_hash: string;
  programs: {
    id: string;
    title: string;
    summary: string | null;
    submitted_at: string | null;
  } | null;
  evaluation_results: { dimension: string; score: number }[];
}

function dimensionScore(row: ResultRow, dimension: string) {
  return row.evaluation_results.find((r) => r.dimension === dimension)?.score ?? null;
}

export function ChallengeResultsScreen({ challengeId }: ChallengeResultsScreenProps) {
  const getChallengeResultsFn = useServerFn(getChallengeResults);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["challenge-results", challengeId],
    queryFn: () => getChallengeResultsFn({ data: { challengeId } }),
  });

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
        <h1 className="font-display text-2xl text-foreground">Challenge results</h1>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load challenge results."}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const { challenge, results } = data;
  const rows = results as ResultRow[];
  const isCompleted = challenge.state === "COMPLETED";
  const winner = rows.find((row) => row.rank === 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-foreground">Challenge results</h1>
        <p className="text-muted-foreground">Status: {challenge.state}</p>
      </div>

      {isCompleted ? (
        winner ? (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Winning program</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">
                {winner.programs?.title ?? "Untitled program"}
              </p>
              {winner.programs?.summary ? (
                <p className="text-sm text-muted-foreground">{winner.programs.summary}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground">
            This challenge is complete but no ranked evaluation is available.
          </p>
        )
      ) : (
        <p className="text-muted-foreground">
          This challenge is not yet completed; the leaderboard below reflects evaluations received
          so far and ranks may still change.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl text-foreground">Ranked leaderboard</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Ties are broken, in order: higher Safety score, then higher Personalization score, then
          earlier submission timestamp; remaining ties are marked as co-winners.
        </p>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No submissions have been evaluated yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Anonymous hash</TableHead>
                <TableHead>Overall score</TableHead>
                <TableHead>Safety</TableHead>
                <TableHead>Personalization</TableHead>
                <TableHead>Co-winner</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-data">{row.rank ?? "—"}</TableCell>
                  <TableCell className="break-all text-data">{row.anonymous_hash}</TableCell>
                  <TableCell className="text-data">
                    {row.overall_score !== null ? row.overall_score.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-data">
                    {dimensionScore(row, "SAFETY")?.toFixed(1) ?? "—"}
                  </TableCell>
                  <TableCell className="text-data">
                    {dimensionScore(row, "PERSONALIZATION")?.toFixed(1) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.coWinner ? <Badge variant="secondary">Co-winner</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/app/evaluations/$evaluationId"
                      params={{ evaluationId: row.id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View evaluation
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

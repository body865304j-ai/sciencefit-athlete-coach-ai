import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getEvaluation } from "@/lib/app.functions";
import { EVALUATION_DIMENSIONS } from "@/lib/domain";
import { confidenceBand, ESCALATION_SLA_HOURS } from "@/lib/evaluation";

interface EvaluationScreenProps {
  evaluationId: string;
}

interface Attribution {
  programPath: string;
  note: string;
}

interface Reasoning {
  summary: string;
  attributions: Attribution[];
}

interface EvaluationResultRow {
  dimension: string;
  weight: number;
  score: number;
  confidence: number;
  reasoning: Reasoning;
}

function isEscalationSlaKey(
  level: string,
): level is keyof typeof ESCALATION_SLA_HOURS {
  return level in ESCALATION_SLA_HOURS;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function EvaluationScreen({ evaluationId }: EvaluationScreenProps) {
  const getEvaluationFn = useServerFn(getEvaluation);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["evaluation", evaluationId],
    queryFn: () => getEvaluationFn({ data: { evaluationId } }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4" role="alert">
        <h1 className="font-display text-2xl text-foreground">Evaluation</h1>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load this evaluation."}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const { evaluation } = data;
  const program = evaluation.programs;
  const results = (evaluation.evaluation_results ?? []) as unknown as EvaluationResultRow[];

  // Only render the seven canonical dimensions, in the canonical order.
  const dimensionRows = EVALUATION_DIMENSIONS.map((dim) => {
    const result = results.find((r) => r.dimension === dim.key);
    return { dim, result };
  });

  const overallScore = evaluation.overall_score ?? null;

  /**
   * Governance: the engine contract in schemas.ts returns score, confidence
   * and reasoning only; strengths/weaknesses are presented as score-ordered
   * views of those returned dimensions, never generated here.
   */
  const scored = dimensionRows.filter(
    (row): row is { dim: (typeof EVALUATION_DIMENSIONS)[number]; result: EvaluationResultRow } =>
      row.result !== undefined,
  );
  const above = scored
    .filter((row) => overallScore !== null && row.result.score >= overallScore)
    .sort((a, b) => b.result.score - a.result.score);
  const below = scored
    .filter((row) => overallScore !== null && row.result.score < overallScore)
    .sort((a, b) => a.result.score - b.result.score);

  const escalationLevel = evaluation.escalation_level;
  const slaHours = isEscalationSlaKey(escalationLevel)
    ? ESCALATION_SLA_HOURS[escalationLevel]
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-foreground">Evaluation results</h1>
        <p className="text-muted-foreground">
          {program?.title ?? "Untitled program"}
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Overall score</p>
            <p className="text-data text-2xl text-foreground">
              {overallScore !== null ? overallScore.toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="secondary">{evaluation.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Escalation level</p>
            <p className="text-foreground">
              {escalationLevel}
              {slaHours !== null && escalationLevel !== "NONE" ? (
                <span className="text-muted-foreground"> · SLA ≤ {slaHours}h</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Anonymous hash</p>
            <p className="break-all text-data text-foreground">
              {evaluation.anonymous_hash}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Queued</p>
            <p className="text-foreground">{formatTimestamp(evaluation.queued_at)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-foreground">{formatTimestamp(evaluation.completed_at)}</p>
          </div>
          {program?.summary ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-muted-foreground">Program summary</p>
              <p className="text-foreground">{program.summary}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 font-display text-xl text-foreground">
          Dimension scores
        </h2>
        <div className="space-y-4">
          {dimensionRows.map(({ dim, result }) => {
            const band = result ? confidenceBand(result.confidence) : null;
            return (
              <Card key={dim.key} className="glass">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-base">{dim.label}</CardTitle>
                  <Badge variant="outline">{dim.weight}×</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result ? (
                    <>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Score</span>
                          <span className="text-data text-foreground">
                            {result.score.toFixed(1)}
                          </span>
                        </div>
                        <Progress value={result.score} aria-label={`${dim.label} score`} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="text-data text-foreground">
                          {result.confidence.toFixed(2)}
                        </span>
                        {band ? (
                          <Badge variant="secondary">{band.label}</Badge>
                        ) : null}
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-foreground">Reasoning</p>
                        <p className="text-sm text-muted-foreground">
                          {result.reasoning.summary}
                        </p>
                      </div>
                      {result.reasoning.attributions.length > 0 ? (
                        <ul className="space-y-1">
                          {result.reasoning.attributions.map((attribution, index) => (
                            <li
                              key={`${attribution.programPath}-${index}`}
                              className="text-sm text-warm-gray"
                            >
                              <span className="text-data text-foreground">
                                {attribution.programPath}
                              </span>
                              : {attribution.note}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No result reported for this dimension.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-xl text-foreground">
            Highest scoring dimensions
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Dimensions scoring at or above the overall score of{" "}
            {overallScore !== null ? overallScore.toFixed(1) : "—"}.
          </p>
          <ul className="space-y-2">
            {above.map(({ dim, result }) => (
              <li key={dim.key} className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-foreground">{dim.label}</span>
                <span className="text-data text-foreground">{result.score.toFixed(1)}</span>
              </li>
            ))}
            {above.length === 0 ? (
              <li className="text-sm text-muted-foreground">None.</li>
            ) : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-display text-xl text-foreground">
            Lowest scoring dimensions
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Dimensions scoring below the overall score of{" "}
            {overallScore !== null ? overallScore.toFixed(1) : "—"}.
          </p>
          <ul className="space-y-2">
            {below.map(({ dim, result }) => (
              <li key={dim.key} className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-foreground">{dim.label}</span>
                <span className="text-data text-foreground">{result.score.toFixed(1)}</span>
              </li>
            ))}
            {below.length === 0 ? (
              <li className="text-sm text-muted-foreground">None.</li>
            ) : null}
          </ul>
        </div>
      </section>

      {below.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-xl text-foreground">
            Improvement guidance from the evaluation reasoning
          </h2>
          <div className="space-y-4">
            {below.map(({ dim, result }) =>
              result.reasoning.attributions.length > 0 ? (
                <div key={dim.key}>
                  <p className="font-medium text-foreground">{dim.label}</p>
                  <ul className="space-y-1">
                    {result.reasoning.attributions.map((attribution, index) => (
                      <li
                        key={`${dim.key}-${attribution.programPath}-${index}`}
                        className="text-sm text-warm-gray"
                      >
                        <span className="text-data text-foreground">
                          {attribution.programPath}
                        </span>
                        : {attribution.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

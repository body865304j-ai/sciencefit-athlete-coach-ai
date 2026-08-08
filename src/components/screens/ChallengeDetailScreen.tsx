import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getChallenge } from "@/lib/flow.functions";
import { CHALLENGE_RULES, CHALLENGE_STATES } from "@/lib/business";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function parseServerError(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { message?: string };
      if (parsed && typeof parsed.message === "string") return parsed.message;
    } catch {
      // not structured JSON
    }
    return err.message;
  }
  return "Something went wrong.";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Deadline passed";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function ChallengeDetailScreen({ challengeId }: { challengeId: string }) {
  const getChallengeFn = useServerFn(getChallenge);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const challengeQuery = useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: () => getChallengeFn({ data: { challengeId } }),
  });

  if (challengeQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-muted-foreground">Loading challenge…</p>
      </div>
    );
  }

  if (challengeQuery.isError || !challengeQuery.data) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-destructive">{parseServerError(challengeQuery.error)}</p>
      </div>
    );
  }

  const { challenge, brief, coach, myProgram, submissionCount } = challengeQuery.data;
  const deadlineMs = Date.parse(challenge.deadline_at);
  const currentStateIndex = CHALLENGE_STATES.findIndex((s) => s.state === challenge.state);

  let myProgramStatus: string | null = null;
  if (coach) {
    if (!myProgram) myProgramStatus = "Not started";
    else if (myProgram.locked_at) myProgramStatus = "Locked";
    else if (myProgram.submitted_at) myProgramStatus = "Submitted";
    else myProgramStatus = "Draft in progress";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-foreground">Challenge</h1>
        <Badge variant="secondary">{challenge.state}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deadline</span>
            <span
              className="text-data"
              aria-live="polite"
              aria-label={`Time remaining: ${formatCountdown(deadlineMs - now)}`}
            >
              {formatCountdown(deadlineMs - now)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submissions received</span>
            <span className="text-data">{submissionCount}</span>
          </div>

          {coach && (
            <>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Your program status</span>
                <Badge
                  variant={
                    myProgramStatus === "Submitted" || myProgramStatus === "Locked"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {myProgramStatus}
                </Badge>
              </div>
              <Button asChild>
                <Link to="/app/challenges/$challengeId/builder" params={{ challengeId }}>
                  Open program builder
                </Link>
              </Button>
            </>
          )}

          {challenge.state === "COMPLETED" && (
            <Button asChild variant="secondary">
              <Link to="/app/challenges/$challengeId/results" params={{ challengeId }}>
                View results
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {brief && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Athlete brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Goal: </span>
              {brief.goal}
            </p>
            <p>
              <span className="text-muted-foreground">Experience level: </span>
              {brief.experience_level}
            </p>
            <p>
              <span className="text-muted-foreground">Training days/week: </span>
              {brief.training_days}
            </p>
            <p>
              <span className="text-muted-foreground">Session minutes: </span>
              {brief.session_minutes}
            </p>
            <p>
              <span className="text-muted-foreground">Equipment: </span>
              {brief.equipment.length > 0 ? brief.equipment.join(", ") : "None listed"}
            </p>
            <p>
              <span className="text-muted-foreground">Injury notes: </span>
              {brief.injury_notes ?? "None"}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Clinical flag: </span>
              <Badge variant={brief.clinical_flag ? "destructive" : "secondary"}>
                {brief.clinical_flag ? "Yes — requires care" : "No"}
              </Badge>
            </p>
          </CardContent>
        </Card>
      )}

      {!coach && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifecycle progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {CHALLENGE_STATES.map((s, i) => (
                <li
                  key={s.state}
                  className={`flex items-center justify-between rounded-md border border-border p-2 text-sm ${
                    i === currentStateIndex ? "bg-secondary" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${
                        i <= currentStateIndex ? "bg-primary" : "bg-border"
                      }`}
                    />
                    <span
                      className={
                        i === currentStateIndex ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {s.state}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{s.definition}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CHALLENGE_RULES.map((rule) => (
            <div key={rule.rule} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{rule.rule}</p>
              <p className="text-muted-foreground">{rule.description}</p>
              <p className="mt-1 text-xs text-warm-gray">Enforcement: {rule.enforcement}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { getChallenge, saveProgramDraft, submitProgram } from "@/lib/flow.functions";
import { programDraftInput } from "@/lib/schemas";
import { PROGRAM_DRAFT_AUTOSAVE_SECONDS } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Governance: schemas.ts/program_exercises define the canonical exercise fields; tempo and progression are captured in coachingCue and week focus.

/* ------------------------------ Local state shapes ------------------------------ */

interface ExerciseState {
  localId: string;
  name: string;
  sets: number | null;
  reps: string | null;
  loadNote: string | null;
  restNote: string | null;
  coachingCue: string | null;
}

interface DayState {
  localId: string;
  dayNumber: number;
  title: string;
  notes: string | null;
  exercises: ExerciseState[];
}

interface WeekState {
  localId: string;
  weekNumber: number;
  focus: string;
  days: DayState[];
}

interface BuilderState {
  title: string;
  summary: string;
  weeks: WeekState[];
}

let localIdSeq = 0;
function localId() {
  localIdSeq += 1;
  return `local-${localIdSeq}-${Date.now()}`;
}

function newExercise(): ExerciseState {
  return {
    localId: localId(),
    name: "",
    sets: null,
    reps: null,
    loadNote: null,
    restNote: null,
    coachingCue: null,
  };
}

function newDay(dayNumber: number): DayState {
  return { localId: localId(), dayNumber, title: "", notes: null, exercises: [] };
}

function newWeek(weekNumber: number): WeekState {
  return { localId: localId(), weekNumber, focus: "", days: [newDay(1)] };
}

function emptyBuilder(challengeId: string): BuilderState {
  void challengeId;
  return { title: "", summary: "", weeks: [newWeek(1)] };
}

type MyProgram = NonNullable<Awaited<ReturnType<typeof getChallenge>>["myProgram"]>;

function seedFromProgram(program: MyProgram): BuilderState {
  const weeks = [...(program.program_weeks ?? [])]
    .sort((a, b) => a.week_number - b.week_number)
    .map((week): WeekState => {
      const days = [...(week.program_days ?? [])]
        .sort((a, b) => a.day_number - b.day_number)
        .map((day): DayState => {
          const exercises = [...(day.program_exercises ?? [])]
            .sort((a, b) => a.position - b.position)
            .map(
              (ex): ExerciseState => ({
                localId: localId(),
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                loadNote: ex.load_note,
                restNote: ex.rest_note,
                coachingCue: ex.coaching_cue,
              }),
            );
          return {
            localId: localId(),
            dayNumber: day.day_number,
            title: day.title,
            notes: day.notes,
            exercises,
          };
        });
      return {
        localId: localId(),
        weekNumber: week.week_number,
        focus: week.focus,
        days: days.length > 0 ? days : [newDay(1)],
      };
    });
  return {
    title: program.title,
    summary: program.summary,
    weeks: weeks.length > 0 ? weeks : [newWeek(1)],
  };
}

function toPayload(challengeId: string, state: BuilderState) {
  return {
    challengeId,
    title: state.title,
    summary: state.summary,
    weeks: state.weeks.map((w) => ({
      weekNumber: w.weekNumber,
      focus: w.focus,
      days: w.days.map((d) => ({
        dayNumber: d.dayNumber,
        title: d.title,
        notes: d.notes,
        exercises: d.exercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          loadNote: e.loadNote,
          restNote: e.restNote,
          coachingCue: e.coachingCue,
        })),
      })),
    })),
  };
}

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

export function ProgramBuilderScreen({ challengeId }: { challengeId: string }) {
  const queryClient = useQueryClient();
  const getChallengeFn = useServerFn(getChallenge);
  const saveDraftFn = useServerFn(saveProgramDraft);
  const submitProgramFn = useServerFn(submitProgram);

  const challengeQuery = useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: () => getChallengeFn({ data: { challengeId } }),
  });

  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [issues, setIssues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seededRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (seededRef.current) return;
    if (!challengeQuery.data) return;
    seededRef.current = true;
    const { myProgram } = challengeQuery.data;
    setBuilder(myProgram ? seedFromProgram(myProgram) : emptyBuilder(challengeId));
  }, [challengeQuery.data, challengeId]);

  const challenge = challengeQuery.data?.challenge;
  const brief = challengeQuery.data?.brief;
  const myProgram = challengeQuery.data?.myProgram;
  const submissionCount = challengeQuery.data?.submissionCount ?? 0;

  const deadlineMs = challenge ? Date.parse(challenge.deadline_at) : null;
  const deadlinePassed = deadlineMs !== null && deadlineMs <= now;
  const challengeOpen = challenge ? (challenge.state === "ACTIVE" || challenge.state === "PUBLISHED") : false;
  const isSubmitted = Boolean(myProgram?.submitted_at);
  const isLocked = Boolean(myProgram?.locked_at) || isSubmitted || deadlinePassed || !challengeOpen;

  const lockedReason = !challenge
    ? null
    : deadlinePassed
      ? "The submission deadline has passed. Deadline enforcement is absolute and cannot be overridden."
      : !challengeOpen
        ? `This challenge is ${challenge.state} and is no longer accepting program edits.`
        : Boolean(myProgram?.locked_at)
          ? "Your submission is locked and sealed for evaluation."
          : isSubmitted
            ? "Your program has already been submitted. Only one submission per coach is allowed."
            : null;

  const payload = useMemo(() => {
    if (!builder) return null;
    return toPayload(challengeId, builder);
  }, [builder, challengeId]);

  const validation = useMemo(() => {
    if (!payload) return null;
    return programDraftInput.safeParse(payload);
  }, [payload]);

  function collectIssues(result: z.SafeParseReturnType<unknown, unknown>): string[] {
    if (result.success) return [];
    return result.error.issues.map((issue) => `${issue.path.join(".") || "form"}: ${issue.message}`);
  }

  function update(mutator: (draft: BuilderState) => BuilderState) {
    setBuilder((prev) => (prev ? mutator(prev) : prev));
    setDirty(true);
  }

  async function persist(submit: boolean) {
    if (!payload || !validation) return false;
    if (!validation.success) {
      setIssues(collectIssues(validation));
      return false;
    }
    setIssues([]);
    try {
      if (submit) {
        setSubmitting(true);
        await submitProgramFn({ data: payload });
        toast.success("Program submitted. It is now sealed until evaluation.");
        setDirty(false);
        await queryClient.invalidateQueries({ queryKey: ["coach-dashboard"] });
        await challengeQuery.refetch();
      } else {
        setSaving(true);
        await saveDraftFn({ data: payload });
        setDirty(false);
        setSaveStatus(
          `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        );
      }
      return true;
    } catch (err) {
      toast.error(parseServerError(err));
      return false;
    } finally {
      setSubmitting(false);
      setSaving(false);
    }
  }

  // Autosave loop.
  useEffect(() => {
    if (!dirty || isLocked || isSubmitted) return;
    setSaveStatus("Saving…");
    const timeout = setTimeout(() => {
      void persist(false);
    }, PROGRAM_DRAFT_AUTOSAVE_SECONDS * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, isLocked, isSubmitted, payload]);

  if (challengeQuery.isLoading || !builder) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <p className="text-muted-foreground">Loading challenge…</p>
      </div>
    );
  }

  if (challengeQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <p className="text-destructive">{parseServerError(challengeQuery.error)}</p>
      </div>
    );
  }

  if (!challenge) return null;

  function addWeek() {
    update((draft) => ({
      ...draft,
      weeks: [...draft.weeks, newWeek(draft.weeks.length + 1)],
    }));
  }

  function removeWeek(weekLocalId: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks
        .filter((w) => w.localId !== weekLocalId)
        .map((w, i) => ({ ...w, weekNumber: i + 1 })),
    }));
  }

  function moveWeek(weekLocalId: string, dir: -1 | 1) {
    update((draft) => {
      const idx = draft.weeks.findIndex((w) => w.localId === weekLocalId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= draft.weeks.length) return draft;
      const weeks = [...draft.weeks];
      const a = weeks[idx];
      const b = weeks[target];
      if (!a || !b) return draft;
      weeks[idx] = b;
      weeks[target] = a;
      return { ...draft, weeks: weeks.map((w, i) => ({ ...w, weekNumber: i + 1 })) };
    });
  }

  function updateWeekFocus(weekLocalId: string, focus: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) => (w.localId === weekLocalId ? { ...w, focus } : w)),
    }));
  }

  function addDay(weekLocalId: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId ? { ...w, days: [...w.days, newDay(w.days.length + 1)] } : w,
      ),
    }));
  }

  function removeDay(weekLocalId: string, dayLocalId: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days
                .filter((d) => d.localId !== dayLocalId)
                .map((d, i) => ({ ...d, dayNumber: i + 1 })),
            }
          : w,
      ),
    }));
  }

  function updateDay(weekLocalId: string, dayLocalId: string, patch: Partial<DayState>) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days.map((d) => (d.localId === dayLocalId ? { ...d, ...patch } : d)),
            }
          : w,
      ),
    }));
  }

  function addExercise(weekLocalId: string, dayLocalId: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days.map((d) =>
                d.localId === dayLocalId ? { ...d, exercises: [...d.exercises, newExercise()] } : d,
              ),
            }
          : w,
      ),
    }));
  }

  function removeExercise(weekLocalId: string, dayLocalId: string, exerciseLocalId: string) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days.map((d) =>
                d.localId === dayLocalId
                  ? { ...d, exercises: d.exercises.filter((e) => e.localId !== exerciseLocalId) }
                  : d,
              ),
            }
          : w,
      ),
    }));
  }

  function updateExercise(
    weekLocalId: string,
    dayLocalId: string,
    exerciseLocalId: string,
    patch: Partial<ExerciseState>,
  ) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days.map((d) =>
                d.localId === dayLocalId
                  ? {
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.localId === exerciseLocalId ? { ...e, ...patch } : e,
                      ),
                    }
                  : d,
              ),
            }
          : w,
      ),
    }));
  }

  function reorderExercises(weekLocalId: string, dayLocalId: string, from: number, to: number) {
    update((draft) => ({
      ...draft,
      weeks: draft.weeks.map((w) =>
        w.localId === weekLocalId
          ? {
              ...w,
              days: w.days.map((d) => {
                if (d.localId !== dayLocalId) return d;
                if (from < 0 || from >= d.exercises.length || to < 0 || to >= d.exercises.length)
                  return d;
                const exercises = [...d.exercises];
                const [moved] = exercises.splice(from, 1);
                if (!moved) return d;
                exercises.splice(to, 0, moved);
                return { ...d, exercises };
              }),
            }
          : w,
      ),
    }));
  }

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24">
      <h1 className="font-display text-2xl text-foreground">Program Builder</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Athlete brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Challenge state</span>
              <Badge variant="secondary">{challenge.state}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deadline</span>
              <span
                className="text-data"
                aria-live="polite"
                aria-label={`Time remaining: ${formatCountdown((deadlineMs ?? 0) - now)}`}
              >
                {formatCountdown((deadlineMs ?? 0) - now)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Submissions so far</span>
              <span className="text-data">{submissionCount}</span>
            </div>
            <Separator />
            {brief ? (
              <div className="space-y-2">
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
              </div>
            ) : (
              <p className="text-muted-foreground">Brief unavailable.</p>
            )}
            {lockedReason && (
              <p role="alert" className="rounded-md border border-border bg-secondary p-3 text-warm-gray">
                {lockedReason}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Program details</CardTitle>
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {isLocked ? "" : saving ? "Saving…" : saveStatus}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="program-title">Title</Label>
                <Input
                  id="program-title"
                  value={builder.title}
                  disabled={isLocked}
                  onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-summary">Summary</Label>
                <Textarea
                  id="program-summary"
                  value={builder.summary}
                  disabled={isLocked}
                  rows={4}
                  onChange={(e) => update((d) => ({ ...d, summary: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {builder.weeks.map((week, weekIndex) => (
            <Card key={week.localId}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Week {week.weekNumber}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLocked || weekIndex === 0}
                    aria-label={`Move week ${week.weekNumber} up`}
                    onClick={() => moveWeek(week.localId, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLocked || weekIndex === builder.weeks.length - 1}
                    aria-label={`Move week ${week.weekNumber} down`}
                    onClick={() => moveWeek(week.localId, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isLocked || builder.weeks.length <= 1}
                    onClick={() => removeWeek(week.localId)}
                  >
                    Remove week
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`week-focus-${week.localId}`}>
                    Focus (also carries progression guidance for this week)
                  </Label>
                  <Textarea
                    id={`week-focus-${week.localId}`}
                    value={week.focus}
                    disabled={isLocked}
                    rows={2}
                    onChange={(e) => updateWeekFocus(week.localId, e.target.value)}
                  />
                </div>

                {week.days.map((day, dayIndex) => (
                  <div key={day.localId} className="rounded-md border border-border p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium text-foreground">Day {day.dayNumber}</h3>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isLocked || week.days.length <= 1}
                          onClick={() => removeDay(week.localId, day.localId)}
                        >
                          Remove day
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`day-title-${day.localId}`}>Day title</Label>
                        <Input
                          id={`day-title-${day.localId}`}
                          value={day.title}
                          disabled={isLocked}
                          onChange={(e) =>
                            updateDay(week.localId, day.localId, { title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`day-notes-${day.localId}`}>Notes</Label>
                        <Input
                          id={`day-notes-${day.localId}`}
                          value={day.notes ?? ""}
                          disabled={isLocked}
                          onChange={(e) =>
                            updateDay(week.localId, day.localId, { notes: e.target.value || null })
                          }
                        />
                      </div>
                    </div>

                    <ul className="mt-3 space-y-3" aria-label={`Exercises for day ${day.dayNumber}`}>
                      {day.exercises.map((ex, exIndex) => (
                        <li
                          key={ex.localId}
                          draggable={!isLocked}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", String(exIndex));
                          }}
                          onDragOver={(e) => {
                            if (isLocked) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (isLocked) return;
                            e.preventDefault();
                            const from = Number(e.dataTransfer.getData("text/plain"));
                            if (Number.isNaN(from)) return;
                            reorderExercises(week.localId, day.localId, from, exIndex);
                          }}
                          className="rounded-md border border-border bg-card p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              Exercise {exIndex + 1} of {day.exercises.length} (drag to reorder)
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isLocked || exIndex === 0}
                                aria-label={`Move ${ex.name || "exercise"} up`}
                                onClick={() =>
                                  reorderExercises(week.localId, day.localId, exIndex, exIndex - 1)
                                }
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isLocked || exIndex === day.exercises.length - 1}
                                aria-label={`Move ${ex.name || "exercise"} down`}
                                onClick={() =>
                                  reorderExercises(week.localId, day.localId, exIndex, exIndex + 1)
                                }
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isLocked}
                                aria-label={`Remove ${ex.name || "exercise"}`}
                                onClick={() => removeExercise(week.localId, day.localId, ex.localId)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                              <Label htmlFor={`ex-name-${ex.localId}`}>Name</Label>
                              <Input
                                id={`ex-name-${ex.localId}`}
                                value={ex.name}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    name: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`ex-sets-${ex.localId}`}>Sets</Label>
                              <Input
                                id={`ex-sets-${ex.localId}`}
                                type="number"
                                min={1}
                                max={20}
                                value={ex.sets ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    sets: e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`ex-reps-${ex.localId}`}>Reps</Label>
                              <Input
                                id={`ex-reps-${ex.localId}`}
                                value={ex.reps ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    reps: e.target.value || null,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`ex-load-${ex.localId}`}>Load note</Label>
                              <Input
                                id={`ex-load-${ex.localId}`}
                                value={ex.loadNote ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    loadNote: e.target.value || null,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`ex-rest-${ex.localId}`}>Rest note</Label>
                              <Input
                                id={`ex-rest-${ex.localId}`}
                                value={ex.restNote ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    restNote: e.target.value || null,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                              <Label htmlFor={`ex-cue-${ex.localId}`}>
                                Coaching cue (also carries tempo guidance)
                              </Label>
                              <Input
                                id={`ex-cue-${ex.localId}`}
                                value={ex.coachingCue ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateExercise(week.localId, day.localId, ex.localId, {
                                    coachingCue: e.target.value || null,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={isLocked || day.exercises.length >= 30}
                      onClick={() => addExercise(week.localId, day.localId)}
                    >
                      Add exercise
                    </Button>
                    {dayIndex === week.days.length - 1 && null}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLocked || week.days.length >= 7}
                  onClick={() => addDay(week.localId)}
                >
                  Add day
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" disabled={isLocked || builder.weeks.length >= 52} onClick={addWeek}>
            Add week
          </Button>
        </div>
      </div>

      {issues.length > 0 && (
        <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Fix the following before saving or submitting:</p>
          <ul className="mt-1 list-inside list-disc">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button type="button" variant="secondary" disabled={isLocked || saving} onClick={() => void persist(false)}>
          {saving ? "Saving…" : "Save draft"}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              disabled={isLocked || submitting}
              onClick={() => {
                if (validation && !validation.success) setIssues(collectIssues(validation));
              }}
            >
              {submitting ? "Submitting…" : "Submit program"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm submission</DialogTitle>
              <DialogDescription>
                You may submit exactly one program per challenge. Once submitted, it is sealed and
                hidden from other coaches until evaluation completes. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                disabled={submitting || (validation ? !validation.success : true)}
                onClick={() => void persist(true)}
              >
                Confirm submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

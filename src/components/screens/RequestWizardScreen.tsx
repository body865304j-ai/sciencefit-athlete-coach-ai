import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRequest } from "@/lib/flow.functions";
import {
  athleteRequestInput,
  type AthleteRequestInput,
} from "@/lib/schemas";
import {
  CHALLENGE_RULES,
  REQUEST_DRAFT_AUTOSAVE_SECONDS,
  REQUEST_DRAFT_EXPIRY_DAYS,
} from "@/lib/business";

const COMMON_EQUIPMENT = [
  "Barbell",
  "Dumbbells",
  "Kettlebell",
  "Resistance bands",
  "Pull-up bar",
  "Bench",
  "Squat rack",
  "Cardio machine",
  "None / bodyweight only",
] as const;

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "elite", label: "Elite" },
] as const;

type WizardData = {
  goal: string;
  equipment: string[];
  experienceLevel: "beginner" | "intermediate" | "advanced" | "elite" | "";
  trainingDays: number;
  sessionMinutes: number;
  injuryNotes: string;
  clinicalFlag: boolean;
};

const EMPTY_DATA: WizardData = {
  goal: "",
  equipment: [],
  experienceLevel: "",
  trainingDays: 3,
  sessionMinutes: 60,
  injuryNotes: "",
  clinicalFlag: false,
};

const DRAFT_KEY = "sciencefit.request-wizard.draft";

type Draft = { savedAt: number; step: number; data: WizardData };

const STEPS = [
  "Goal",
  "Equipment",
  "Experience",
  "Availability",
  "Health",
  "Preferences",
  "Review",
  "Submit",
] as const;

function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    const ageDays = (Date.now() - parsed.savedAt) / (1000 * 60 * 60 * 24);
    if (ageDays > REQUEST_DRAFT_EXPIRY_DAYS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(step: number, data: WizardData) {
  try {
    const draft: Draft = { savedAt: Date.now(), step, data };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage failures
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function RequestWizardScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createRequestFn = useServerFn(createRequest);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [equipmentDraft, setEquipmentDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const restored = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore draft on mount.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = loadDraft();
    if (draft) {
      setData(draft.data);
      setStep(draft.step);
    }
  }, []);

  // Debounced autosave on every change + periodic autosave timer.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveDraft(step, data);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [step, data]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      saveDraft(step, data);
    }, REQUEST_DRAFT_AUTOSAVE_SECONDS * 1000);
    return () => window.clearInterval(interval);
  }, [step, data]);

  // Focus heading on step change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const patch = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const goTo = useCallback((target: number) => {
    setErrors({});
    setStep(target);
  }, []);

  const validateStep = useCallback(
    (current: number): boolean => {
      const nextErrors: Record<string, string> = {};

      if (current === 0) {
        const result = athleteRequestInput.shape.goal.safeParse(data.goal);
        if (!result.success) {
          nextErrors['goal'] =
            result.error.issues[0]?.message ?? "Goal is invalid.";
        }
      }

      if (current === 1) {
        const result = athleteRequestInput.shape.equipment.safeParse(
          data.equipment,
        );
        if (!result.success) {
          nextErrors['equipment'] =
            result.error.issues[0]?.message ?? "Equipment is invalid.";
        }
      }

      if (current === 2) {
        const result = athleteRequestInput.shape.experienceLevel.safeParse(
          data.experienceLevel,
        );
        if (!result.success) {
          nextErrors['experienceLevel'] = "Choose an experience level.";
        }
      }

      if (current === 3) {
        const daysResult = athleteRequestInput.shape.trainingDays.safeParse(
          data.trainingDays,
        );
        if (!daysResult.success) {
          nextErrors['trainingDays'] =
            daysResult.error.issues[0]?.message ?? "Invalid training days.";
        }
        const minutesResult = athleteRequestInput.shape.sessionMinutes.safeParse(
          data.sessionMinutes,
        );
        if (!minutesResult.success) {
          nextErrors['sessionMinutes'] =
            minutesResult.error.issues[0]?.message ?? "Invalid session length.";
        }
      }

      if (current === 4) {
        const notesResult = athleteRequestInput.shape.injuryNotes.safeParse(
          data.injuryNotes || null,
        );
        if (!notesResult.success) {
          nextErrors['injuryNotes'] =
            notesResult.error.issues[0]?.message ?? "Notes are too long.";
        }
      }

      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [data],
  );

  const handleNext = useCallback(() => {
    if (!validateStep(step)) return;
    goTo(Math.min(step + 1, STEPS.length - 1));
  }, [step, validateStep, goTo]);

  const handleBack = useCallback(() => {
    goTo(Math.max(step - 1, 0));
  }, [step, goTo]);

  const payload: AthleteRequestInput | null = useMemo(() => {
    if (data.experienceLevel === "") return null;
    const candidate = {
      goal: data.goal.trim(),
      experienceLevel: data.experienceLevel,
      trainingDays: data.trainingDays,
      sessionMinutes: data.sessionMinutes,
      equipment: data.equipment,
      injuryNotes: data.injuryNotes.trim() ? data.injuryNotes.trim() : null,
      clinicalFlag: data.clinicalFlag,
    };
    const result = athleteRequestInput.safeParse(candidate);
    return result.success ? result.data : null;
  }, [data]);

  const handleSubmit = useCallback(async () => {
    if (!payload) {
      setSubmitError("Please complete every required step before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createRequestFn({ data: payload });
      await queryClient.invalidateQueries({ queryKey: ["athlete-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["viewer"] });
      clearDraft();
      toast.success("Request submitted.");
      if (result && typeof result === "object" && "challengeId" in result && result.challengeId) {
        void navigate({
          to: "/app/challenges/$challengeId",
          params: { challengeId: result.challengeId },
        } as unknown as Parameters<typeof navigate>[0]);
      } else {
        void navigate({ to: "/app" } as unknown as Parameters<typeof navigate>[0]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit request.";
      setSubmitError(message);
      toast.error(message);
      setStep(6); // stay on the review step
    } finally {
      setSubmitting(false);
    }
  }, [payload, createRequestFn, queryClient, navigate]);

  const addEquipment = useCallback(() => {
    const value = equipmentDraft.trim();
    if (!value) return;
    if (data.equipment.includes(value)) {
      setEquipmentDraft("");
      return;
    }
    if (data.equipment.length >= 30) {
      setErrors((prev) => ({ ...prev, equipment: "Maximum of 30 items." }));
      return;
    }
    patch({ equipment: [...data.equipment, value] });
    setEquipmentDraft("");
  }, [equipmentDraft, data.equipment, patch]);

  const removeEquipment = useCallback(
    (value: string) => {
      patch({ equipment: data.equipment.filter((item) => item !== value) });
    },
    [data.equipment, patch],
  );

  const toggleCommonEquipment = useCallback(
    (item: string, checked: boolean) => {
      if (checked) {
        if (data.equipment.includes(item)) return;
        patch({ equipment: [...data.equipment, item] });
      } else {
        patch({ equipment: data.equipment.filter((e) => e !== item) });
      }
    },
    [data.equipment, patch],
  );

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        New Athlete Request
      </h1>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <span className="text-data">{Math.round(progressValue)}%</span>
        </div>
        <Progress
          value={progressValue}
          aria-label={`Wizard progress: step ${step + 1} of ${STEPS.length}`}
        />
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-xl text-foreground focus-visible:outline-none"
            >
              {STEPS[step]}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {step === 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal">What is your training goal?</Label>
              <Textarea
                id="goal"
                value={data.goal}
                onChange={(e) => patch({ goal: e.target.value })}
                aria-describedby={errors['goal'] ? "goal-error" : undefined}
                aria-invalid={Boolean(errors['goal'])}
                placeholder="e.g. Build strength for a powerlifting meet in 12 weeks"
                minLength={3}
                maxLength={200}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {data.goal.length}/200 characters
              </p>
              {errors['goal'] && (
                <p id="goal-error" role="alert" className="text-sm text-destructive">
                  {errors['goal']}
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-foreground">
                  Available equipment
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {COMMON_EQUIPMENT.map((item) => {
                    const checkboxId = `equipment-${item.replace(/\s+/g, "-").toLowerCase()}`;
                    return (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox
                          id={checkboxId}
                          checked={data.equipment.includes(item)}
                          onCheckedChange={(checked) =>
                            toggleCommonEquipment(item, checked === true)
                          }
                        />
                        <Label htmlFor={checkboxId} className="font-normal">
                          {item}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="equipment-add">Add other equipment</Label>
                <div className="flex gap-2">
                  <Input
                    id="equipment-add"
                    value={equipmentDraft}
                    onChange={(e) => setEquipmentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEquipment();
                      }
                    }}
                    maxLength={60}
                    placeholder="e.g. TRX straps"
                    aria-describedby={errors['equipment'] ? "equipment-error" : undefined}
                  />
                  <Button type="button" variant="secondary" onClick={addEquipment}>
                    Add
                  </Button>
                </div>
                {data.equipment.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Selected equipment">
                    {data.equipment.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => removeEquipment(item)}
                          className="tap-target rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
                          aria-label={`Remove ${item}`}
                        >
                          {item} &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {errors['equipment'] && (
                  <p id="equipment-error" role="alert" className="text-sm text-destructive">
                    {errors['equipment']}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">
                Experience level
              </legend>
              <RadioGroup
                value={data.experienceLevel}
                onValueChange={(value) =>
                  patch({ experienceLevel: value as WizardData["experienceLevel"] })
                }
                aria-describedby={
                  errors['experienceLevel'] ? "experience-error" : undefined
                }
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <div key={level.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      id={`experience-${level.value}`}
                      value={level.value}
                    />
                    <Label htmlFor={`experience-${level.value}`} className="font-normal">
                      {level.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors['experienceLevel'] && (
                <p id="experience-error" role="alert" className="text-sm text-destructive">
                  {errors['experienceLevel']}
                </p>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="training-days">Training days per week</Label>
                <Input
                  id="training-days"
                  type="number"
                  min={1}
                  max={7}
                  value={data.trainingDays}
                  onChange={(e) =>
                    patch({ trainingDays: Number(e.target.value) || 0 })
                  }
                  aria-describedby={
                    errors['trainingDays'] ? "training-days-error" : undefined
                  }
                  aria-invalid={Boolean(errors['trainingDays'])}
                />
                {errors['trainingDays'] && (
                  <p
                    id="training-days-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors['trainingDays']}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="session-minutes">Session length (minutes)</Label>
                <Input
                  id="session-minutes"
                  type="number"
                  min={15}
                  max={240}
                  value={data.sessionMinutes}
                  onChange={(e) =>
                    patch({ sessionMinutes: Number(e.target.value) || 0 })
                  }
                  aria-describedby={
                    errors['sessionMinutes'] ? "session-minutes-error" : undefined
                  }
                  aria-invalid={Boolean(errors['sessionMinutes'])}
                />
                {errors['sessionMinutes'] && (
                  <p
                    id="session-minutes-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors['sessionMinutes']}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="injury-notes">
                  Injury or health restrictions (optional)
                </Label>
                <Textarea
                  id="injury-notes"
                  value={data.injuryNotes}
                  onChange={(e) => patch({ injuryNotes: e.target.value })}
                  maxLength={1000}
                  rows={4}
                  aria-describedby={
                    errors['injuryNotes'] ? "injury-notes-error" : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {data.injuryNotes.length}/1000 characters
                </p>
                {errors['injuryNotes'] && (
                  <p
                    id="injury-notes-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors['injuryNotes']}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="clinical-flag">
                    I have a clinical / medical condition
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Flags your request for mandatory medical review before a
                    coach programs it.
                  </p>
                </div>
                <Switch
                  id="clinical-flag"
                  checked={data.clinicalFlag}
                  onCheckedChange={(checked) => patch({ clinicalFlag: checked })}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            // Governance: schemas.ts defines the full canonical Request payload; no additional preference fields exist.
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  Challenge rules that apply to your request
                </h3>
                <ul className="flex flex-col gap-3">
                  {CHALLENGE_RULES.map((rule) => (
                    <li
                      key={rule.rule}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">{rule.rule}</p>
                      <p className="text-muted-foreground">{rule.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                <p>
                  Your draft autosaves every {REQUEST_DRAFT_AUTOSAVE_SECONDS}{" "}
                  seconds and is kept for up to {REQUEST_DRAFT_EXPIRY_DAYS} days if
                  you leave before submitting.
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="flex flex-col gap-4">
              <SummaryRow label="Goal" value={data.goal} onEdit={() => goTo(0)} />
              <SummaryRow
                label="Equipment"
                value={data.equipment.length > 0 ? data.equipment.join(", ") : "None"}
                onEdit={() => goTo(1)}
              />
              <SummaryRow
                label="Experience level"
                value={
                  EXPERIENCE_LEVELS.find((l) => l.value === data.experienceLevel)
                    ?.label ?? "Not set"
                }
                onEdit={() => goTo(2)}
              />
              <SummaryRow
                label="Availability"
                value={`${data.trainingDays} days/week, ${data.sessionMinutes} min/session`}
                onEdit={() => goTo(3)}
              />
              <SummaryRow
                label="Health restrictions"
                value={data.injuryNotes || "None"}
                onEdit={() => goTo(4)}
              />
              <SummaryRow
                label="Clinical flag"
                value={data.clinicalFlag ? "Yes" : "No"}
                onEdit={() => goTo(4)}
              />
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </div>
          )}

          {step === 7 && (
            <div className="flex flex-col gap-4" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                Ready to submit your request. This creates exactly one
                challenge for eligible coaches.
              </p>
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !payload}
                aria-busy={submitting}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={handleBack}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>
        {step < STEPS.length - 1 && (
          <Button type="button" onClick={handleNext}>
            {step === 6 ? "Continue to submit" : "Next"}
          </Button>
        )}
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-warm-gray">
          {label}
        </p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

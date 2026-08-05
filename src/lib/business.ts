/**
 * Business Protocol constants.
 *
 * Source of truth: BUSINESS_PROTOCOL.md Sections 8 (Request Lifecycle),
 * 9 (Challenge Lifecycle), 12 (Challenge Rules) and 13 (Marketplace Logic),
 * plus ARCHITECTURE.md Section 6.2 (offline sync conflict resolution).
 */

import type { ChallengeDifficulty } from "@/lib/performance-score";

/** BUSINESS_PROTOCOL 8.2 Step 4 — Coach Matching Matrix. */
export const COACH_MATCHING_MATRIX: Record<
  ChallengeDifficulty,
  {
    minPerformanceScore: number | null;
    minExperienceYears: number;
    maxConcurrentChallenges: number;
  }
> = {
  beginner: {
    minPerformanceScore: null, // new coaches eligible
    minExperienceYears: 0,
    maxConcurrentChallenges: 5,
  },
  intermediate: {
    minPerformanceScore: 60,
    minExperienceYears: 1,
    maxConcurrentChallenges: 4,
  },
  advanced: {
    minPerformanceScore: 70,
    minExperienceYears: 3,
    maxConcurrentChallenges: 3,
  },
  elite: {
    minPerformanceScore: 80,
    minExperienceYears: 5,
    maxConcurrentChallenges: 2,
  },
};

/** BUSINESS_PROTOCOL 8.2 Step 3 — challenge deadline window (48-72 hours). */
export const CHALLENGE_WINDOW_HOURS = { min: 48, max: 72, default: 72 } as const;

/** BUSINESS_PROTOCOL 8.2 Step 3 — target coach pool size (3-7). */
export const COACH_POOL = { min: 3, max: 7, default: 5 } as const;

/** BUSINESS_PROTOCOL 8.2 Step 5 — deadline reminder offsets, in hours. */
export const DEADLINE_REMINDER_HOURS = [24, 6, 1] as const;

/** BUSINESS_PROTOCOL 8.2 Step 1 — draft handling. */
export const REQUEST_DRAFT_AUTOSAVE_SECONDS = 30;
export const REQUEST_DRAFT_EXPIRY_DAYS = 7;
/** BUSINESS_PROTOCOL 8.2 Step 5 — program draft autosave. */
export const PROGRAM_DRAFT_AUTOSAVE_SECONDS = 60;

/**
 * BUSINESS_PROTOCOL 8.2 Step 3 — "Difficulty Level: Computed from athlete
 * profile". The document names the inputs (athlete profile) and the output
 * levels, and Step 4's matrix keys off the result.
 */
export function challengeDifficulty(
  experienceLevel: string,
): ChallengeDifficulty {
  switch (experienceLevel) {
    case "beginner":
    case "intermediate":
    case "advanced":
    case "elite":
      return experienceLevel;
    default:
      return "beginner";
  }
}

/**
 * BUSINESS_PROTOCOL 8.2 Step 3 — "Estimated Complexity: Algorithmic score
 * based on data volume, medical flags, goal specificity".
 *
 * TODO: Governance gap - the document names the three inputs but does not
 * publish the coefficients or the output range for the complexity score.
 * The combination below uses only the named inputs, each contributing
 * equally, and is marked as provisional.
 * Requires clarification from Product Team.
 */
export function estimatedComplexity(input: {
  fieldsProvided: number;
  totalFields: number;
  clinicalFlag: boolean;
  hasInjuryNotes: boolean;
  goalLength: number;
}): number {
  const dataVolume =
    input.totalFields === 0 ? 0 : input.fieldsProvided / input.totalFields;
  const medicalFlags = (input.clinicalFlag ? 1 : 0) * 0.6 + (input.hasInjuryNotes ? 0.4 : 0);
  const goalSpecificity = Math.min(1, input.goalLength / 200);
  return Number(
    (((dataVolume + medicalFlags + goalSpecificity) / 3) * 100).toFixed(1),
  );
}

/** BUSINESS_PROTOCOL 12.1 — Universal Challenge Rules, for display. */
export const CHALLENGE_RULES = [
  {
    rule: "One Request, One Challenge",
    description: "Each athlete request generates exactly one challenge.",
    enforcement: "System constraint (data layer)",
  },
  {
    rule: "One Submission Per Coach",
    description: "Each coach may submit exactly one program per challenge.",
    enforcement: "System constraint (API layer)",
  },
  {
    rule: "Deadline Enforcement",
    description: "Late submissions are rejected without exception.",
    enforcement: "Automated timestamp validation",
  },
  {
    rule: "Submission Secrecy",
    description: "Programs remain hidden until evaluation.",
    enforcement: "Encryption + access control",
  },
  {
    rule: "Equal Evaluation",
    description: "AI evaluates every submission with identical criteria.",
    enforcement: "Evaluation engine configuration",
  },
  {
    rule: "Original Work",
    description:
      "Programs must be original and created for the specific challenge.",
    enforcement: "Plagiarism detection + manual review",
  },
  {
    rule: "Safety First",
    description:
      "Programs must not contain exercises contraindicated for the athlete's profile.",
    enforcement: "AI safety check + admin review",
  },
] as const;

/** BUSINESS_PROTOCOL 12.2 — rules that can never be waived. */
export const NON_EXCEPTIONABLE_RULES = [
  "Deadline Enforcement",
  "One Submission Per Coach",
  "Equal Evaluation",
] as const;

/** BUSINESS_PROTOCOL 9.1 — challenge state definitions and durations. */
export const CHALLENGE_STATES = [
  { state: "DRAFT", definition: "Created but not yet published", duration: "≤ 1 hour" },
  { state: "PUBLISHED", definition: "Visible to eligible coaches", duration: "≤ 24 hours" },
  { state: "ACTIVE", definition: "Coaches are programming and submitting", duration: "48–72 hours" },
  { state: "LOCKED", definition: "Submissions sealed, evaluation pending", duration: "≤ 30 minutes" },
  { state: "EVALUATING", definition: "AI Evaluation Engine processing", duration: "≤ 15 minutes" },
  { state: "COMPLETED", definition: "Winner selected, results distributed", duration: "≤ 7 days" },
  { state: "ARCHIVED", definition: "Retained for research", duration: "Indefinite" },
] as const;

/** ARCHITECTURE 6.2 — offline sync conflict resolution. */
export const SYNC_CONFLICT_RULES = {
  workout_log: "server",
  athlete_notes: "client",
  program_adherence: "server",
  notification_read_status: "client",
} as const;

export type SyncEntity = keyof typeof SYNC_CONFLICT_RULES;

/** Notification categories used by this slice. */
export const NOTIFICATION_CATEGORIES = [
  "CHALLENGE_INVITATION",
  "DEADLINE_REMINDER",
  "SUBMISSION_LOCKED",
  "EVALUATION_COMPLETE",
  "RESULTS_DELIVERED",
  "PERFORMANCE_SCORE_UPDATED",
  "ESCALATION_RAISED",
  "REQUEST_VALIDATED",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * ScienceFit shared domain constants.
 *
 * Every value in this file is stated verbatim in the governance brief.
 * Nothing here is inferred. Where the governance documents were not
 * available, a TODO marks the gap rather than guessing a value.
 */

/* ---------------------------------------------------------------
 * AI Evaluation Engine — the 7 dimensions and their exact weights.
 * The app NEVER produces these scores; it only renders what the
 * SEEv2 engine returns and pins the criteria version per challenge.
 * ------------------------------------------------------------- */
export const EVALUATION_DIMENSIONS = [
  { key: "SAFETY", label: "Safety", weight: 1.5 },
  { key: "GOAL_ALIGNMENT", label: "Goal Alignment", weight: 1.2 },
  { key: "PERSONALIZATION", label: "Personalization", weight: 1.0 },
  { key: "PROGRAMMING_QUALITY", label: "Programming Quality", weight: 1.0 },
  { key: "SCIENTIFIC_CONSISTENCY", label: "Scientific Consistency", weight: 1.0 },
  { key: "PRACTICALITY", label: "Practicality", weight: 0.8 },
  { key: "COMMUNICATION_QUALITY", label: "Communication Quality", weight: 0.8 },
] as const;

export type EvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number]["key"];

export const DIMENSION_WEIGHTS = Object.fromEntries(
  EVALUATION_DIMENSIONS.map((d) => [d.key, d.weight]),
) as Record<EvaluationDimension, number>;

/* ---------------------------------------------------------------
 * Human Oversight Escalation ladder.
 * ------------------------------------------------------------- */
export const ESCALATION_LEVELS = [
  {
    key: "L1",
    label: "Auto-Reject",
    trigger: "Safety < 30",
    slaHours: 0,
    slaLabel: "immediate",
  },
  {
    key: "L2",
    label: "Admin Alert",
    trigger: "Safety 30-50",
    slaHours: 2,
    slaLabel: "\u2264 2 hr",
  },
  {
    key: "L3",
    label: "Expert Review",
    trigger: "Elite / Rehab / Complex",
    slaHours: 24,
    slaLabel: "\u2264 24 hr",
  },
  {
    key: "L4",
    label: "Medical Review",
    trigger: "Clinical population",
    slaHours: 48,
    slaLabel: "\u2264 48 hr",
  },
  {
    key: "L5",
    label: "Dispute Resolution",
    trigger: "Appeal / Complaint / Anomaly",
    slaHours: 72,
    slaLabel: "\u2264 72 hr",
  },
] as const;

export type EscalationLevel = (typeof ESCALATION_LEVELS)[number]["key"];

/** Medical reviewers only see L3/L4 escalations (attribute-based permission). */
export const MEDICAL_REVIEWER_LEVELS: readonly string[] = ["L3", "L4"];

/* ---------------------------------------------------------------
 * Business Protocol Section 11 — Performance Score tiers.
 * ------------------------------------------------------------- */
export const PERFORMANCE_TIERS = [
  { name: "Novice", min: 0, max: 59 },
  { name: "Developing", min: 60, max: 69 },
  { name: "Proficient", min: 70, max: 79 },
  { name: "Expert", min: 80, max: 89 },
  { name: "Master", min: 90, max: 100 },
] as const;

export function performanceTier(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  return (
    PERFORMANCE_TIERS.find((t) => score >= t.min && score <= t.max) ?? null
  );
}

/* ---------------------------------------------------------------
 * Business Protocol Section 13 — Marketplace gating thresholds.
 * ------------------------------------------------------------- */
export const MARKETPLACE_GATES = {
  browse: 60,
  message: 70,
  hire: 75,
} as const;

export function canBrowseCoach(score: number | null | undefined) {
  return (score ?? -1) >= MARKETPLACE_GATES.browse;
}
export function canMessageCoach(score: number | null | undefined) {
  return (score ?? -1) >= MARKETPLACE_GATES.message;
}
export function canHireCoach(
  score: number | null | undefined,
  marketplaceEnabled: boolean,
  hasPaymentMethod: boolean,
) {
  return (
    (score ?? -1) >= MARKETPLACE_GATES.hire &&
    marketplaceEnabled &&
    hasPaymentMethod
  );
}

/* ---------------------------------------------------------------
 * Lifecycles (Business Protocol).
 * ------------------------------------------------------------- */
export const ATHLETE_LIFECYCLE = [
  "UNREGISTERED",
  "REGISTERED",
  "ACTIVE",
  "REQUEST_PENDING",
  "VALID",
  "CHALLENGE_ACTIVE",
  "PROGRAM_DELIVERED",
  "IN_PROGRESS",
  "COMPLETED",
  "PRIVATE_CLIENT",
] as const;

export const COACH_LIFECYCLE = [
  "UNREGISTERED",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "QUALIFIED",
  "ACTIVE",
  "PROGRAMMING",
  "SUBMITTED",
  "EVALUATION_PENDING",
  "RESULTS_RECEIVED",
  "MARKETPLACE_ELIGIBLE",
  "PRIVATE_CLIENT_ACTIVE",
] as const;

export const CHALLENGE_LIFECYCLE = [
  "DRAFT",
  "PUBLISHED",
  "ACTIVE",
  "LOCKED",
  "EVALUATING",
  "COMPLETED",
  "ARCHIVED",
] as const;

/** The 10 steps of the Request Lifecycle, in order. */
export const REQUEST_LIFECYCLE_STEPS = [
  "Athlete Creates Request",
  "AI Validates Request",
  "Challenge Creation",
  "Coach Invitation",
  "Program Development",
  "Submission Lock",
  "AI Evaluation",
  "Ranking",
  "Delivery",
  "Coach Update",
] as const;

/* ---------------------------------------------------------------
 * Structured error codes.
 * TODO: Governance gap - the canonical error-code registry and
 * documentation URLs live in the Architecture document, which was not
 * provided. Codes below cover only failures this slice can raise.
 * Requires clarification from Principal Backend Architect.
 * ------------------------------------------------------------- */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface StructuredError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  requestId: string;
  docsUrl: string;
}

export const ERROR_DOCS_BASE = "/docs/errors";

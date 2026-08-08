/**
 * Scoring methodology helpers.
 *
 * Source of truth: AI_EVALUATION_ENGINE.md Sections 9 (Scoring Methodology)
 * and 13 (Human Oversight Protocol).
 *
 * The platform NEVER produces dimension scores — those come exclusively from
 * the SEEv2 engine. What lives here is the aggregation, the confidence bands
 * and the escalation ladder, all of which the platform must be able to verify
 * and display independently (Transparency Policy, Business Protocol 14).
 */

import { DIMENSION_WEIGHTS, type EvaluationDimension } from "@/lib/domain";

export interface DimensionScore {
  dimension: EvaluationDimension;
  score: number;
  confidence: number;
}

/** AI Evaluation Engine 9.1 — total weight of the seven dimensions. */
export const TOTAL_DIMENSION_WEIGHT = 7.3;

/**
 * AI Evaluation Engine 9.1 — AGGREGATION FORMULA.
 * Confidence-weighted mean of the seven weighted dimension scores.
 */
export function aggregateTotalScore(dimensions: DimensionScore[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const d of dimensions) {
    const weight = DIMENSION_WEIGHTS[d.dimension];
    if (weight === undefined) continue;
    numerator += d.score * weight * d.confidence;
    denominator += weight * d.confidence;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Same aggregation with every confidence pinned to 1 — used for drift check. */
export function aggregateUnweightedScore(dimensions: DimensionScore[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const d of dimensions) {
    const weight = DIMENSION_WEIGHTS[d.dimension];
    if (weight === undefined) continue;
    numerator += d.score * weight;
    denominator += weight;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/** AI Evaluation Engine 9.1 — CONFIDENCE THRESHOLD. */
export const MIN_DIMENSION_CONFIDENCE = 0.6;
export const MAX_CONFIDENCE_DRIFT_POINTS = 10;

export interface ConfidenceReviewFlag {
  code: "LOW_DIMENSION_CONFIDENCE" | "CONFIDENCE_DRIFT";
  message: string;
}

export function confidenceReviewFlags(dimensions: DimensionScore[]): ConfidenceReviewFlag[] {
  const flags: ConfidenceReviewFlag[] = [];
  const low = dimensions.filter((d) => d.confidence < MIN_DIMENSION_CONFIDENCE);
  if (low.length > 0) {
    flags.push({
      code: "LOW_DIMENSION_CONFIDENCE",
      message: `Confidence below ${MIN_DIMENSION_CONFIDENCE} on: ${low
        .map((d) => d.dimension)
        .join(", ")}.`,
    });
  }
  const drift = Math.abs(aggregateTotalScore(dimensions) - aggregateUnweightedScore(dimensions));
  if (drift > MAX_CONFIDENCE_DRIFT_POINTS) {
    flags.push({
      code: "CONFIDENCE_DRIFT",
      message: `Confidence-weighted score differs from unweighted by ${drift.toFixed(1)} points.`,
    });
  }
  return flags;
}

/** AI Evaluation Engine 9.2 — confidence interpretation bands. */
export const CONFIDENCE_BANDS = [
  { min: 0.9, max: 1.0, label: "High confidence", action: "Auto-approve" },
  {
    min: 0.75,
    max: 0.89,
    label: "Good confidence",
    action: "Auto-approve; note in audit log",
  },
  {
    min: 0.6,
    max: 0.74,
    label: "Moderate confidence",
    action: "Auto-approve; flag for spot-check",
  },
  {
    min: 0.4,
    max: 0.59,
    label: "Low confidence",
    action: "Hold for human review",
  },
  {
    min: 0.0,
    max: 0.39,
    label: "Very low confidence",
    action: "Hold for human review; do not score",
  },
] as const;

export function confidenceBand(confidence: number) {
  return CONFIDENCE_BANDS.find((b) => confidence >= b.min && confidence <= b.max) ?? null;
}

/* ---------------------------------------------------------------
 * AI Evaluation Engine 13.2 / 13.3 — escalation ladder.
 * ------------------------------------------------------------- */

export const SAFETY_AUTO_REJECT_THRESHOLD = 30;
export const SAFETY_ADMIN_ALERT_THRESHOLD = 50;

export interface EscalationContext {
  safetyScore: number;
  minConfidence: number;
  /** Athlete flagged their profile as clinical (physician clearance needed). */
  clinicalPopulation: boolean;
  /** Elite athlete, complex rehabilitation, or rare medical condition. */
  expertReviewRequired: boolean;
  /** An appeal, complaint or anomaly detection trigger is open. */
  disputeOpen: boolean;
  /** A medical condition was flagged during request validation. */
  medicalConditionFlagged: boolean;
}

export type EscalationDecision = "NONE" | "L1" | "L2" | "L3" | "L4" | "L5";

/**
 * Implements the escalation workflow decision tree in the order the document
 * draws it: Safety gate first, then expert, then medical, then dispute.
 */
export function determineEscalation(context: EscalationContext): EscalationDecision {
  if (context.safetyScore < SAFETY_AUTO_REJECT_THRESHOLD) return "L1";
  if (
    context.safetyScore <= SAFETY_ADMIN_ALERT_THRESHOLD ||
    context.medicalConditionFlagged ||
    context.minConfidence < MIN_DIMENSION_CONFIDENCE
  )
    return "L2";
  if (context.expertReviewRequired) return "L3";
  if (context.clinicalPopulation) return "L4";
  if (context.disputeOpen) return "L5";
  return "NONE";
}

/** AI Evaluation Engine 13.2 — response-time SLA in hours. */
export const ESCALATION_SLA_HOURS: Record<Exclude<EscalationDecision, "NONE">, number> = {
  L1: 0,
  L2: 2,
  L3: 24,
  L4: 48,
  L5: 72,
};

export function escalationDueAt(level: EscalationDecision, from: Date = new Date()): string | null {
  if (level === "NONE") return null;
  const hours = ESCALATION_SLA_HOURS[level];
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

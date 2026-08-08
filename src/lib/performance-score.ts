/**
 * Performance Score computation.
 *
 * Source of truth: AI_EVALUATION_ENGINE.md Section 12.1 ("PERFORMANCE SCORE
 * FORMULA (v2.0)"). BUSINESS_PROTOCOL.md Section 11.2 states an older variant
 * of the same formula; per the document priority hierarchy the AI Evaluation
 * Engine specification wins. See DEVIATIONS.md entry D-01.
 *
 * This module is pure and deterministic so it can be unit-tested and so the
 * exact computation snapshot can be persisted for dispute resolution
 * (AI Evaluation Engine 12.2 "Auditable").
 */

export type ChallengeDifficulty = "beginner" | "intermediate" | "advanced" | "elite";

/** AI Evaluation Engine 12.1 — difficulty weights D. */
export const DIFFICULTY_WEIGHTS: Record<ChallengeDifficulty, number> = {
  beginner: 0.8,
  intermediate: 1.0,
  advanced: 1.2,
  elite: 1.5,
};

/** AI Evaluation Engine 12.1 — recency decay weights, most recent first. */
export const RECENCY_WEIGHTS = [
  1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
  0.5, 0.5,
] as const;

export const MAX_HISTORY_WINDOW = 20;
export const TREND_WINDOW = 10;
export const CONSISTENCY_WINDOW = 10;

export interface SubmissionHistoryEntry {
  /** Total score for that submission, 0-100. */
  score: number;
  difficulty: ChallengeDifficulty;
  /** ISO timestamp, used only for ordering upstream. */
  occurredAt: string;
}

export interface PerformanceScoreBreakdown {
  baseScore: number;
  trendBonus: number;
  consistencyBonus: number;
  volumePenalty: number;
  rawScore: number;
  performanceScore: number;
  submissionsCounted: number;
  totalSubmissions: number;
  trendSlope: number;
  consistencyStdDev: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Least-squares slope of score against submission index (oldest -> newest). */
export function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const y = values[i];
    if (y === undefined) continue;
    numerator += (i - meanX) * (y - meanY);
    denominator += (i - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export function standardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/** AI Evaluation Engine 12.1 — TREND COMPONENT. */
export function trendBonus(slope: number): number {
  if (slope > 2.0) return 8;
  if (slope > 1.0) return 5;
  if (slope > -1.0) return 0;
  if (slope > -2.0) return -3;
  return -7;
}

/** AI Evaluation Engine 12.1 — CONSISTENCY COMPONENT. */
export function consistencyBonus(stdDev: number): number {
  if (stdDev < 5) return 5;
  if (stdDev < 10) return 2;
  if (stdDev < 15) return 0;
  return -3;
}

/** AI Evaluation Engine 12.1 — VOLUME PENALTY. */
export function volumePenalty(totalSubmissions: number): number {
  if (totalSubmissions < 5) return -5;
  if (totalSubmissions < 10) return -2;
  return 0;
}

/**
 * @param history Submission scores sorted MOST RECENT FIRST.
 */
export function computePerformanceScore(
  history: SubmissionHistoryEntry[],
): PerformanceScoreBreakdown {
  const totalSubmissions = history.length;
  const window = history.slice(0, Math.min(MAX_HISTORY_WINDOW, totalSubmissions));

  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < window.length; i += 1) {
    const entry = window[i];
    if (!entry) continue;
    const recency = RECENCY_WEIGHTS[i] ?? 0.5;
    const difficulty = DIFFICULTY_WEIGHTS[entry.difficulty];
    weightedSum += entry.score * recency * difficulty;
    weightSum += recency * difficulty;
  }
  const baseScore = weightSum === 0 ? 0 : weightedSum / weightSum;

  // Trend regression runs oldest -> newest so a positive slope means improving.
  const trendScores = window
    .slice(0, TREND_WINDOW)
    .map((entry) => entry.score)
    .reverse();
  const slope = linearRegressionSlope(trendScores);

  const consistencyScores = window.slice(0, CONSISTENCY_WINDOW).map((entry) => entry.score);
  const stdDev = standardDeviation(consistencyScores);

  const trend = trendBonus(slope);
  const consistency = consistencyBonus(stdDev);
  const volume = volumePenalty(totalSubmissions);
  const rawScore = baseScore + trend + consistency + volume;

  return {
    baseScore,
    trendBonus: trend,
    consistencyBonus: consistency,
    volumePenalty: volume,
    rawScore,
    performanceScore: clamp(rawScore, 0, 100),
    submissionsCounted: window.length,
    totalSubmissions,
    trendSlope: slope,
    consistencyStdDev: stdDev,
  };
}

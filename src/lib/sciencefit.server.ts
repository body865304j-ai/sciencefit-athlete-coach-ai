/**
 * Server-only helpers for the ScienceFit request -> ranked delivery flow.
 * Never imported by route or *.functions.ts module scope.
 */

/**
 * Anonymity enforcement: the coach identifier is replaced by a salted,
 * per-challenge hash before anything reaches the evaluation engine.
 * Reverse lookup is impossible without the challenge-scoped salt.
 */
export async function anonymousHash(
  challengeSalt: string,
  coachId: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${challengeSalt}:${coachId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Strips every coach-identifying attribute from a submission before it is
 * handed to the evaluation engine (Security Layer 7).
 */
export function anonymizeSubmission<T extends Record<string, unknown>>(
  program: T,
  hash: string,
) {
  const {
    coach_id: _coachId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rest
  } = program as Record<string, unknown>;
  return { ...rest, coach: hash, anonymous_hash: hash };
}

export interface RankableEvaluation {
  id: string;
  overall_score: number | null;
  submitted_at: string | null;
  safety: number | null;
  personalization: number | null;
}

export interface RankedEvaluation extends RankableEvaluation {
  rank: number;
  coWinner: boolean;
}

/**
 * Tie-Breaker Rules (Business Protocol):
 *   1) Higher Safety score wins
 *   2) Higher Personalization score wins
 *   3) Earlier submission timestamp wins
 *   4) Co-winners if still tied
 */
export function rankWithTieBreakers(
  rows: RankableEvaluation[],
): RankedEvaluation[] {
  const num = (v: number | null) => (v === null ? -Infinity : v);
  const time = (v: string | null) => (v === null ? Infinity : Date.parse(v));

  const identical = (a: RankableEvaluation, b: RankableEvaluation) =>
    num(a.overall_score) === num(b.overall_score) &&
    num(a.safety) === num(b.safety) &&
    num(a.personalization) === num(b.personalization) &&
    time(a.submitted_at) === time(b.submitted_at);

  const sorted = [...rows].sort((a, b) => {
    if (num(b.overall_score) !== num(a.overall_score))
      return num(b.overall_score) - num(a.overall_score);
    if (num(b.safety) !== num(a.safety)) return num(b.safety) - num(a.safety);
    if (num(b.personalization) !== num(a.personalization))
      return num(b.personalization) - num(a.personalization);
    return time(a.submitted_at) - time(b.submitted_at);
  });

  const ranked: RankedEvaluation[] = [];
  let currentRank = 0;
  sorted.forEach((row, index) => {
    const previous = index > 0 ? sorted[index - 1] : undefined;
    const tied = previous !== undefined && identical(previous, row);
    if (!tied) currentRank = index + 1;
    ranked.push({ ...row, rank: currentRank, coWinner: tied });
  });

  // Mark the earlier member of a co-winner pair too.
  for (let i = 0; i < ranked.length - 1; i += 1) {
    const next = ranked[i + 1];
    const current = ranked[i];
    if (next && current && next.coWinner) current.coWinner = true;
  }

  return ranked;
}

export interface RequestValidationOutcome {
  valid: boolean;
  notes: { code: string; message: string }[];
}

/**
 * Step 2 of the Request Lifecycle: "AI Validates Request".
 *
 * TODO: Governance gap - the request validation model, its acceptance
 * criteria, and its rejection codes are not specified in the brief and the
 * AI Evaluation Engine document was not provided. This function is the
 * integration seam only: it performs NO validation and deliberately does not
 * fabricate a verdict. Wire the real validator here.
 * Requires clarification from Principal Backend Architect.
 */
export async function validateAthleteRequest(): Promise<RequestValidationOutcome> {
  return {
    valid: true,
    notes: [
      {
        code: "VALIDATOR_NOT_WIRED",
        message:
          "No request validation service is connected. The request was passed through unvalidated.",
      },
    ],
  };
}

/**
 * TODO: Governance gap - the challenge submission window length is a business
 * rule defined in the Business Protocol, which was not provided.
 * Requires clarification from Product Team.
 */
export const PLACEHOLDER_CHALLENGE_WINDOW_DAYS = 7;

export function structuredError(
  code: string,
  message: string,
  severity: "info" | "warning" | "error" | "critical" = "error",
) {
  const requestId = crypto.randomUUID();
  const error = new Error(
    JSON.stringify({
      code,
      message,
      severity,
      request_id: requestId,
      docs_url: `/docs/errors/${code.toLowerCase()}`,
    }),
  );
  error.name = code;
  return error;
}

/**
 * Coaches module — Performance Score persistence.
 *
 * Source of truth: AI_EVALUATION_ENGINE.md Section 12 (Performance Score
 * Computation). The score is non-purchasable: it is written only by this
 * pipeline, invoked after a challenge completes (12.3).
 */

import {
  computePerformanceScore,
  type ChallengeDifficulty,
  type SubmissionHistoryEntry,
} from "@/lib/performance-score";
import { challengeDifficulty } from "@/lib/business";
import { notify, coachUserIds } from "@/lib/notifications.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Builds the coach's submission history, most recent first. */
export async function loadSubmissionHistory(
  coachId: string,
): Promise<SubmissionHistoryEntry[]> {
  const db = await admin();
  const { data } = await db
    .from("evaluations")
    .select(
      "overall_score, completed_at, status, programs!inner(coach_id), challenges!inner(athlete_requests!inner(experience_level))",
    )
    .eq("programs.coach_id", coachId)
    .eq("status", "COMPLETED")
    .not("overall_score", "is", null)
    .order("completed_at", { ascending: false });

  return (data ?? []).flatMap((row) => {
    if (row.overall_score === null) return [];
    const level =
      row.challenges?.athlete_requests?.experience_level ?? "beginner";
    const difficulty: ChallengeDifficulty = challengeDifficulty(level);
    return [
      {
        score: Number(row.overall_score),
        difficulty,
        occurredAt: row.completed_at ?? new Date().toISOString(),
      },
    ];
  });
}

/**
 * Recomputes and persists a coach's Performance Score together with the full
 * computation snapshot (12.2 "Auditable"), then applies the marketplace and
 * lifecycle consequences of the new score.
 */
export async function updatePerformanceScore(
  coachId: string,
  evaluationId: string | null,
  criteriaVersionId: string | null,
) {
  const db = await admin();

  const { data: coach } = await db
    .from("coaches")
    .select("id, performance_score, marketplace_enabled")
    .eq("id", coachId)
    .maybeSingle();
  if (!coach) return null;

  const history = await loadSubmissionHistory(coachId);
  const breakdown = computePerformanceScore(history);

  await db.from("coach_performance_scores").insert({
    coach_id: coachId,
    evaluation_id: evaluationId,
    previous_score: coach.performance_score,
    base_score: breakdown.baseScore,
    trend_bonus: breakdown.trendBonus,
    consistency_bonus: breakdown.consistencyBonus,
    volume_penalty: breakdown.volumePenalty,
    performance_score: breakdown.performanceScore,
    submissions_counted: breakdown.submissionsCounted,
    computation_snapshot: {
      formula: "AI_EVALUATION_ENGINE 12.1 (v2.0)",
      history,
      breakdown,
    } as never,
    criteria_version_id: criteriaVersionId,
  });

  // Business Protocol 11.4 / 13.2: marketplace access follows the score.
  await db
    .from("coaches")
    .update({
      performance_score: breakdown.performanceScore,
      marketplace_enabled: breakdown.performanceScore >= 60,
      state:
        breakdown.performanceScore >= 60
          ? "MARKETPLACE_ELIGIBLE"
          : "RESULTS_RECEIVED",
    })
    .eq("id", coachId);

  const users = await coachUserIds([coachId]);
  const userId = users.get(coachId);
  if (userId) {
    await notify([
      {
        userId,
        category: "PERFORMANCE_SCORE_UPDATED",
        title: "Performance Score updated",
        body: `Your Performance Score is now ${breakdown.performanceScore.toFixed(
          1,
        )} (base ${breakdown.baseScore.toFixed(1)}, trend ${
          breakdown.trendBonus >= 0 ? "+" : ""
        }${breakdown.trendBonus}, consistency ${
          breakdown.consistencyBonus >= 0 ? "+" : ""
        }${breakdown.consistencyBonus}, volume ${breakdown.volumePenalty}).`,
        linkPath: "/app/profile",
      },
    ]);
  }

  return breakdown;
}

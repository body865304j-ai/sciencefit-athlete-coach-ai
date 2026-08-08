/**
 * Server-only read/write helpers for the authenticated application surface.
 *
 * Every cross-module read goes through this file; routes and components never
 * touch the database directly (ARCHITECTURE 4.2 module boundaries).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { structuredError } from "@/lib/sciencefit.server";
import { MARKETPLACE_GATES } from "@/lib/domain";

/** Normalises a Supabase embedded relation into an array. */
function many<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type Client = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* --------------------------- Athlete dashboard --------------------------- */

export async function loadAthleteDashboard(supabase: Client, userId: string) {
  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!athlete) {
    return {
      athlete: null,
      requests: [],
      challenges: [],
      workoutLogs: [],
      stats: {
        totalRequests: 0,
        activeChallenges: 0,
        completedChallenges: 0,
        programsDelivered: 0,
        sessionsLogged: 0,
        completedSessions: 0,
      },
    };
  }

  const [requestsRes, challengesRes, logsRes] = await Promise.all([
    supabase
      .from("athlete_requests")
      .select("*")
      .eq("athlete_id", athlete.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("challenges")
      .select(
        "id, state, opened_at, deadline_at, locked_at, completed_at, created_at, request_id, athlete_requests(goal, experience_level)",
      )
      .eq("athlete_id", athlete.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("*")
      .eq("athlete_id", athlete.id)
      .order("session_date", { ascending: false })
      .limit(60),
  ]);

  const challenges = challengesRes.data ?? [];
  const logs = logsRes.data ?? [];

  return {
    athlete,
    requests: requestsRes.data ?? [],
    challenges,
    workoutLogs: logs,
    stats: {
      totalRequests: (requestsRes.data ?? []).length,
      activeChallenges: challenges.filter((c) =>
        ["PUBLISHED", "ACTIVE", "LOCKED", "EVALUATING"].includes(c.state),
      ).length,
      completedChallenges: challenges.filter((c) => c.state === "COMPLETED").length,
      programsDelivered: challenges.filter((c) => c.completed_at !== null).length,
      sessionsLogged: logs.length,
      completedSessions: logs.filter((l) => l.completed).length,
    },
  };
}

/* ---------------------------- Coach dashboard ---------------------------- */

export async function loadCoachDashboard(supabase: Client, userId: string) {
  const { data: coach } = await supabase
    .from("coaches")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!coach) {
    return {
      coach: null,
      invitations: [],
      programs: [],
      scoreHistory: [],
      stats: {
        available: 0,
        drafts: 0,
        submitted: 0,
        awaitingEvaluation: 0,
        completed: 0,
        wins: 0,
        successRate: 0,
      },
      rank: null,
      totalRanked: 0,
    };
  }

  const [invitationsRes, programsRes, historyRes] = await Promise.all([
    supabase
      .from("challenge_coach_matches")
      .select(
        "id, status, invited_at, responded_at, challenge_id, challenges(id, state, deadline_at, opened_at, athlete_requests(goal, experience_level, training_days, session_minutes))",
      )
      .eq("coach_id", coach.id)
      .order("invited_at", { ascending: false }),
    supabase
      .from("programs")
      .select(
        "id, title, summary, version, submitted_at, locked_at, created_at, updated_at, challenge_id, challenges(id, state, deadline_at), evaluations(id, status, overall_score, rank, escalation_level, completed_at)",
      )
      .eq("coach_id", coach.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("coach_performance_scores")
      .select("*")
      .eq("coach_id", coach.id)
      .order("created_at", { ascending: true }),
  ]);

  const invitations = invitationsRes.data ?? [];
  const programs = programsRes.data ?? [];

  const evaluated = programs.filter((p) =>
    many(p.evaluations).some((e) => e.status === "COMPLETED"),
  );
  const wins = programs.filter((p) => many(p.evaluations).some((e) => e.rank === 1)).length;

  const rankInfo = await loadCoachRankPosition(coach.id);

  return {
    coach,
    invitations,
    programs,
    scoreHistory: historyRes.data ?? [],
    stats: {
      available: invitations.filter(
        (i) =>
          i.status === "INVITED" &&
          i.challenges?.state !== "LOCKED" &&
          i.challenges?.state !== "COMPLETED",
      ).length,
      drafts: programs.filter((p) => p.submitted_at === null).length,
      submitted: programs.filter((p) => p.submitted_at !== null).length,
      awaitingEvaluation: programs.filter((p) =>
        many(p.evaluations).some((e) => e.status === "QUEUED" || e.status === "RUNNING"),
      ).length,
      completed: evaluated.length,
      wins,
      successRate:
        evaluated.length === 0 ? 0 : Number(((wins / evaluated.length) * 100).toFixed(1)),
    },
    rank: rankInfo.rank,
    totalRanked: rankInfo.total,
  };
}

async function loadCoachRankPosition(coachId: string) {
  const db = await admin();
  const { data } = await db
    .from("coaches")
    .select("id, performance_score")
    .not("performance_score", "is", null)
    .is("deleted_at", null)
    .order("performance_score", { ascending: false });

  const rows = data ?? [];
  const index = rows.findIndex((row) => row.id === coachId);
  return { rank: index === -1 ? null : index + 1, total: rows.length };
}

/* ------------------------------- Ranking -------------------------------- */

/**
 * Leaderboard over the persisted Performance Score. Coach identities are not
 * exposed: only the display name of the profile behind each coach, which the
 * coach controls, plus their published score.
 */
export async function loadLeaderboard(supabase: Client, userId: string) {
  const db = await admin();

  const { data: coaches } = await db
    .from("coaches")
    .select("id, user_id, performance_score, specializations, state, marketplace_enabled")
    .not("performance_score", "is", null)
    .is("deleted_at", null)
    .order("performance_score", { ascending: false })
    .limit(100);

  const rows = coaches ?? [];
  const profileIds = rows.map((row) => row.user_id);
  const { data: profiles } = profileIds.length
    ? await db.from("profiles").select("id, display_name, country").in("id", profileIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p] as const));

  const { data: me } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const leaderboard = rows.map((row, index) => ({
    coachId: row.id,
    rank: index + 1,
    displayName: nameById.get(row.user_id)?.display_name ?? "Coach",
    country: nameById.get(row.user_id)?.country ?? null,
    performanceScore: Number(row.performance_score),
    specializations: row.specializations ?? [],
    marketplaceEnabled: row.marketplace_enabled,
    isViewer: me?.id === row.id,
  }));

  let history: Database["public"]["Tables"]["coach_performance_scores"]["Row"][] = [];
  if (me) {
    const { data } = await db
      .from("coach_performance_scores")
      .select("*")
      .eq("coach_id", me.id)
      .order("created_at", { ascending: true });
    history = data ?? [];
  }

  return { leaderboard, viewerCoachId: me?.id ?? null, history };
}

/* ------------------------------ Marketplace ------------------------------ */

/**
 * BUSINESS_PROTOCOL 13 — Marketplace gating is driven exclusively by the
 * Performance Score: >= 60 to be browsable, >= 70 to be messaged, >= 75 to be
 * hired. No other tiering exists.
 */
export async function loadMarketplace(_supabase: Client) {
  const db = await admin();
  const { data: coaches } = await db
    .from("coaches")
    .select("id, user_id, performance_score, specializations, verified_at, state")
    .eq("marketplace_enabled", true)
    .gte("performance_score", MARKETPLACE_GATES.browse)
    .is("deleted_at", null)
    .order("performance_score", { ascending: false })
    .limit(100);

  const rows = coaches ?? [];
  const { data: profiles } = rows.length
    ? await db
        .from("profiles")
        .select("id, display_name, country, city")
        .in(
          "id",
          rows.map((row) => row.user_id),
        )
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const));

  return {
    thresholds: {
      browse: MARKETPLACE_GATES.browse,
      message: MARKETPLACE_GATES.message,
      hire: MARKETPLACE_GATES.hire,
    },
    coaches: rows.map((row) => {
      const score = Number(row.performance_score);
      return {
        coachId: row.id,
        displayName: byId.get(row.user_id)?.display_name ?? "Coach",
        country: byId.get(row.user_id)?.country ?? null,
        city: byId.get(row.user_id)?.city ?? null,
        performanceScore: score,
        specializations: row.specializations ?? [],
        verified: row.verified_at !== null,
        canMessage: score >= MARKETPLACE_GATES.message,
        canHire: score >= MARKETPLACE_GATES.hire,
      };
    }),
  };
}

/* ----------------------------- Notifications ----------------------------- */

export async function loadNotifications(supabase: Client, userId: string) {
  const [listRes, prefRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    notifications: listRes.data ?? [],
    preferences: prefRes.data,
    unread: (listRes.data ?? []).filter((n) => n.read_at === null).length,
  };
}

export async function markNotificationsRead(
  supabase: Client,
  userId: string,
  ids: string[] | "all",
) {
  const now = new Date().toISOString();
  let query = supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null);

  if (ids !== "all") {
    if (ids.length === 0) return { updated: 0 };
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) throw structuredError("NOTIFICATION_UPDATE_FAILED", error.message);
  return { updated: ids === "all" ? -1 : ids.length };
}

export async function saveNotificationPreferences(
  supabase: Client,
  userId: string,
  input: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    mutedCategories: string[];
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  },
) {
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      in_app_enabled: input.inAppEnabled,
      email_enabled: input.emailEnabled,
      push_enabled: input.pushEnabled,
      muted_categories: input.mutedCategories,
      quiet_hours_start: input.quietHoursStart,
      quiet_hours_end: input.quietHoursEnd,
    },
    { onConflict: "user_id" },
  );
  if (error) throw structuredError("PREFERENCES_SAVE_FAILED", error.message);
  return { ok: true };
}

/* -------------------------- Profile and settings -------------------------- */

export async function loadAccount(supabase: Client, userId: string) {
  const [profile, prefs, notifPrefs, athlete, coach, roles] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athletes").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("coaches").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  return {
    profile: profile.data,
    preferences: prefs.data,
    notificationPreferences: notifPrefs.data,
    athlete: athlete.data,
    coach: coach.data,
    roles: (roles.data ?? []).map((r) => r.role),
  };
}

export async function saveProfile(
  supabase: Client,
  userId: string,
  input: { displayName: string; country: string | null; city: string | null },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      country: input.country,
      city: input.city,
    })
    .eq("id", userId);
  if (error) throw structuredError("PROFILE_SAVE_FAILED", error.message);
  return { ok: true };
}

export async function saveUserPreferences(
  supabase: Client,
  userId: string,
  input: {
    locale: string;
    timezone: string;
    units: string;
    deviceTierPreference: string | null;
    reducedMotion: boolean;
  },
) {
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      locale: input.locale,
      timezone: input.timezone,
      units: input.units,
      device_tier_preference: input.deviceTierPreference,
      reduced_motion: input.reducedMotion,
    },
    { onConflict: "user_id" },
  );
  if (error) throw structuredError("PREFERENCES_SAVE_FAILED", error.message);
  return { ok: true };
}

export async function saveCoachProfile(
  supabase: Client,
  userId: string,
  input: { specializations: string[] },
) {
  const { error } = await supabase
    .from("coaches")
    .update({ specializations: input.specializations })
    .eq("user_id", userId);
  if (error) throw structuredError("COACH_SAVE_FAILED", error.message);
  return { ok: true };
}

/* ------------------------------ Evaluation ------------------------------- */

export async function loadEvaluation(supabase: Client, _userId: string, evaluationId: string) {
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(
      "id, status, escalation_level, escalation_due_at, overall_score, rank, anonymous_hash, queued_at, completed_at, challenge_id, criteria_version_id, programs(id, title, summary, submitted_at), evaluation_results(dimension, weight, score, confidence, reasoning)",
    )
    .eq("id", evaluationId)
    .maybeSingle();

  if (!evaluation)
    throw structuredError(
      "EVALUATION_NOT_FOUND",
      "This evaluation is not visible to you.",
      "warning",
    );

  return { evaluation };
}

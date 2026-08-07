/**
 * Profile module — server-only read/write helpers.
 *
 * ARCHITECTURE 4.2: routes and components never touch the database; they go
 * through the typed RPC surface in profile.functions.ts, which delegates here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { structuredError } from "@/lib/sciencefit.server";
import { MARKETPLACE_GATES } from "@/lib/domain";

type Client = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface Certification {
  name: string;
  issuer: string;
  year: number | null;
}

function parseCertifications(value: unknown): Certification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const name = typeof row["name"] === "string" ? row["name"] : null;
    if (!name) return [];
    return [
      {
        name,
        issuer: typeof row["issuer"] === "string" ? row["issuer"] : "",
        year: typeof row["year"] === "number" ? row["year"] : null,
      },
    ];
  });
}

/** Everything the signed-in user needs to render and edit their own profile. */
export async function loadMyProfile(supabase: Client, userId: string) {
  const [profileRes, athleteRes, coachRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("athletes").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("coaches").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const coach = coachRes.data;
  const athlete = athleteRes.data;

  const [historyRes, programsRes, logsRes, requestsRes] = await Promise.all([
    coach
      ? supabase
          .from("coach_performance_scores")
          .select("*")
          .eq("coach_id", coach.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    coach
      ? supabase
          .from("programs")
          .select("id, submitted_at, evaluations(id, status, overall_score, rank, completed_at)")
          .eq("coach_id", coach.id)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as never[] }),
    athlete
      ? supabase
          .from("workout_logs")
          .select("id, completed, session_date, duration_minutes")
          .eq("athlete_id", athlete.id)
          .order("session_date", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as never[] }),
    athlete
      ? supabase
          .from("athlete_requests")
          .select("id, state, created_at")
          .eq("athlete_id", athlete.id)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const programs = (programsRes.data ?? []) as Array<{
    id: string;
    submitted_at: string | null;
    evaluations:
      | Array<{ status: string; overall_score: number | null; rank: number | null }>
      | { status: string; overall_score: number | null; rank: number | null }
      | null;
  }>;

  const evaluations = programs.flatMap((p) =>
    p.evaluations === null
      ? []
      : Array.isArray(p.evaluations)
        ? p.evaluations
        : [p.evaluations],
  );
  const completed = evaluations.filter((e) => e.status === "COMPLETED");
  const wins = completed.filter((e) => e.rank === 1).length;
  const averageScore =
    completed.length === 0
      ? null
      : Number(
          (
            completed.reduce((sum, e) => sum + Number(e.overall_score ?? 0), 0) /
            completed.length
          ).toFixed(1),
        );

  const logs = (logsRes.data ?? []) as Array<{
    completed: boolean;
    duration_minutes: number | null;
  }>;

  return {
    profile: profileRes.data,
    athlete,
    coach: coach
      ? { ...coach, certifications: parseCertifications(coach.certifications) }
      : null,
    roles: (rolesRes.data ?? []).map((r) => r.role),
    performanceHistory: historyRes.data ?? [],
    coachStats: {
      submissions: programs.filter((p) => p.submitted_at !== null).length,
      evaluated: completed.length,
      wins,
      averageScore,
      successRate:
        completed.length === 0
          ? 0
          : Number(((wins / completed.length) * 100).toFixed(1)),
    },
    athleteStats: {
      requests: (requestsRes.data ?? []).length,
      sessionsLogged: logs.length,
      sessionsCompleted: logs.filter((l) => l.completed).length,
      minutesTrained: logs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0),
    },
  };
}

export async function saveProfileDetails(
  supabase: Client,
  userId: string,
  input: {
    displayName: string;
    country: string | null;
    city: string | null;
    headline: string | null;
    bio: string | null;
    avatarUrl: string | null;
  },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      country: input.country,
      city: input.city,
      headline: input.headline,
      bio: input.bio,
      avatar_url: input.avatarUrl,
    })
    .eq("id", userId);
  if (error) throw structuredError("PROFILE_SAVE_FAILED", error.message);
  return { ok: true };
}

export async function savePrivacy(
  supabase: Client,
  userId: string,
  input: { profileVisibility: "public" | "private"; showLocation: boolean },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      profile_visibility: input.profileVisibility,
      show_location: input.showLocation,
    })
    .eq("id", userId);
  if (error) throw structuredError("PRIVACY_SAVE_FAILED", error.message);
  return { ok: true };
}

export async function saveAthleteProfile(
  supabase: Client,
  userId: string,
  input: { sports: string[]; primaryGoal: string | null },
) {
  const { error } = await supabase
    .from("athletes")
    .update({ sports: input.sports, primary_goal: input.primaryGoal })
    .eq("user_id", userId);
  if (error) throw structuredError("ATHLETE_SAVE_FAILED", error.message);
  return { ok: true };
}

export async function saveCoachCredentials(
  supabase: Client,
  userId: string,
  input: {
    specializations: string[];
    sports: string[];
    experienceYears: number;
    certifications: Certification[];
    bio: string | null;
    marketplaceEnabled: boolean;
  },
) {
  const { error } = await supabase
    .from("coaches")
    .update({
      specializations: input.specializations,
      sports: input.sports,
      experience_years: input.experienceYears,
      certifications: input.certifications as never,
      bio: input.bio,
      marketplace_enabled: input.marketplaceEnabled,
    })
    .eq("user_id", userId);
  if (error) throw structuredError("COACH_SAVE_FAILED", error.message);
  return { ok: true };
}

/**
 * Public coach profile. Only coaches who opted into the marketplace, cleared
 * the browse gate (BUSINESS_PROTOCOL 13) and kept their profile public are
 * visible. Nothing that could identify an anonymous submission is returned.
 */
export async function loadPublicCoachProfile(coachId: string) {
  const db = await admin();
  const { data: coach } = await db
    .from("coaches")
    .select(
      "id, user_id, performance_score, specializations, sports, experience_years, certifications, bio, verified_at, marketplace_enabled, state",
    )
    .eq("id", coachId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!coach || !coach.marketplace_enabled)
    throw structuredError(
      "COACH_NOT_PUBLIC",
      "This coach is not listed in the marketplace.",
      "warning",
    );

  const score = coach.performance_score === null ? null : Number(coach.performance_score);
  if ((score ?? -1) < MARKETPLACE_GATES.browse)
    throw structuredError(
      "COACH_NOT_PUBLIC",
      "This coach is not listed in the marketplace.",
      "warning",
    );

  const { data: profile } = await db
    .from("profiles")
    .select("display_name, country, city, headline, bio, avatar_url, profile_visibility, show_location")
    .eq("id", coach.user_id)
    .maybeSingle();

  if (!profile || profile.profile_visibility !== "public")
    throw structuredError(
      "COACH_NOT_PUBLIC",
      "This coach keeps their profile private.",
      "warning",
    );

  const { data: history } = await db
    .from("coach_performance_scores")
    .select("performance_score, submissions_counted, created_at")
    .eq("coach_id", coach.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return {
    coachId: coach.id,
    displayName: profile.display_name,
    headline: profile.headline,
    bio: profile.bio ?? coach.bio,
    avatarUrl: profile.avatar_url,
    country: profile.show_location ? profile.country : null,
    city: profile.show_location ? profile.city : null,
    performanceScore: score,
    specializations: coach.specializations ?? [],
    sports: coach.sports ?? [],
    experienceYears: coach.experience_years,
    certifications: parseCertifications(coach.certifications),
    verified: coach.verified_at !== null,
    canMessage: (score ?? -1) >= MARKETPLACE_GATES.message,
    canHire: (score ?? -1) >= MARKETPLACE_GATES.hire,
    history: (history ?? []).map((row) => ({
      score: Number(row.performance_score),
      submissionsCounted: row.submissions_counted,
      createdAt: row.created_at,
    })),
  };
}

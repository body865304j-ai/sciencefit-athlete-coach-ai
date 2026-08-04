import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AthleteRequestInput, ProgramDraftInput } from "@/lib/schemas";
import type { EvaluationEngineResult } from "@/lib/schemas";
import { DIMENSION_WEIGHTS } from "@/lib/domain";
import {
  anonymousHash,
  rankWithTieBreakers,
  structuredError,
  validateAthleteRequest,
  PLACEHOLDER_CHALLENGE_WINDOW_DAYS,
} from "@/lib/sciencefit.server";

type Client = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isAdmin(supabase: Client, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  return Boolean(data);
}

async function isMedicalReviewer(supabase: Client, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "medical_reviewer",
  });
  return Boolean(data);
}

/* ------------------------------ Users ------------------------------ */

export async function loadViewer(supabase: Client, userId: string) {
  const [profile, roles, athlete, coach] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("athletes").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("coaches").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    userId,
    profile: profile.data,
    roles: (roles.data ?? []).map((r) => r.role),
    athlete: athlete.data,
    coach: coach.data,
  };
}

export async function assignRole(userId: string, role: "athlete" | "coach") {
  const db = await admin();
  await db.from("user_roles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id,role" },
  );

  if (role === "athlete") {
    await db
      .from("athletes")
      .upsert({ user_id: userId, state: "ACTIVE" }, { onConflict: "user_id" });
  } else {
    // A new coach starts at PENDING_VERIFICATION per the Coach Lifecycle.
    await db.from("coaches").upsert(
      { user_id: userId, state: "PENDING_VERIFICATION" },
      { onConflict: "user_id" },
    );
  }
  return { ok: true };
}

/* ------------------- Request Lifecycle steps 1-4 ------------------- */

export async function submitAthleteRequest(
  supabase: Client,
  userId: string,
  input: AthleteRequestInput,
) {
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!athlete) throw structuredError("ATHLETE_NOT_FOUND", "No athlete profile.");

  const db = await admin();

  // Step 1: Athlete Creates Request
  const { data: request, error } = await db
    .from("athlete_requests")
    .insert({
      athlete_id: athlete.id,
      goal: input.goal,
      experience_level: input.experienceLevel,
      training_days: input.trainingDays,
      session_minutes: input.sessionMinutes,
      equipment: input.equipment,
      injury_notes: input.injuryNotes ?? null,
      clinical_flag: input.clinicalFlag,
      state: "AI_VALIDATING",
    })
    .select("id")
    .single();

  if (error || !request)
    throw structuredError("REQUEST_CREATE_FAILED", error?.message ?? "Unknown");

  await db
    .from("athletes")
    .update({ state: "REQUEST_PENDING" })
    .eq("id", athlete.id);

  // Step 2: AI Validates Request (integration seam - see sciencefit.server.ts)
  const outcome = await validateAthleteRequest();

  await db
    .from("athlete_requests")
    .update({
      state: outcome.valid ? "VALID" : "REJECTED",
      validation_notes: { notes: outcome.notes },
    })
    .eq("id", request.id);

  if (!outcome.valid) {
    await db.from("athletes").update({ state: "ACTIVE" }).eq("id", athlete.id);
    return { requestId: request.id, challengeId: null, notes: outcome.notes };
  }

  await db.from("athletes").update({ state: "VALID" }).eq("id", athlete.id);

  // Step 3: Challenge Creation - one Request generates exactly one Challenge.
  const { data: criteria } = await db
    .from("evaluation_criteria_versions")
    .select("id")
    .eq("active", true)
    .maybeSingle();

  if (!criteria)
    throw structuredError("NO_ACTIVE_CRITERIA", "No active criteria version.");

  const deadline = new Date(
    Date.now() + PLACEHOLDER_CHALLENGE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: challenge, error: challengeError } = await db
    .from("challenges")
    .insert({
      request_id: request.id,
      athlete_id: athlete.id,
      state: "PUBLISHED",
      opened_at: new Date().toISOString(),
      deadline_at: deadline,
      criteria_version_id: criteria.id,
    })
    .select("id")
    .single();

  if (challengeError || !challenge)
    throw structuredError(
      "CHALLENGE_CREATE_FAILED",
      challengeError?.message ?? "Unknown",
    );

  // Step 4: Coach Invitation.
  // TODO: Governance gap - the coach matching algorithm (how coaches are
  // selected and ranked for a challenge) is defined in the Business Protocol,
  // which was not provided. Every eligible coach is invited as a placeholder.
  // Requires clarification from Product Team.
  const { data: eligible } = await db
    .from("coaches")
    .select("id")
    .in("state", ["VERIFIED", "QUALIFIED", "ACTIVE"])
    .is("deleted_at", null);

  if (eligible && eligible.length > 0) {
    await db.from("challenge_coach_matches").insert(
      eligible.map((c) => ({ challenge_id: challenge.id, coach_id: c.id })),
    );
  }

  await db
    .from("challenges")
    .update({ state: "ACTIVE" })
    .eq("id", challenge.id);
  await db
    .from("athletes")
    .update({ state: "CHALLENGE_ACTIVE" })
    .eq("id", athlete.id);

  return {
    requestId: request.id,
    challengeId: challenge.id,
    notes: outcome.notes,
  };
}

export async function loadAthleteRequests(supabase: Client, userId: string) {
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (!athlete) return { athlete: null, requests: [] };

  const { data: requests } = await supabase
    .from("athlete_requests")
    .select("*, challenges(id, state, deadline_at, completed_at)")
    .eq("athlete_id", athlete.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return { athlete, requests: requests ?? [] };
}

/* --------------------------- Coach side --------------------------- */

export async function loadCoachInvitations(supabase: Client, userId: string) {
  const { data: coach } = await supabase
    .from("coaches")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!coach) return { coach: null, invitations: [] };

  const { data: matches } = await supabase
    .from("challenge_coach_matches")
    .select("id, status, challenge_id, challenges(id, state, deadline_at)")
    .eq("coach_id", coach.id)
    .order("invited_at", { ascending: false });

  return { coach, invitations: matches ?? [] };
}

/**
 * Returns the challenge brief. The athlete's identity is never exposed to a
 * coach: only the training brief fields are projected.
 */
export async function loadChallenge(
  supabase: Client,
  userId: string,
  challengeId: string,
) {
  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge)
    throw structuredError("CHALLENGE_NOT_FOUND", "Challenge not visible.", "warning");

  const db = await admin();
  const { data: brief } = await db
    .from("athlete_requests")
    .select(
      "goal, experience_level, training_days, session_minutes, equipment, injury_notes, clinical_flag",
    )
    .eq("id", challenge.request_id)
    .maybeSingle();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, state")
    .eq("user_id", userId)
    .maybeSingle();

  let myProgram = null;
  if (coach) {
    const { data } = await supabase
      .from("programs")
      .select("*, program_weeks(*, program_days(*, program_exercises(*)))")
      .eq("challenge_id", challengeId)
      .eq("coach_id", coach.id)
      .maybeSingle();
    myProgram = data;
  }

  const { count: submissionCount } = await db
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .not("submitted_at", "is", null);

  return { challenge, brief, coach, myProgram, submissionCount: submissionCount ?? 0 };
}

/* ------------- Step 5-6: Program Development and Submission ------------- */

export async function persistProgramDraft(
  supabase: Client,
  userId: string,
  input: ProgramDraftInput,
  submit: boolean,
) {
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (!coach) throw structuredError("COACH_NOT_FOUND", "No coach profile.");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, state, deadline_at")
    .eq("id", input.challengeId)
    .maybeSingle();
  if (!challenge)
    throw structuredError("CHALLENGE_NOT_FOUND", "Challenge not visible.");

  // Deadline enforcement is immutable and absolute.
  if (Date.parse(challenge.deadline_at) <= Date.now())
    throw structuredError("CHALLENGE_DEADLINE_PASSED", "The deadline has passed.");
  if (challenge.state !== "ACTIVE" && challenge.state !== "PUBLISHED")
    throw structuredError("CHALLENGE_NOT_OPEN", "This challenge is closed.");

  const db = await admin();

  const { data: existing } = await db
    .from("programs")
    .select("id, locked_at, submitted_at, version")
    .eq("challenge_id", challenge.id)
    .eq("coach_id", coach.id)
    .maybeSingle();

  if (existing?.locked_at)
    throw structuredError("PROGRAM_LOCKED", "This submission is locked.");

  let programId = existing?.id;

  if (programId) {
    await db
      .from("programs")
      .update({
        title: input.title,
        summary: input.summary,
        version: (existing?.version ?? 1) + 1,
        submitted_at: submit ? new Date().toISOString() : existing?.submitted_at ?? null,
      })
      .eq("id", programId);
    await db.from("program_weeks").delete().eq("program_id", programId);
  } else {
    const { data: created, error } = await db
      .from("programs")
      .insert({
        challenge_id: challenge.id,
        coach_id: coach.id,
        title: input.title,
        summary: input.summary,
        submitted_at: submit ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !created)
      throw structuredError("PROGRAM_SAVE_FAILED", error?.message ?? "Unknown");
    programId = created.id;
  }

  for (const week of input.weeks) {
    const { data: weekRow } = await db
      .from("program_weeks")
      .insert({
        program_id: programId,
        week_number: week.weekNumber,
        focus: week.focus,
      })
      .select("id")
      .single();
    if (!weekRow) continue;

    for (const day of week.days) {
      const { data: dayRow } = await db
        .from("program_days")
        .insert({
          week_id: weekRow.id,
          day_number: day.dayNumber,
          title: day.title,
          notes: day.notes,
        })
        .select("id")
        .single();
      if (!dayRow) continue;

      if (day.exercises.length > 0) {
        await db.from("program_exercises").insert(
          day.exercises.map((exercise, index) => ({
            day_id: dayRow.id,
            position: index,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            load_note: exercise.loadNote,
            rest_note: exercise.restNote,
            coaching_cue: exercise.coachingCue,
          })),
        );
      }
    }
  }

  if (submit) {
    await db
      .from("challenge_coach_matches")
      .update({ status: "SUBMITTED", responded_at: new Date().toISOString() })
      .eq("challenge_id", challenge.id)
      .eq("coach_id", coach.id);
    await db.from("coaches").update({ state: "SUBMITTED" }).eq("id", coach.id);
  } else if (coach.state !== "SUBMITTED") {
    await db.from("coaches").update({ state: "PROGRAMMING" }).eq("id", coach.id);
  }

  return { programId, submitted: submit };
}

/* ------------- Step 6-7: Submission Lock and evaluation queue ------------- */

export async function lockAndQueue(
  supabase: Client,
  userId: string,
  challengeId: string,
) {
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, state, deadline_at, anonymity_salt, criteria_version_id")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge)
    throw structuredError("CHALLENGE_NOT_FOUND", "Challenge not visible.");

  const deadlinePassed = Date.parse(challenge.deadline_at) <= Date.now();
  if (!deadlinePassed && !(await isAdmin(supabase, userId)))
    throw structuredError(
      "CHALLENGE_DEADLINE_NOT_REACHED",
      "The submission window is still open.",
      "warning",
    );

  if (challenge.state === "EVALUATING" || challenge.state === "COMPLETED")
    return { challengeId, queued: 0, alreadyLocked: true };

  const db = await admin();
  const lockedAt = new Date().toISOString();

  await db
    .from("challenges")
    .update({ state: "LOCKED", locked_at: lockedAt })
    .eq("id", challengeId);

  const { data: programs } = await db
    .from("programs")
    .select("id, coach_id")
    .eq("challenge_id", challengeId)
    .not("submitted_at", "is", null)
    .is("locked_at", null);

  let queued = 0;
  for (const program of programs ?? []) {
    // Anonymity enforcement before anything is queued for evaluation.
    const hash = await anonymousHash(challenge.anonymity_salt, program.coach_id);
    await db
      .from("programs")
      .update({ locked_at: lockedAt, anonymous_hash: hash })
      .eq("id", program.id);

    const { error } = await db.from("evaluations").insert({
      program_id: program.id,
      challenge_id: challengeId,
      criteria_version_id: challenge.criteria_version_id,
      anonymous_hash: hash,
      status: "QUEUED",
    });
    if (!error) queued += 1;

    await db
      .from("coaches")
      .update({ state: "EVALUATION_PENDING" })
      .eq("id", program.coach_id);
  }

  await db.from("challenges").update({ state: "EVALUATING" }).eq("id", challengeId);

  // TODO: Governance gap - the evaluation job dispatch mechanism (queue name,
  // payload envelope, retry/backoff policy) is defined in the Architecture
  // document, which was not provided. Rows are persisted in QUEUED state and
  // await a worker. Requires clarification from Principal Backend Architect.

  return { challengeId, queued, alreadyLocked: false };
}

/* --------------------- Engine result ingestion --------------------- */

export async function recordEngineResult(
  supabase: Client,
  userId: string,
  result: EvaluationEngineResult,
) {
  if (!(await isAdmin(supabase, userId)))
    throw structuredError("FORBIDDEN", "Admin role required.", "warning");

  const db = await admin();

  const { data: evaluation } = await db
    .from("evaluations")
    .select("id, challenge_id, status")
    .eq("id", result.evaluationId)
    .maybeSingle();
  if (!evaluation)
    throw structuredError("EVALUATION_NOT_FOUND", "Unknown evaluation.");
  if (evaluation.status === "COMPLETED" || evaluation.status === "AUTO_REJECTED")
    throw structuredError("EVALUATION_IMMUTABLE", "Already finalised.");

  await db.from("evaluation_results").insert(
    result.dimensions.map((dimension) => ({
      evaluation_id: result.evaluationId,
      dimension: dimension.dimension,
      weight: DIMENSION_WEIGHTS[dimension.dimension],
      score: dimension.score,
      confidence: dimension.confidence,
      reasoning: dimension.reasoning,
    })),
  );

  await db
    .from("evaluations")
    .update({
      status: result.escalationLevel === "L1" ? "AUTO_REJECTED" : "COMPLETED",
      escalation_level: result.escalationLevel,
      overall_score: result.overallScore,
      completed_at: new Date().toISOString(),
    })
    .eq("id", result.evaluationId);

  // Step 8-9: once every queued evaluation is finalised, rank and deliver.
  const { data: siblings } = await db
    .from("evaluations")
    .select("id, status")
    .eq("challenge_id", evaluation.challenge_id);

  const allDone = (siblings ?? []).every(
    (row) => row.status === "COMPLETED" || row.status === "AUTO_REJECTED",
  );

  if (allDone) {
    const ranked = await computeRanking(evaluation.challenge_id);
    for (const row of ranked) {
      await db.from("evaluations").update({ rank: row.rank }).eq("id", row.id);
    }
    await db
      .from("challenges")
      .update({ state: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", evaluation.challenge_id);

    const { data: challenge } = await db
      .from("challenges")
      .select("athlete_id")
      .eq("id", evaluation.challenge_id)
      .maybeSingle();
    if (challenge) {
      await db
        .from("athletes")
        .update({ state: "PROGRAM_DELIVERED" })
        .eq("id", challenge.athlete_id);
    }
  }

  return { ok: true, finalised: allDone };
}

async function computeRanking(challengeId: string) {
  const db = await admin();
  const { data } = await db
    .from("evaluations")
    .select(
      "id, overall_score, status, programs(submitted_at), evaluation_results(dimension, score)",
    )
    .eq("challenge_id", challengeId);

  const rankable = (data ?? [])
    .filter((row) => row.status === "COMPLETED")
    .map((row) => {
      const results = row.evaluation_results ?? [];
      const find = (dimension: string) =>
        results.find((r) => r.dimension === dimension)?.score ?? null;
      return {
        id: row.id,
        overall_score: row.overall_score,
        submitted_at: row.programs?.submitted_at ?? null,
        safety: find("SAFETY"),
        personalization: find("PERSONALIZATION"),
      };
    });

  return rankWithTieBreakers(rankable);
}

export async function loadRankedResults(
  supabase: Client,
  userId: string,
  challengeId: string,
) {
  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge)
    throw structuredError("CHALLENGE_NOT_FOUND", "Challenge not visible.");

  const { data: evaluations } = await supabase
    .from("evaluations")
    .select(
      "id, status, escalation_level, overall_score, rank, anonymous_hash, programs(id, title, summary, submitted_at), evaluation_results(dimension, weight, score, confidence, reasoning)",
    )
    .eq("challenge_id", challengeId);

  const rows = (evaluations ?? []).map((row) => {
    const results = row.evaluation_results ?? [];
    const find = (dimension: string) =>
      results.find((r) => r.dimension === dimension)?.score ?? null;
    return {
      id: row.id,
      overall_score: row.overall_score,
      submitted_at: row.programs?.submitted_at ?? null,
      safety: find("SAFETY"),
      personalization: find("PERSONALIZATION"),
    };
  });

  const ranked = rankWithTieBreakers(rows);
  const byId = new Map(ranked.map((r) => [r.id, r]));

  return {
    challenge,
    results: (evaluations ?? [])
      .map((row) => ({
        ...row,
        rank: byId.get(row.id)?.rank ?? null,
        coWinner: byId.get(row.id)?.coWinner ?? false,
      }))
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
  };
}

/* ------------------------ Human oversight ------------------------ */

export async function loadOversightQueue(supabase: Client, userId: string) {
  const admin_ = await isAdmin(supabase, userId);
  const medical = await isMedicalReviewer(supabase, userId);
  if (!admin_ && !medical)
    throw structuredError("FORBIDDEN", "Oversight access required.", "warning");

  let query = supabase
    .from("evaluations")
    .select(
      "id, status, escalation_level, escalation_due_at, overall_score, anonymous_hash, challenge_id, queued_at",
    )
    .neq("escalation_level", "NONE")
    .order("queued_at", { ascending: true });

  // Attribute-based permission: medical reviewers only see L3/L4.
  if (!admin_) query = query.in("escalation_level", ["L3", "L4"]);

  const { data } = await query;
  return { canSeeAll: admin_, queue: data ?? [] };
}

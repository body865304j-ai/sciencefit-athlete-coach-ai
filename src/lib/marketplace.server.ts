/**
 * Marketplace module — server-only helpers.
 *
 * BUSINESS_PROTOCOL 13 gating is enforced here, on the server, in addition to
 * the RLS policies: browse >= 60, message >= 70, hire >= 75. There are no
 * premium tiers; the Performance Score is the only gate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { structuredError } from "@/lib/sciencefit.server";
import { MARKETPLACE_GATES } from "@/lib/domain";

type Client = SupabaseClient<Database>;
type HireStatus = Database["public"]["Enums"]["hire_status"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

import type { MarketplaceFilters } from "@/lib/marketplace-filters";
export type { MarketplaceFilters };

/** Coach discovery. Only public, marketplace-enabled coaches above the browse gate. */
export async function searchCoaches(filters: MarketplaceFilters) {
  const db = await admin();
  const minScore = Math.max(filters.minScore ?? 0, MARKETPLACE_GATES.browse);

  let query = db
    .from("coaches")
    .select(
      "id, user_id, performance_score, specializations, sports, experience_years, certifications, verified_at",
    )
    .eq("marketplace_enabled", true)
    .gte("performance_score", minScore)
    .is("deleted_at", null)
    .limit(100);

  if (filters.verifiedOnly) query = query.not("verified_at", "is", null);
  if (filters.specialization) query = query.contains("specializations", [filters.specialization]);
  if (filters.sport) query = query.contains("sports", [filters.sport]);

  query =
    filters.sort === "experience"
      ? query.order("experience_years", { ascending: false, nullsFirst: false })
      : query.order("performance_score", { ascending: false });

  const { data: coaches, error } = await query;
  if (error) throw structuredError("MARKETPLACE_SEARCH_FAILED", error.message);

  const rows = coaches ?? [];
  const { data: profiles } = rows.length
    ? await db
        .from("profiles")
        .select(
          "id, display_name, country, city, headline, avatar_url, profile_visibility, show_location",
        )
        .in(
          "id",
          rows.map((r) => r.user_id),
        )
    : { data: [] as never[] };

  const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const));
  const term = (filters.query ?? "").trim().toLowerCase();

  const listings = rows
    .flatMap((row) => {
      const profile = byId.get(row.user_id);
      if (!profile || profile.profile_visibility !== "public") return [];
      const score = Number(row.performance_score);
      return [
        {
          coachId: row.id,
          displayName: profile.display_name,
          headline: profile.headline,
          avatarUrl: profile.avatar_url,
          country: profile.show_location ? profile.country : null,
          city: profile.show_location ? profile.city : null,
          performanceScore: score,
          specializations: row.specializations ?? [],
          sports: row.sports ?? [],
          experienceYears: row.experience_years,
          certificationCount: Array.isArray(row.certifications) ? row.certifications.length : 0,
          verified: row.verified_at !== null,
          canMessage: score >= MARKETPLACE_GATES.message,
          canHire: score >= MARKETPLACE_GATES.hire,
        },
      ];
    })
    .filter((listing) => {
      if (!term) return true;
      const haystack = [
        listing.displayName,
        listing.headline ?? "",
        ...listing.specializations,
        ...listing.sports,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

  const facets = {
    specializations: [...new Set(listings.flatMap((l) => l.specializations))].sort(),
    sports: [...new Set(listings.flatMap((l) => l.sports))].sort(),
  };

  return {
    thresholds: { ...MARKETPLACE_GATES },
    facets,
    coaches: listings,
  };
}

async function requireAthlete(supabase: Client, userId: string) {
  const { data } = await supabase.from("athletes").select("id").eq("user_id", userId).maybeSingle();
  if (!data)
    throw structuredError(
      "ATHLETE_PROFILE_REQUIRED",
      "Only athletes can use the marketplace hiring flow.",
      "warning",
    );
  return data.id;
}

async function coachGate(coachId: string) {
  const db = await admin();
  const { data } = await db
    .from("coaches")
    .select("id, user_id, performance_score, marketplace_enabled")
    .eq("id", coachId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || !data.marketplace_enabled)
    throw structuredError("COACH_UNAVAILABLE", "This coach is not available.", "warning");
  return { ...data, score: data.performance_score === null ? -1 : Number(data.performance_score) };
}

/** Opens (or reuses) a conversation. Requires the coach to clear the message gate. */
export async function openConversation(supabase: Client, userId: string, coachId: string) {
  const athleteId = await requireAthlete(supabase, userId);
  const coach = await coachGate(coachId);
  if (coach.score < MARKETPLACE_GATES.message)
    throw structuredError(
      "MESSAGE_GATE_NOT_MET",
      `Messaging requires a Performance Score of at least ${MARKETPLACE_GATES.message}.`,
      "warning",
    );

  const db = await admin();
  const { data: existing } = await db
    .from("marketplace_conversations")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (existing) return { conversationId: existing.id };

  const { data, error } = await db
    .from("marketplace_conversations")
    .insert({ athlete_id: athleteId, coach_id: coachId })
    .select("id")
    .single();
  if (error) throw structuredError("CONVERSATION_CREATE_FAILED", error.message);
  return { conversationId: data.id };
}

export async function loadConversations(supabase: Client, userId: string) {
  const [athleteRes, coachRes] = await Promise.all([
    supabase.from("athletes").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("coaches").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  const { data: conversations } = await supabase
    .from("marketplace_conversations")
    .select("id, athlete_id, coach_id, last_message_at, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const rows = conversations ?? [];
  if (rows.length === 0) return { conversations: [] };

  const db = await admin();
  const [{ data: coaches }, { data: athletes }] = await Promise.all([
    db
      .from("coaches")
      .select("id, user_id")
      .in(
        "id",
        rows.map((r) => r.coach_id),
      ),
    db
      .from("athletes")
      .select("id, user_id")
      .in(
        "id",
        rows.map((r) => r.athlete_id),
      ),
  ]);
  const userIds = [
    ...(coaches ?? []).map((c) => c.user_id),
    ...(athletes ?? []).map((a) => a.user_id),
  ];
  const { data: profiles } = await db
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p] as const));
  const coachUser = new Map((coaches ?? []).map((c) => [c.id, c.user_id] as const));
  const athleteUser = new Map((athletes ?? []).map((a) => [a.id, a.user_id] as const));

  return {
    conversations: rows.map((row) => {
      const viewerIsAthlete = athleteRes.data?.id === row.athlete_id;
      const counterpartUserId = viewerIsAthlete
        ? coachUser.get(row.coach_id)
        : athleteUser.get(row.athlete_id);
      const profile = counterpartUserId ? profileById.get(counterpartUserId) : undefined;
      return {
        conversationId: row.id,
        coachId: row.coach_id,
        viewerRole: viewerIsAthlete ? ("athlete" as const) : ("coach" as const),
        counterpartName: profile?.display_name ?? "ScienceFit member",
        counterpartAvatarUrl: profile?.avatar_url ?? null,
        lastMessageAt: row.last_message_at,
      };
    }),
    viewerCoachId: coachRes.data?.id ?? null,
  };
}

export async function loadMessages(supabase: Client, conversationId: string) {
  const { data, error } = await supabase
    .from("marketplace_messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw structuredError("MESSAGES_LOAD_FAILED", error.message);
  return { messages: data ?? [] };
}

export async function sendMessage(
  supabase: Client,
  userId: string,
  input: { conversationId: string; body: string },
) {
  const { error } = await supabase.from("marketplace_messages").insert({
    conversation_id: input.conversationId,
    sender_id: userId,
    body: input.body,
  });
  if (error) throw structuredError("MESSAGE_SEND_FAILED", error.message);

  const db = await admin();
  await db
    .from("marketplace_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversationId);
  return { ok: true };
}

/** Athlete-initiated hire request. Requires the coach to clear the hire gate. */
export async function requestHire(
  supabase: Client,
  userId: string,
  input: { coachId: string; goal: string; note: string | null },
) {
  const athleteId = await requireAthlete(supabase, userId);
  const coach = await coachGate(input.coachId);
  if (coach.score < MARKETPLACE_GATES.hire)
    throw structuredError(
      "HIRE_GATE_NOT_MET",
      `Hiring requires a Performance Score of at least ${MARKETPLACE_GATES.hire}.`,
      "warning",
    );

  const db = await admin();
  const { data: open } = await db
    .from("marketplace_hires")
    .select("id, status")
    .eq("athlete_id", athleteId)
    .eq("coach_id", input.coachId)
    .in("status", ["REQUESTED", "ACCEPTED", "ACTIVE"])
    .maybeSingle();
  if (open)
    throw structuredError(
      "HIRE_ALREADY_OPEN",
      "You already have an open engagement with this coach.",
      "warning",
    );

  const { data, error } = await db
    .from("marketplace_hires")
    .insert({
      athlete_id: athleteId,
      coach_id: input.coachId,
      goal: input.goal,
      note: input.note,
      coach_score_at_request: coach.score,
      status: "REQUESTED",
    })
    .select("id")
    .single();
  if (error) throw structuredError("HIRE_REQUEST_FAILED", error.message);

  // TODO: Governance gap - BUSINESS_PROTOCOL defines no notification category
  // for marketplace hire events; in-app notification is intentionally omitted
  // rather than inventing a category. Requires clarification.
  const { recordEvent } = await import("@/lib/notifications.server");
  await recordEvent({
    actorId: userId,
    eventType: "marketplace.hire_requested",
    subjectType: "marketplace_hire",
    subjectId: data.id,
    payload: { coachId: input.coachId },
  });

  return { hireId: data.id };
}

export async function respondToHire(
  supabase: Client,
  userId: string,
  input: {
    hireId: string;
    status: Extract<HireStatus, "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "ACTIVE" | "COMPLETED">;
  },
) {
  const [{ data: athlete }, { data: coach }] = await Promise.all([
    supabase.from("athletes").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("coaches").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  const db = await admin();
  const { data: hire } = await db
    .from("marketplace_hires")
    .select("id, athlete_id, coach_id, status")
    .eq("id", input.hireId)
    .maybeSingle();
  if (!hire) throw structuredError("HIRE_NOT_FOUND", "Engagement not found.", "warning");

  const isCoach = coach?.id === hire.coach_id;
  const isAthlete = athlete?.id === hire.athlete_id;
  if (!isCoach && !isAthlete)
    throw structuredError("FORBIDDEN", "You are not part of this engagement.", "warning");

  const coachActions: HireStatus[] = ["ACCEPTED", "DECLINED", "ACTIVE", "COMPLETED"];
  const athleteActions: HireStatus[] = ["WITHDRAWN", "COMPLETED"];
  const allowed = isCoach ? coachActions : athleteActions;
  if (!allowed.includes(input.status))
    throw structuredError(
      "HIRE_TRANSITION_NOT_ALLOWED",
      "That action is not available for your role.",
      "warning",
    );

  const { error } = await db
    .from("marketplace_hires")
    .update({ status: input.status, responded_at: new Date().toISOString() })
    .eq("id", input.hireId);
  if (error) throw structuredError("HIRE_UPDATE_FAILED", error.message);
  return { ok: true, status: input.status };
}

export async function loadHires(supabase: Client, userId: string) {
  const { data: hires } = await supabase
    .from("marketplace_hires")
    .select(
      "id, athlete_id, coach_id, goal, note, status, created_at, responded_at, coach_score_at_request",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = hires ?? [];
  if (rows.length === 0) return { hires: [] };

  const db = await admin();
  const [{ data: coaches }, { data: athletes }] = await Promise.all([
    db
      .from("coaches")
      .select("id, user_id")
      .in(
        "id",
        rows.map((r) => r.coach_id),
      ),
    db
      .from("athletes")
      .select("id, user_id")
      .in(
        "id",
        rows.map((r) => r.athlete_id),
      ),
  ]);
  const { data: profiles } = await db
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", [
      ...(coaches ?? []).map((c) => c.user_id),
      ...(athletes ?? []).map((a) => a.user_id),
    ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p] as const));
  const coachUser = new Map((coaches ?? []).map((c) => [c.id, c.user_id] as const));
  const athleteUser = new Map((athletes ?? []).map((a) => [a.id, a.user_id] as const));

  const { data: myCoach } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    hires: rows.map((row) => {
      const viewerIsCoach = myCoach?.id === row.coach_id;
      const counterpartUserId = viewerIsCoach
        ? athleteUser.get(row.athlete_id)
        : coachUser.get(row.coach_id);
      const profile = counterpartUserId ? profileById.get(counterpartUserId) : undefined;
      return {
        hireId: row.id,
        coachId: row.coach_id,
        viewerRole: viewerIsCoach ? ("coach" as const) : ("athlete" as const),
        counterpartName: profile?.display_name ?? "ScienceFit member",
        counterpartAvatarUrl: profile?.avatar_url ?? null,
        goal: row.goal,
        note: row.note,
        status: row.status,
        scoreAtRequest:
          row.coach_score_at_request === null ? null : Number(row.coach_score_at_request),
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      };
    }),
  };
}

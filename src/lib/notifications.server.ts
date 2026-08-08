/**
 * Notifications module — server-only write path.
 *
 * ARCHITECTURE 4.2: the Notifications module is written to by other modules
 * through this orchestrator, never by direct cross-module table access.
 */

import type { NotificationCategory } from "@/lib/business";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface NotificationDraft {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  linkPath?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Delivers in-app notifications, honouring each recipient's preferences
 * (muted categories and the in-app channel switch).
 */
export async function notify(drafts: NotificationDraft[]) {
  if (drafts.length === 0) return { delivered: 0 };
  const db = await admin();

  const userIds = [...new Set(drafts.map((d) => d.userId))];
  const { data: preferences } = await db
    .from("notification_preferences")
    .select("user_id, in_app_enabled, muted_categories")
    .in("user_id", userIds);

  const byUser = new Map((preferences ?? []).map((p) => [p.user_id, p] as const));

  const rows = drafts
    .filter((draft) => {
      const pref = byUser.get(draft.userId);
      if (!pref) return true; // default preferences allow in-app delivery
      if (!pref.in_app_enabled) return false;
      return !(pref.muted_categories ?? []).includes(draft.category);
    })
    .map((draft) => ({
      user_id: draft.userId,
      category: draft.category,
      channel: "in_app",
      title: draft.title,
      body: draft.body,
      link_path: draft.linkPath ?? null,
      metadata: (draft.metadata ?? {}) as never,
      delivered_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { delivered: 0 };
  const { error } = await db.from("notifications").insert(rows);
  if (error) return { delivered: 0 };
  return { delivered: rows.length };
}

/** Resolves the auth user id behind an athlete row. */
export async function athleteUserId(athleteId: string) {
  const db = await admin();
  const { data } = await db.from("athletes").select("user_id").eq("id", athleteId).maybeSingle();
  return data?.user_id ?? null;
}

/** Resolves the auth user ids behind a set of coach rows. */
export async function coachUserIds(coachIds: string[]) {
  if (coachIds.length === 0) return new Map<string, string>();
  const db = await admin();
  const { data } = await db.from("coaches").select("id, user_id").in("id", coachIds);
  return new Map((data ?? []).map((row) => [row.id, row.user_id] as const));
}

/** Analytics module — append-only event stream (ARCHITECTURE 4.1). */
export async function recordEvent(input: {
  actorId: string | null;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
}) {
  const db = await admin();
  await db.from("events").insert({
    actor_id: input.actorId,
    event_type: input.eventType,
    subject_type: input.subjectType ?? null,
    subject_id: input.subjectId ?? null,
    payload: (input.payload ?? {}) as never,
  });
}

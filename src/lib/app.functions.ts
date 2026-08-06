import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uuid } from "@/lib/schemas";
import { NOTIFICATION_CATEGORIES } from "@/lib/business";

/** Typed RPC surface for the authenticated application shell and screens. */

export const getAthleteDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAthleteDashboard } = await import("@/lib/app.server");
    return loadAthleteDashboard(context.supabase, context.userId);
  });

export const getCoachDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCoachDashboard } = await import("@/lib/app.server");
    return loadCoachDashboard(context.supabase, context.userId);
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadLeaderboard } = await import("@/lib/app.server");
    return loadLeaderboard(context.supabase, context.userId);
  });

export const getMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMarketplace } = await import("@/lib/app.server");
    return loadMarketplace(context.supabase);
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadNotifications } = await import("@/lib/app.server");
    return loadNotifications(context.supabase, context.userId);
  });

const markReadInput = z.object({
  ids: z.union([z.literal("all"), z.array(uuid).max(200)]),
});

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => markReadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { markNotificationsRead: mark } = await import("@/lib/app.server");
    return mark(context.supabase, context.userId, data.ids);
  });

const notificationPreferencesInput = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  mutedCategories: z.array(z.enum(NOTIFICATION_CATEGORIES)).max(20),
  quietHoursStart: z.number().int().min(0).max(23).nullable(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable(),
});

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => notificationPreferencesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveNotificationPreferences } = await import("@/lib/app.server");
    return saveNotificationPreferences(context.supabase, context.userId, data);
  });

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAccount } = await import("@/lib/app.server");
    return loadAccount(context.supabase, context.userId);
  });

const profileInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  country: z.string().trim().max(60).nullable(),
  city: z.string().trim().max(60).nullable(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveProfile } = await import("@/lib/app.server");
    return saveProfile(context.supabase, context.userId, data);
  });

const userPreferencesInput = z.object({
  locale: z.string().trim().min(2).max(10),
  timezone: z.string().trim().min(1).max(64),
  units: z.enum(["metric", "imperial"]),
  deviceTierPreference: z.enum(["A", "B", "C"]).nullable(),
  reducedMotion: z.boolean(),
});

export const updateUserPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => userPreferencesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveUserPreferences } = await import("@/lib/app.server");
    return saveUserPreferences(context.supabase, context.userId, data);
  });

const coachProfileInput = z.object({
  specializations: z.array(z.string().trim().min(1).max(60)).max(12),
});

export const updateCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => coachProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveCoachProfile } = await import("@/lib/app.server");
    return saveCoachProfile(context.supabase, context.userId, data);
  });

export const getEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { evaluationId: string }) => ({
    evaluationId: uuid.parse(input.evaluationId),
  }))
  .handler(async ({ data, context }) => {
    const { loadEvaluation } = await import("@/lib/app.server");
    return loadEvaluation(context.supabase, context.userId, data.evaluationId);
  });

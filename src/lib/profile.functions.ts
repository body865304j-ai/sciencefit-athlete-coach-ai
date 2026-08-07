import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uuid } from "@/lib/schemas";

/** Typed RPC surface for the Profile and Marketplace modules. */

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyProfile } = await import("@/lib/profile.server");
    return loadMyProfile(context.supabase, context.userId);
  });

const profileDetailsInput = z.object({
  displayName: z.string().trim().min(2).max(80),
  country: z.string().trim().max(60).nullable(),
  city: z.string().trim().max(80).nullable(),
  headline: z.string().trim().max(140).nullable(),
  bio: z.string().trim().max(2000).nullable(),
  avatarUrl: z.string().trim().max(500).nullable(),
});

export const saveProfileDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileDetailsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveProfileDetails: save } = await import("@/lib/profile.server");
    return save(context.supabase, context.userId, data);
  });

const privacyInput = z.object({
  profileVisibility: z.enum(["public", "private"]),
  showLocation: z.boolean(),
});

export const savePrivacySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => privacyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { savePrivacy } = await import("@/lib/profile.server");
    return savePrivacy(context.supabase, context.userId, data);
  });

const athleteProfileInput = z.object({
  sports: z.array(z.string().trim().min(1).max(60)).max(20),
  primaryGoal: z.string().trim().max(200).nullable(),
});

export const saveAthleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => athleteProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveAthleteProfile: save } = await import("@/lib/profile.server");
    return save(context.supabase, context.userId, data);
  });

const coachCredentialsInput = z.object({
  specializations: z.array(z.string().trim().min(1).max(60)).max(20),
  sports: z.array(z.string().trim().min(1).max(60)).max(20),
  experienceYears: z.number().int().min(0).max(70),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        issuer: z.string().trim().max(120),
        year: z.number().int().min(1950).max(2100).nullable(),
      }),
    )
    .max(30),
  bio: z.string().trim().max(2000).nullable(),
  marketplaceEnabled: z.boolean(),
});

export const saveCoachCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => coachCredentialsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { saveCoachCredentials: save } = await import("@/lib/profile.server");
    return save(context.supabase, context.userId, data);
  });

export const getPublicCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ coachId: uuid }).parse(input))
  .handler(async ({ data }) => {
    const { loadPublicCoachProfile } = await import("@/lib/profile.server");
    return loadPublicCoachProfile(data.coachId);
  });

/* ------------------------------ Marketplace ------------------------------ */

const searchInput = z.object({
  query: z.string().trim().max(120).optional(),
  specialization: z.string().trim().max(60).optional(),
  sport: z.string().trim().max(60).optional(),
  minScore: z.number().min(0).max(100).optional(),
  verifiedOnly: z.boolean().optional(),
  sort: z.enum(["score", "experience"]).optional(),
});

export const searchCoaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ data }) => {
    const { searchCoaches: search } = await import("@/lib/marketplace.server");
    return search(data);
  });

export const openConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ coachId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { openConversation: open } = await import("@/lib/marketplace.server");
    return open(context.supabase, context.userId, data.coachId);
  });

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadConversations } = await import("@/lib/marketplace.server");
    return loadConversations(context.supabase, context.userId);
  });

export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadMessages } = await import("@/lib/marketplace.server");
    return loadMessages(context.supabase, data.conversationId);
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: uuid, body: z.string().trim().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendMessage: send } = await import("@/lib/marketplace.server");
    return send(context.supabase, context.userId, data);
  });

export const requestHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        coachId: uuid,
        goal: z.string().trim().min(3).max(200),
        note: z.string().trim().max(1000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requestHire: request } = await import("@/lib/marketplace.server");
    return request(context.supabase, context.userId, data);
  });

export const respondToHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        hireId: uuid,
        status: z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN", "ACTIVE", "COMPLETED"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { respondToHire: respond } = await import("@/lib/marketplace.server");
    return respond(context.supabase, context.userId, data);
  });

export const getHires = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadHires } = await import("@/lib/marketplace.server");
    return loadHires(context.supabase, context.userId);
  });

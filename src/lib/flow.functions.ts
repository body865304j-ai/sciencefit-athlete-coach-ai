import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  athleteRequestInput,
  programDraftInput,
  evaluationEngineResult,
  uuid,
} from "@/lib/schemas";

/**
 * Public API surface for the request -> challenge -> submission ->
 * evaluation -> ranked delivery flow.
 *
 * Cross-module reads go through these functions only; the frontend never
 * touches the database directly.
 */

export const getViewer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadViewer } = await import("@/lib/flow.server");
    return loadViewer(context.supabase, context.userId);
  });

export const chooseRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: "athlete" | "coach" }) => {
    if (input.role !== "athlete" && input.role !== "coach") {
      throw new Error("INVALID_ROLE");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assignRole } = await import("@/lib/flow.server");
    return assignRole(context.userId, data.role);
  });

/** Request Lifecycle steps 1-4. */
export const createRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => athleteRequestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { submitAthleteRequest } = await import("@/lib/flow.server");
    return submitAthleteRequest(context.supabase, context.userId, data);
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAthleteRequests } = await import("@/lib/flow.server");
    return loadAthleteRequests(context.supabase, context.userId);
  });

export const listCoachInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCoachInvitations } = await import("@/lib/flow.server");
    return loadCoachInvitations(context.supabase, context.userId);
  });

export const getChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string }) => ({
    challengeId: uuid.parse(input.challengeId),
  }))
  .handler(async ({ data, context }) => {
    const { loadChallenge } = await import("@/lib/flow.server");
    return loadChallenge(context.supabase, context.userId, data.challengeId);
  });

/** Request Lifecycle step 5: Program Development (draft save). */
export const saveProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => programDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { persistProgramDraft } = await import("@/lib/flow.server");
    return persistProgramDraft(context.supabase, context.userId, data, false);
  });

/** Request Lifecycle step 5 -> 6: submit (one submission per coach). */
export const submitProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => programDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { persistProgramDraft } = await import("@/lib/flow.server");
    return persistProgramDraft(context.supabase, context.userId, data, true);
  });

/** Request Lifecycle step 6-7: Submission Lock, then queue AI Evaluation. */
export const lockChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string }) => ({
    challengeId: uuid.parse(input.challengeId),
  }))
  .handler(async ({ data, context }) => {
    const { lockAndQueue } = await import("@/lib/flow.server");
    return lockAndQueue(context.supabase, context.userId, data.challengeId);
  });

/** Request Lifecycle steps 8-9: Ranking and Delivery. */
export const getChallengeResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string }) => ({
    challengeId: uuid.parse(input.challengeId),
  }))
  .handler(async ({ data, context }) => {
    const { loadRankedResults } = await import("@/lib/flow.server");
    return loadRankedResults(context.supabase, context.userId, data.challengeId);
  });

/** Human oversight queues (admin + medical reviewer). */
export const getOversightQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOversightQueue } = await import("@/lib/flow.server");
    return loadOversightQueue(context.supabase, context.userId);
  });

/**
 * Ingestion seam for the SEEv2 engine. Admin-authenticated for now.
 * TODO: Governance gap - the transport, signing scheme and retry contract for
 * engine callbacks are defined in the Architecture document, which was not
 * provided. Requires clarification from Principal Backend Architect.
 */
export const ingestEvaluationResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => evaluationEngineResult.parse(input))
  .handler(async ({ data, context }) => {
    const { recordEngineResult } = await import("@/lib/flow.server");
    return recordEngineResult(context.supabase, context.userId, data);
  });

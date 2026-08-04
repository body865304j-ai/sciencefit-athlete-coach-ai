import { z } from "zod";

/**
 * Zod schemas. Applied at every module boundary.
 * TODO: Governance gap - field-level constraints for the athlete Request
 * (allowed goals, experience levels, equipment vocabulary) are defined in the
 * Product Bible, which was not provided. The enumerations below are structural
 * placeholders. Requires clarification from Product Team.
 */

export const uuid = z.string().uuid();

export const athleteRequestInput = z.object({
  goal: z.string().trim().min(3).max(200),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  trainingDays: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(240),
  equipment: z.array(z.string().trim().min(1).max(60)).max(30),
  injuryNotes: z.string().trim().max(1000).optional().nullable(),
  clinicalFlag: z.boolean(),
});
export type AthleteRequestInput = z.infer<typeof athleteRequestInput>;

export const programExerciseInput = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(20).nullable(),
  reps: z.string().trim().max(40).nullable(),
  loadNote: z.string().trim().max(120).nullable(),
  restNote: z.string().trim().max(120).nullable(),
  coachingCue: z.string().trim().max(400).nullable(),
});

export const programDayInput = z.object({
  dayNumber: z.number().int().min(1).max(7),
  title: z.string().trim().max(120),
  notes: z.string().trim().max(1000).nullable(),
  exercises: z.array(programExerciseInput).max(30),
});

export const programWeekInput = z.object({
  weekNumber: z.number().int().min(1).max(52),
  focus: z.string().trim().max(200),
  days: z.array(programDayInput).max(7),
});

export const programDraftInput = z.object({
  challengeId: uuid,
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(4000),
  weeks: z.array(programWeekInput).min(1).max(52),
});
export type ProgramDraftInput = z.infer<typeof programDraftInput>;

/**
 * Output contract for the SEEv2 engine. The engine is the only producer of
 * these values; the platform validates its output against this schema
 * (Security Layer 7: output schema validation).
 */
export const evaluationDimensionResult = z.object({
  dimension: z.enum([
    "SAFETY",
    "GOAL_ALIGNMENT",
    "PERSONALIZATION",
    "PROGRAMMING_QUALITY",
    "SCIENTIFIC_CONSISTENCY",
    "PRACTICALITY",
    "COMMUNICATION_QUALITY",
  ]),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasoning: z.object({
    summary: z.string().min(1),
    attributions: z
      .array(
        z.object({
          programPath: z.string().min(1),
          note: z.string().min(1),
        }),
      )
      .default([]),
  }),
});

export const evaluationEngineResult = z.object({
  evaluationId: uuid,
  criteriaVersion: z.string().min(1),
  anonymousHash: z.string().min(1),
  // Aggregation is performed by the engine, never by this application.
  overallScore: z.number().min(0).max(100),
  escalationLevel: z.enum(["NONE", "L1", "L2", "L3", "L4", "L5"]),
  dimensions: z.array(evaluationDimensionResult).length(7),
});
export type EvaluationEngineResult = z.infer<typeof evaluationEngineResult>;

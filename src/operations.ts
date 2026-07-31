import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { operation } from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import {
  CommandErrorSchema,
  EMPTY_LEARNING_SUMMARY,
  LearningSummaryOutputSchema,
  LearningProfilesOutputSchema,
  LearningJourneyOutputSchema,
  LearningRecordOutputSchema,
  LearningPatternsOutputSchema,
  PatternDetailOutputSchema,
  ReviewQueueOutputSchema,
  ReviewStateOutputSchema,
  PatternPresentationsOutputSchema,
  OptionalLanguageSchema,
  PatternSchema,
  QueryBaseSchema,
  ReviewAnswerSchema,
  ReviewCommandResultSchema,
} from "./application/dashboard-contracts"
import { defaultServices } from "./application/services"
import { LearningEventTypeSchema, PatternDisplayStatusSchema } from "./domain/types"
import { LanguageTagSchema, canonicalLanguageTag } from "./language"
import { configuredProfile, readSettings, type LearningProfile } from "./settings"

async function activeProfile(
  context: PluginInvocationContext,
  requested?: string,
): Promise<LearningProfile | undefined> {
  const current = configuredProfile(await readSettings(context))
  if (!requested) return current
  const targetLanguage = canonicalLanguageTag(requested)
  if (!targetLanguage) return undefined
  if (current?.targetLanguage === targetLanguage) return current
  const historical = defaultServices().learning
    .profileList()
    .find((profile) => profile.targetLanguage === targetLanguage)
  return historical
    ? {
        nativeLanguage: historical.nativeLanguage,
        targetLanguage: historical.targetLanguage,
        proficiency: historical.proficiency as LearningProfile["proficiency"],
      }
    : undefined
}

function scopeId(input: { scope?: "all" | "current" }, context: PluginInvocationContext) {
  return input.scope === "current" ? context.scopeId : undefined
}

async function publishSafely(
  context: PluginInvocationContext,
  eventId: string,
  payload: unknown,
): Promise<void> {
  try {
    await context.events.publish(eventId, payload)
  } catch (error) {
    context.log.debug("VibeLingo change event could not be published", {
      eventId,
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

const learningProfilesOperation = operation({
  id: "learning-profiles",
  type: "query",
  expose: ["ui"],
  input: z.object({}),
  output: LearningProfilesOutputSchema,
  async handler(_input, context) {
    const current = configuredProfile(await readSettings(context))
    return {
      current,
      profiles: defaultServices().learning.profileList(),
    }
  },
})

const learningSummaryOperation = operation({
  id: "learning-summary",
  type: "query",
  expose: ["ui"],
  input: QueryBaseSchema,
  output: LearningSummaryOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true, ...EMPTY_LEARNING_SUMMARY }
    return {
      setupRequired: false,
      targetLanguage: profile.targetLanguage,
      ...defaultServices().learning.learningSummary(profile.targetLanguage, {
        scopeId: scopeId(input, context),
        timeZone: input.timeZone,
      }),
    }
  },
})

const correctionStatusOperation = operation({
  id: "correction-status",
  type: "query",
  expose: ["ui"],
  input: z.object({ batchId: z.string().uuid() }),
  output: z.object({
    found: z.boolean(),
    status: z.enum(["pending", "queued", "analyzed", "recorded_only", "failed"]).optional(),
    patternKeys: z.array(z.string()),
  }),
  async handler(input) {
    const batch = defaultServices().corrections.byId(input.batchId)
    return batch
      ? {
          found: true,
          status: batch.status,
          patternKeys: [
            ...new Set(
              batch.corrections
                .filter((item) => item.accepted && item.patternKey)
                .map((item) => item.patternKey!),
            ),
          ],
        }
      : { found: false, patternKeys: [] }
  },
})

const learningJourneyOperation = operation({
  id: "learning-journey",
  type: "query",
  expose: ["ui"],
  input: QueryBaseSchema.extend({
    cursor: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    types: z.array(LearningEventTypeSchema).max(LearningEventTypeSchema.options.length).optional(),
    from: z.number().int().nonnegative().optional(),
    to: z.number().int().nonnegative().optional(),
  }).refine(
    (input) => input.from == null || input.to == null || input.from <= input.to,
    { message: "from must be earlier than or equal to to" },
  ),
  output: LearningJourneyOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true, items: [] }
    return defaultServices().learning.journey({
      targetLanguage: profile.targetLanguage,
      scopeId: scopeId(input, context),
      cursor: input.cursor,
      limit: input.limit,
      types: input.types,
      from: input.from,
      to: input.to,
    })
  },
})

const learningRecordOperation = operation({
  id: "learning-record",
  type: "query",
  expose: ["ui"],
  input: z.object({
    targetLanguage: OptionalLanguageSchema,
    eventId: z.string().uuid(),
  }),
  output: LearningRecordOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true }
    const services = defaultServices()
    const record = services.learning.learningRecord(profile.targetLanguage, input.eventId)
    if (!record) return { found: false }
    let sessionTitle: string | undefined
    let sourceSession:
      | {
          id: string
          title?: string
          category?: string
          createdAt?: number
          updatedAt?: number
          durationMs?: number
        }
      | undefined
    const eventScope = record.event.scopeId
    const sessionId = record.event.sessionId
    if (eventScope === context.scopeId && sessionId && context.session?.get) {
      try {
        const session = await context.session.get(sessionId)
        if (session && typeof session === "object") {
          sessionTitle = "title" in session && typeof session.title === "string"
            ? session.title
            : undefined
          const category = "category" in session && typeof session.category === "string"
            ? session.category
            : undefined
          const time = "time" in session && session.time && typeof session.time === "object"
            ? session.time as { created?: unknown; updated?: unknown }
            : undefined
          const createdAt = typeof time?.created === "number" ? time.created : undefined
          const updatedAt = typeof time?.updated === "number" ? time.updated : undefined
          sourceSession = {
            id: sessionId,
            title: sessionTitle,
            category,
            createdAt,
            updatedAt,
            durationMs: createdAt != null && updatedAt != null
              ? Math.max(0, updatedAt - createdAt)
              : undefined,
          }
        }
      } catch {
        // Current-Scope title resolution is optional and never affects learning data.
      }
    }
    return {
      found: true,
      ...record,
      review: record.event.reviewId
        ? services.reviews.state(record.event.reviewId)
        : undefined,
      sessionTitle,
      sessionTitleAvailable: Boolean(sessionTitle),
      sourceSession,
    }
  },
})

const learningPatternsOperation = operation({
  id: "learning-patterns",
  type: "query",
  expose: ["ui"],
  input: QueryBaseSchema.extend({
    status: z.union([
      PatternDisplayStatusSchema,
      z.literal("ignored"),
      z.literal("rejected"),
    ]).optional(),
    query: z.string().max(200).optional(),
    sort: z.enum(["priority", "recent", "frequency", "due"]).default("priority"),
    cursor: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  output: LearningPatternsOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true, items: [] }
    return defaultServices().learning.listPatterns({
      targetLanguage: profile.targetLanguage,
      scopeId: scopeId(input, context),
      status: input.status,
      query: input.query,
      sort: input.sort,
      cursor: input.cursor,
      limit: input.limit,
    })
  },
})

const learningPatternDetailOperation = operation({
  id: "learning-pattern-detail",
  type: "query",
  expose: ["ui"],
  input: QueryBaseSchema.extend({
    patternKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    days: z.number().int().min(1).max(365).default(30),
  }),
  output: PatternDetailOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) {
      return {
        setupRequired: true,
        found: false,
        evidenceTimeline: [],
        reviewHistory: [],
        trend: [],
        contexts: [],
      }
    }
    const learning = defaultServices().learning
    const currentScopeId = scopeId(input, context)
    const pattern = learning.patternDetail(
      profile.targetLanguage,
      input.patternKey,
      currentScopeId,
    )
    if (!pattern) {
      return {
        found: false,
        evidenceTimeline: [],
        reviewHistory: [],
        trend: [],
        contexts: [],
      }
    }
    return {
      found: true,
      pattern,
      evidenceTimeline: learning.patternEvidence(profile.targetLanguage, input.patternKey, {
        scopeId: currentScopeId,
      }),
      reviewHistory: learning.patternReviewHistory(
        profile.targetLanguage,
        input.patternKey,
        20,
        currentScopeId,
      ),
      trend: learning.patternTrend(profile.targetLanguage, input.patternKey, {
        scopeId: currentScopeId,
        timeZone: input.timeZone,
        days: input.days,
      }),
      contexts: learning.patternContexts(
        profile.targetLanguage,
        input.patternKey,
        currentScopeId,
      ),
    }
  },
})

const patternPresentationsOperation = operation({
  id: "pattern-presentations",
  type: "command",
  expose: ["ui"],
  input: z.object({
    targetLanguage: OptionalLanguageSchema,
    patternKeys: z.array(
      z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    ).min(1).max(20),
  }),
  output: PatternPresentationsOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { items: [] }
    const services = defaultServices()
    try {
      return {
        items: await services.presentationService.present(
          profile,
          input.patternKeys,
          context,
        ),
      }
    } catch (error) {
      context.log.debug("VibeLingo pattern presentation fell back to canonical metadata", {
        reason: error instanceof Error ? error.message : String(error),
      })
      return {
        items: services.learning
          .presentationSources(profile.targetLanguage, input.patternKeys)
          .map((source) => ({ ...source, source: "canonical_fallback" as const })),
      }
    }
  },
})

const reviewQueueOperation = operation({
  id: "review-queue",
  type: "query",
  expose: ["ui"],
  input: QueryBaseSchema.extend({
    limit: z.number().int().min(1).max(10).default(3),
  }),
  output: ReviewQueueOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true, due: [], upcoming: [] }
    return {
      due: defaultServices().learning.reviewQueue(profile.targetLanguage, input.limit),
      upcoming: defaultServices().learning.upcomingReviewQueue(
        profile.targetLanguage,
        input.limit,
      ),
      activeReview: defaultServices().reviews.openReview(profile.targetLanguage),
    }
  },
})

const reviewStateOperation = operation({
  id: "review-state",
  type: "query",
  expose: ["ui"],
  input: z.object({
    targetLanguage: OptionalLanguageSchema,
    reviewId: z.string().uuid().optional(),
  }),
  output: ReviewStateOutputSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return { setupRequired: true }
    const state = input.reviewId
      ? defaultServices().reviews.state(input.reviewId)
      : defaultServices().reviews.openReview(profile.targetLanguage)
    return {
      state: state?.targetLanguage === profile.targetLanguage ? state : undefined,
    }
  },
})

const reviewStartOperation = operation({
  id: "review-start",
  type: "command",
  expose: ["ui"],
  input: z.object({
    targetLanguage: OptionalLanguageSchema,
    patternKeys: z.array(z.string().regex(/^[a-z][a-z0-9_]{2,63}$/)).max(10).optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  output: ReviewCommandResultSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return {
      ok: false as const,
      error: { code: "SETUP_REQUIRED", retryable: false, message: "Complete VibeLingo setup first." },
    }
    const services = defaultServices()
    const existing = services.reviews.openReview(profile.targetLanguage)
    const result = await services.reviewService.start({
      profile,
      scopeId: context.scopeId,
      patternKeys: input.patternKeys,
      limit: input.limit,
    }, context)
    if (result.ok && !existing) {
      await publishSafely(context, "review.changed", {
        targetLanguage: profile.targetLanguage,
        reviewId: result.data.id,
        revision: result.revision,
        reason: "started",
      })
    }
    return result
  },
})

const ReviewCommandInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_answer"),
    targetLanguage: OptionalLanguageSchema,
    reviewId: z.string().uuid(),
    requestId: z.string().trim().min(1).max(100),
    expectedRevision: z.number().int().nonnegative(),
    answer: ReviewAnswerSchema,
  }),
  ...(["request_hint", "next_item", "pause", "resume", "abandon"] as const).map((action) =>
    z.object({
      action: z.literal(action),
      targetLanguage: OptionalLanguageSchema,
      reviewId: z.string().uuid(),
      requestId: z.string().trim().min(1).max(100),
      expectedRevision: z.number().int().nonnegative(),
    })
  ),
])

const reviewCommandOperation = operation({
  id: "review-command",
  type: "command",
  expose: ["ui"],
  input: ReviewCommandInputSchema,
  output: ReviewCommandResultSchema,
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return {
      ok: false as const,
      error: { code: "SETUP_REQUIRED" as const, retryable: false, message: "Complete VibeLingo setup first." },
    }
    const services = defaultServices()
    const before = services.reviews.state(input.reviewId)
    const previousResult = services.reviews.commandResult(input.reviewId, input.requestId)
    const result = await services.reviewService.command(input, profile, context)
    if (result.ok && !previousResult && result.revision !== before?.revision) {
      await publishSafely(context, "review.changed", {
        targetLanguage: profile.targetLanguage,
        reviewId: result.data.id,
        revision: result.revision,
        reason: input.action,
      })
      if (
        input.action === "submit_answer"
        || input.action === "abandon"
        || (input.action === "next_item" && result.data.status === "completed")
      ) {
        await publishSafely(context, "learning.changed", {
          targetLanguage: profile.targetLanguage,
          revision: services.learning.revision(profile.targetLanguage),
          reason: input.action,
        })
      }
    }
    return result
  },
})

const PatternCommandInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["ignore", "restore", "not_error", "delete"]),
    targetLanguage: OptionalLanguageSchema,
    patternKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  }),
  z.object({
    action: z.literal("merge"),
    targetLanguage: OptionalLanguageSchema,
    sourceKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    targetKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  }),
]).refine(
  (input) => input.action !== "merge" || input.sourceKey !== input.targetKey,
  { message: "sourceKey and targetKey must be different" },
)

const patternCommandOperation = operation({
  id: "pattern-command",
  type: "command",
  expose: ["ui"],
  input: PatternCommandInputSchema,
  output: z.union([
    z.object({
      ok: z.literal(true),
      revision: z.number().int().nonnegative(),
      data: PatternSchema.optional(),
    }),
    z.object({ ok: z.literal(false), error: CommandErrorSchema }),
  ]),
  async handler(input, context) {
    const profile = await activeProfile(context, input.targetLanguage)
    if (!profile) return {
      ok: false as const,
      error: {
        code: "SETUP_REQUIRED" as const,
        retryable: false,
        message: "Complete VibeLingo setup first.",
      },
    }
    const result = defaultServices().learning.patternCommand(profile.targetLanguage, input)
    if (!result) return {
      ok: false as const,
      error: { code: "NOT_FOUND" as const, retryable: false, message: "Learning pattern not found." },
    }
    await publishSafely(context, "learning.changed", {
      targetLanguage: profile.targetLanguage,
      revision: result.revision,
      reason: input.action,
    })
    return { ok: true as const, revision: result.revision, data: result.pattern }
  },
})

const ClearLearningDataInputSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("target"), targetLanguage: LanguageTagSchema }),
  z.object({ scope: z.literal("all") }),
])

const clearLearningDataOperation = operation({
  id: "clear-learning-data",
  type: "command",
  expose: ["ui"],
  input: ClearLearningDataInputSchema,
  output: z.union([
    z.object({
      ok: z.literal(true),
      revision: z.number().int().nonnegative(),
      data: z.object({
        deletedMessages: z.number().int().nonnegative(),
        deletedOccurrences: z.number().int().nonnegative(),
        deletedPatterns: z.number().int().nonnegative(),
        deletedReviews: z.number().int().nonnegative(),
        deletedEvents: z.number().int().nonnegative(),
        deletedTranslations: z.number().int().nonnegative(),
      }),
    }),
    z.object({ ok: z.literal(false), error: CommandErrorSchema }),
  ]),
  async handler(input, context) {
    const services = defaultServices()
    const clearInput = input.scope === "target"
      ? { ...input, targetLanguage: LanguageTagSchema.parse(input.targetLanguage) }
      : input
    const result = services.learning.clearLearningData(clearInput)
    services.translationService.clearMemory()
    if (clearInput.scope === "target") {
      await publishSafely(context, "learning.changed", {
        targetLanguage: clearInput.targetLanguage,
        revision: 0,
        reason: "cleared",
      })
    } else {
      await publishSafely(context, "learning.changed", {
        targetLanguage: "*",
        revision: 0,
        reason: "cleared",
      })
    }
    return { ok: true as const, revision: 0, data: result }
  },
})

export const dashboardOperations = [
  learningProfilesOperation,
  learningSummaryOperation,
  correctionStatusOperation,
  learningJourneyOperation,
  learningRecordOperation,
  learningPatternsOperation,
  learningPatternDetailOperation,
  patternPresentationsOperation,
  reviewQueueOperation,
  reviewStateOperation,
  reviewStartOperation,
  reviewCommandOperation,
  patternCommandOperation,
  clearLearningDataOperation,
]

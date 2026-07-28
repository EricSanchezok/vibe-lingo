import { z } from "zod"
import {
  EvidenceKindSchema,
  EvidenceOutcomeSchema,
  LearningEventTypeSchema,
  PatternDisplayStatusSchema,
  PatternDispositionSchema,
  PatternStageSchema,
  ReviewOutcomeSchema,
  ReviewSessionStatusSchema,
} from "../domain/types"
import { isValidTimeZone } from "../domain/time"
import { LanguageTagSchema } from "../language"

export const ScopeSchema = z.enum(["all", "current"]).default("all")
export const OptionalLanguageSchema = LanguageTagSchema.optional()
export const ReviewAnswerSchema = z.string().trim().min(1).refine(
  (value) => Array.from(value).length <= 300,
  "Review answers must contain at most 300 Unicode code points",
)
export const QueryBaseSchema = z.object({
  targetLanguage: OptionalLanguageSchema,
  scope: ScopeSchema,
  timeZone: z.string().min(1).max(100).refine(isValidTimeZone, "Invalid IANA timezone").optional(),
})

const TrendPointSchema = z.object({
  date: z.string(),
  targetAttempts: z.number().int().nonnegative(),
  findings: z.number().int().nonnegative(),
  naturalCorrectUses: z.number().int().nonnegative(),
  independentReviews: z.number().int().nonnegative(),
})

const ProgressExampleSchema = z.object({
  observedAt: z.number(),
  scopeId: z.string(),
  sessionId: z.string(),
  messageId: z.string().optional(),
  originalFragment: z.string().optional(),
  correctedFragment: z.string().optional(),
})

export const PatternSchema = z.object({
  patternKey: z.string(),
  category: z.string(),
  label: z.string(),
  rule: z.string(),
  occurrenceCount: z.number(),
  sessionCount: z.number(),
  lastSeenAt: z.number(),
  severity: z.string(),
  stage: PatternStageSchema,
  disposition: PatternDispositionSchema,
  displayStatus: PatternDisplayStatusSchema,
  dueAt: z.number().optional(),
  scheduleStep: z.number().int().min(0).max(4),
  lapseCount: z.number().int().nonnegative(),
  lastLapsedAt: z.number().optional(),
  naturalCorrectCount: z.number(),
  independentReviewCount: z.number(),
  firstSeenAt: z.number(),
  examples: z.array(ProgressExampleSchema),
})

export const JourneyEventSchema = z.object({
  id: z.string().uuid(),
  type: LearningEventTypeSchema,
  occurredAt: z.number(),
  scopeId: z.string().optional(),
  sessionId: z.string().optional(),
  messageId: z.string().optional(),
  patternKey: z.string().optional(),
  reviewId: z.string().optional(),
  reviewItemId: z.string().optional(),
})

export const LearningSummaryOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  targetLanguage: z.string().optional(),
  analyzedMessages: z.number().int().nonnegative(),
  findingsLast30Days: z.number().int().nonnegative(),
  totalPatternCount: z.number().int().nonnegative(),
  recurringPatternCount: z.number().int().nonnegative(),
  candidatePatternCount: z.number().int().nonnegative(),
  practicingPatternCount: z.number().int().nonnegative(),
  targetAttempts: z.number().int().nonnegative(),
  activeDays: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  duePatternCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  reviewRecallCountLast30Days: z.number().int().nonnegative(),
  independentRecallCountLast30Days: z.number().int().nonnegative(),
  successfulTransferCountLast30Days: z.number().int().nonnegative(),
  successfulTransferSessionCountLast30Days: z.number().int().nonnegative(),
  awaitingVerificationCount: z.number().int().nonnegative(),
  verifiedPatternCount: z.number().int().nonnegative(),
  currentStreakDays: z.number().int().nonnegative(),
  learningWeek: z.number().int().nonnegative(),
  recentNaturalUse: z.object({
    patternKey: z.string(),
    label: z.string(),
    fragment: z.string(),
    sessionCount: z.number().int().nonnegative(),
    observedAt: z.number(),
  }).optional(),
  trends: z.object({
    "7": z.array(TrendPointSchema),
    "30": z.array(TrendPointSchema),
    "90": z.array(TrendPointSchema),
  }),
})

export const EMPTY_LEARNING_SUMMARY = {
  analyzedMessages: 0,
  findingsLast30Days: 0,
  totalPatternCount: 0,
  recurringPatternCount: 0,
  candidatePatternCount: 0,
  practicingPatternCount: 0,
  targetAttempts: 0,
  activeDays: 0,
  sessionCount: 0,
  duePatternCount: 0,
  reviewCount: 0,
  reviewRecallCountLast30Days: 0,
  independentRecallCountLast30Days: 0,
  successfulTransferCountLast30Days: 0,
  successfulTransferSessionCountLast30Days: 0,
  awaitingVerificationCount: 0,
  verifiedPatternCount: 0,
  currentStreakDays: 0,
  learningWeek: 0,
  trends: { "7": [], "30": [], "90": [] },
}

export const PatternEvidenceSchema = z.object({
  id: z.string().uuid(),
  kind: EvidenceKindSchema,
  outcome: EvidenceOutcomeSchema,
  confidence: z.number().min(0).max(1),
  observedAt: z.number(),
  scopeId: z.string().optional(),
  sessionId: z.string().optional(),
  messageId: z.string().optional(),
  reviewItemId: z.string().optional(),
  originalFragment: z.string().optional(),
  correctedFragment: z.string().optional(),
})

export const PatternReviewHistorySchema = z.object({
  reviewId: z.string().uuid(),
  itemId: z.string().uuid(),
  status: ReviewSessionStatusSchema,
  outcome: ReviewOutcomeSchema.optional(),
  hintCount: z.number().int().nonnegative(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  challenge: z.string().optional(),
  referenceAnswer: z.string().optional(),
  transferChallenge: z.string().optional(),
  latestAnswer: z.string().optional(),
  latestFeedback: z.string().optional(),
})

export const PatternTrendSchema = z.object({
  date: z.string(),
  errors: z.number().int().nonnegative(),
  naturalCorrectUses: z.number().int().nonnegative(),
  independentReviews: z.number().int().nonnegative(),
})

export const ReviewQueueItemSchema = z.object({
  patternKey: z.string(),
  label: z.string(),
  rule: z.string(),
  severity: z.string(),
  dueAt: z.number(),
  overdueDays: z.number(),
  occurrenceCount: z.number(),
  lapseCount: z.number(),
})

export const ReviewStateSchema = z.object({
  id: z.string().uuid(),
  targetLanguage: z.string(),
  status: ReviewSessionStatusSchema,
  revision: z.number().int().nonnegative(),
  currentIndex: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  currentItem: z.object({
    id: z.string().uuid(),
    patternKey: z.string(),
    label: z.string(),
    stage: z.enum(["awaiting_response", "awaiting_repair", "awaiting_transfer", "item_completed"]),
    hintLevel: z.number().int().min(0).max(2),
    challenge: z.string().optional(),
    visibleHints: z.array(z.string()),
    explanation: z.string().optional(),
    referenceAnswer: z.string().optional(),
    transferChallenge: z.string().optional(),
    latestFeedback: z.string().optional(),
    latestNaturalAnswer: z.string().optional(),
    outcome: ReviewOutcomeSchema.optional(),
  }).optional(),
  completedItems: z.array(z.object({
    id: z.string().uuid(),
    patternKey: z.string(),
    label: z.string(),
    outcome: ReviewOutcomeSchema,
    hintCount: z.number().int().nonnegative(),
    dueAt: z.number().optional(),
    scheduleStep: z.number().int().min(0).max(4),
    completedAt: z.number(),
  })),
  summary: z.object({
    completedPatternCount: z.number().int().nonnegative(),
    independentRecallCount: z.number().int().nonnegative(),
    assistedPatternCount: z.number().int().nonnegative(),
    successfulTransferCount: z.number().int().nonnegative(),
  }),
  startedAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  completionEventId: z.string().uuid().optional(),
})

export const CommandErrorSchema = z.object({
  code: z.enum([
    "SETUP_REQUIRED",
    "INVALID_INPUT",
    "NOT_FOUND",
    "CONFLICT",
    "AGENT_UNAVAILABLE",
    "GENERATION_FAILED",
    "EVALUATION_FAILED",
  ]),
  retryable: z.boolean(),
  message: z.string(),
})

export const ReviewCommandResultSchema = z.union([
  z.object({ ok: z.literal(true), revision: z.number().int().nonnegative(), data: ReviewStateSchema }),
  z.object({ ok: z.literal(false), error: CommandErrorSchema }),
])

export const LearningProfilesOutputSchema = z.object({
  current: z.object({
    nativeLanguage: z.string(),
    targetLanguage: z.string(),
    proficiency: z.string(),
  }).optional(),
  profiles: z.array(z.object({
    nativeLanguage: z.string(),
    targetLanguage: z.string(),
    proficiency: z.string(),
    firstUsedAt: z.number(),
    lastUsedAt: z.number(),
  })),
})

export const LearningJourneyOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  items: z.array(JourneyEventSchema),
  nextCursor: z.string().optional(),
})

export const LearningPatternsOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  items: z.array(PatternSchema),
  nextCursor: z.string().optional(),
})

export const PatternDetailOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  found: z.boolean(),
  pattern: PatternSchema.optional(),
  evidenceTimeline: z.array(PatternEvidenceSchema),
  reviewHistory: z.array(PatternReviewHistorySchema),
  trend: z.array(PatternTrendSchema),
  contexts: z.array(z.object({
    scopeId: z.string(),
    sessionCount: z.number().int().nonnegative(),
    evidenceCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    naturalCorrectCount: z.number().int().nonnegative(),
    reviewCount: z.number().int().nonnegative(),
    lastSeenAt: z.number(),
  })),
})

export const ReviewQueueOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  due: z.array(ReviewQueueItemSchema),
  upcoming: z.array(ReviewQueueItemSchema),
  activeReview: ReviewStateSchema.optional(),
})

export const ReviewStateOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  state: ReviewStateSchema.optional(),
})

export const LearningRecordOutputSchema = z.object({
  setupRequired: z.boolean().optional(),
  found: z.boolean().optional(),
  event: JourneyEventSchema.optional(),
  pattern: PatternSchema.optional(),
  patterns: z.array(PatternSchema).optional(),
  evidence: z.array(PatternEvidenceSchema.extend({
    patternKey: z.string(),
    label: z.string(),
  })).optional(),
  review: ReviewStateSchema.optional(),
  sessionSummary: z.object({
    analyzedMessages: z.number().int().nonnegative(),
    targetAttempts: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
    demonstrations: z.number().int().nonnegative(),
    discoveredPatterns: z.number().int().nonnegative(),
    activityStartedAt: z.number().optional(),
    activityLastSeenAt: z.number().optional(),
  }).optional(),
  sessionTitle: z.string().optional(),
  sessionTitleAvailable: z.boolean().optional(),
  sourceSession: z.object({
    id: z.string(),
    title: z.string().optional(),
    category: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    durationMs: z.number().int().nonnegative().optional(),
  }).optional(),
})

export const PatternPresentationsOutputSchema = z.object({
  items: z.array(z.object({
    patternKey: z.string(),
    label: z.string(),
    rule: z.string(),
    source: z.enum(["localized", "canonical_fallback"]),
  })),
})

export type LearningProfilesOutput = z.infer<typeof LearningProfilesOutputSchema>
export type LearningSummaryOutput = z.infer<typeof LearningSummaryOutputSchema>
export type LearningJourneyOutput = z.infer<typeof LearningJourneyOutputSchema>
export type LearningRecordOutput = z.infer<typeof LearningRecordOutputSchema>
export type LearningPatternsOutput = z.infer<typeof LearningPatternsOutputSchema>
export type PatternDetailOutput = z.infer<typeof PatternDetailOutputSchema>
export type ReviewQueueOutput = z.infer<typeof ReviewQueueOutputSchema>
export type ReviewStateOutput = z.infer<typeof ReviewStateOutputSchema>
export type PatternPresentationsOutput = z.infer<typeof PatternPresentationsOutputSchema>

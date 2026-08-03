import { z } from "zod"

export const MAX_MESSAGE_CHARS = 4_000
export const MAX_FRAGMENT_CODEPOINTS = 160
export const MAX_REVIEW_ANSWER_CODEPOINTS = 300
export const MAX_STORED_EXAMPLES = 5
export const MIN_FINDING_CONFIDENCE = 0.85
export const MIN_DEMONSTRATION_CONFIDENCE = 0.9
export const DAY_MS = 86_400_000

export const ErrorCategorySchema = z.enum([
  "grammar",
  "word_choice",
  "collocation",
  "unnatural_phrasing",
  "spelling",
  "register",
])
export const ErrorSeveritySchema = z.enum(["meaning_affecting", "high_value", "minor"])
export const PatternStageSchema = z.enum(["candidate", "practicing", "verified"])
export const PatternDispositionSchema = z.enum(["active", "ignored", "rejected"])
export const PatternDisplayStatusSchema = z.enum(["new", "focus", "improving", "verified"])
export const EvidenceKindSchema = z.enum([
  "error",
  "natural_correct",
  "review_recall",
  "review_repair",
  "review_transfer",
])
export const EvidenceOutcomeSchema = z.enum(["incorrect", "assisted", "independent", "correct"])
export const LearningEventTypeSchema = z.enum([
  "practice_started",
  "correction_recorded",
  "pattern_discovered",
  "pattern_reviewable",
  "review_item_completed",
  "review_completed",
  "pattern_verified",
  "pattern_lapsed",
])
export const ReviewSessionStatusSchema = z.enum(["active", "paused", "completed", "abandoned"])
export const ReviewOutcomeSchema = z.enum(["failed", "assisted", "independent", "abandoned"])

export const CorrectionAnalysisItemSchema = z
  .object({
    correctionIndex: z.number().int().nonnegative(),
    accepted: z.boolean(),
    patternKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).optional(),
    category: ErrorCategorySchema.optional(),
    severity: ErrorSeveritySchema.optional(),
    label: z.string().min(1).max(80).optional(),
    rule: z.string().min(1).max(200).optional(),
    confidence: z.number().min(0).max(1),
    sensitive: z.boolean(),
  })
  .strict()

export const DemonstrationSchema = z
  .object({
    patternKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    fragment: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sensitive: z.boolean(),
  })
  .strict()

export const CorrectionAnalysisResultSchema = z
  .object({
    items: z.array(CorrectionAnalysisItemSchema).max(8),
  })
  .strict()

export const LanguageClassificationSchema = z
  .object({ isTargetLanguageAttempt: z.boolean() })
  .strict()

export const UsageAnalysisResultSchema = z
  .object({ demonstrations: z.array(DemonstrationSchema).max(2) })
  .strict()

export type ErrorCategory = z.infer<typeof ErrorCategorySchema>
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>
export type PatternStage = z.infer<typeof PatternStageSchema>
export type PatternDisposition = z.infer<typeof PatternDispositionSchema>
export type PatternDisplayStatus = z.infer<typeof PatternDisplayStatusSchema>
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>
export type EvidenceOutcome = z.infer<typeof EvidenceOutcomeSchema>
export type LearningEventType = z.infer<typeof LearningEventTypeSchema>
export type CorrectionAnalysisItem = z.infer<typeof CorrectionAnalysisItemSchema>
export type Demonstration = z.infer<typeof DemonstrationSchema>
export type CorrectionAnalysisResult = z.infer<typeof CorrectionAnalysisResultSchema>
export type UsageAnalysisResult = z.infer<typeof UsageAnalysisResultSchema>

export type MessageIdentity = {
  messageId: string
  scopeId: string
  sessionId: string
  observedAt: number
}

export const MessageReasonSchema = z.enum([
  "too_long",
  "mostly_code",
  "historical_unknown",
  "not_target_language",
  "target_attempt",
  "foreground_correction",
])
export type MessageReason = z.infer<typeof MessageReasonSchema>

export type StoredDemonstration = Omit<Demonstration, "fragment"> & {
  fragment?: string
}

export type KnownPattern = {
  patternKey: string
  canonicalKey: string
  category: ErrorCategory
  label: string
  rule: string
  stage: PatternStage
}

export type RecurringPattern = {
  patternKey: string
  category: ErrorCategory
  label: string
  rule: string
  occurrenceCount: number
  sessionCount: number
  lastSeenAt: number
  severity: ErrorSeverity
}

export type ProgressExample = {
  observedAt: number
  scopeId: string
  sessionId: string
  messageId?: string
  originalFragment?: string
  correctedFragment?: string
}

export type ProgressPattern = RecurringPattern & {
  stage: PatternStage
  disposition: PatternDisposition
  displayStatus: PatternDisplayStatus
  dueAt?: number
  scheduleStep: number
  lapseCount: number
  lastLapsedAt?: number
  naturalCorrectCount: number
  independentReviewCount: number
  firstSeenAt: number
  examples: ProgressExample[]
}

export type TrendPoint = {
  date: string
  targetAttempts: number
  findings: number
  naturalCorrectUses: number
  independentReviews: number
}

export type LearningSummary = {
  analyzedMessages: number
  analyzedMessagesToday: number
  findingsLast30Days: number
  targetAttemptsToday: number
  targetSessionsToday: number
  findingMessagesToday: number
  findingsToday: number
  correctionsToday: number
  acceptedFindingsToday: number
  correctionsAnalyzing: number
  correctionsFailed: number
  lastAnalyzedAt?: number
  totalPatternCount: number
  recurringPatternCount: number
  candidatePatternCount: number
  practicingPatternCount: number
  targetAttempts: number
  activeDays: number
  sessionCount: number
  duePatternCount: number
  reviewCount: number
  reviewRecallCountLast30Days: number
  independentRecallCountLast30Days: number
  successfulTransferCountLast30Days: number
  successfulTransferSessionCountLast30Days: number
  awaitingVerificationCount: number
  verifiedPatternCount: number
  currentStreakDays: number
  learningWeek: number
  recentNaturalUse?: {
    patternKey: string
    label: string
    fragment: string
    sessionCount: number
    observedAt: number
  }
  trends: Record<"7" | "30" | "90", TrendPoint[]>
}

export type ProgressSnapshot = {
  targetLanguage: string
  summary: LearningSummary
  patterns: ProgressPattern[]
}

export type ClearLearningDataResult = {
  deletedMessages: number
  deletedOccurrences: number
  deletedPatterns: number
  deletedReviews: number
  deletedEvents: number
  deletedTranslations: number
}

export type ReviewItemStage =
  | "awaiting_response"
  | "awaiting_repair"
  | "awaiting_transfer"
  | "item_completed"
export type ReviewSessionStatus = z.infer<typeof ReviewSessionStatusSchema>
export type ReviewVerdict = "incorrect" | "partially_correct" | "correct"
export type ReviewOutcome = z.infer<typeof ReviewOutcomeSchema>

export type ReviewContent = {
  challenge: string
  hintOne: string
  hintTwo: string
  explanation: string
  referenceAnswer: string
  transferChallenge: string
  rubric: string
}

export type ReviewEvaluation = {
  verdict: ReviewVerdict
  feedback: string
  naturalAnswer: string
  confidence: number
  sensitive: boolean
}

export type ReviewQueueItem = {
  patternKey: string
  label: string
  rule: string
  severity: ErrorSeverity
  dueAt: number
  overdueDays: number
  occurrenceCount: number
  lapseCount: number
}

export type ReviewStateItem = {
  id: string
  patternKey: string
  label: string
  stage: ReviewItemStage
  hintLevel: number
  challenge?: string
  visibleHints: string[]
  explanation?: string
  referenceAnswer?: string
  transferChallenge?: string
  latestAnswer?: string
  latestFeedback?: string
  latestNaturalAnswer?: string
  outcome?: ReviewOutcome
}

export type ReviewCompletedItem = {
  id: string
  patternKey: string
  label: string
  outcome: ReviewOutcome
  hintCount: number
  dueAt?: number
  scheduleStep: number
  completedAt: number
}

export type ReviewSummary = {
  completedPatternCount: number
  independentRecallCount: number
  assistedPatternCount: number
  successfulTransferCount: number
}

export type ReviewState = {
  id: string
  targetLanguage: string
  status: ReviewSessionStatus
  revision: number
  currentIndex: number
  totalItems: number
  currentItem?: ReviewStateItem
  completedItems: ReviewCompletedItem[]
  summary: ReviewSummary
  startedAt: number
  updatedAt: number
  completedAt?: number
  completionEventId?: string
}

export type CommandErrorCode =
  | "SETUP_REQUIRED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AGENT_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "EVALUATION_FAILED"

export type CommandResult<T> =
  | { ok: true; revision: number; data: T }
  | {
      ok: false
      error: {
        code: CommandErrorCode
        retryable: boolean
        message: string
      }
    }

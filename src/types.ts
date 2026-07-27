import { z } from "zod"

export const TARGET_LANGUAGE = "en"
export const MAX_MESSAGE_CHARS = 4_000
export const MAX_FRAGMENT_CODEPOINTS = 160
export const MAX_STORED_EXAMPLES = 5
export const MIN_CONFIDENCE = 0.85

export const ErrorCategorySchema = z.enum([
  "grammar",
  "word_choice",
  "collocation",
  "unnatural_phrasing",
  "spelling",
  "register",
])

export const ErrorSeveritySchema = z.enum(["meaning_affecting", "high_value", "minor"])

export const AnalysisFindingSchema = z
  .object({
    patternKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    category: ErrorCategorySchema,
    severity: ErrorSeveritySchema,
    label: z.string().min(1).max(80),
    rule: z.string().min(1).max(200),
    originalFragment: z.string().min(1),
    correctedFragment: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sensitive: z.boolean(),
  })
  .strict()

export const AnalysisResultSchema = z
  .object({
    isEnglishAttempt: z.boolean(),
    findings: z.array(AnalysisFindingSchema).max(2),
  })
  .strict()

export type ErrorCategory = z.infer<typeof ErrorCategorySchema>
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>
export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>

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

export type KnownPattern = {
  patternKey: string
  category: ErrorCategory
  label: string
  rule: string
}

export type ProgressExample = {
  observedAt: number
  scopeId: string
  sessionId: string
  messageId: string
  originalFragment?: string
  correctedFragment?: string
}

export type ProgressPattern = RecurringPattern & {
  firstSeenAt: number
  examples: ProgressExample[]
}

export type ProgressSnapshot = {
  analyzedMessages: number
  findingsLast30Days: number
  patterns: ProgressPattern[]
}

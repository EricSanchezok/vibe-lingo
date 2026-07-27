import { operation } from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import { LanguageTagSchema } from "./language"
import { defaultStore } from "./storage"

const LearningSummaryInputSchema = z.object({
  targetLanguage: LanguageTagSchema,
})

const LearningSummaryOutputSchema = z.object({
  analyzedMessages: z.number().int().nonnegative(),
  findingsLast30Days: z.number().int().nonnegative(),
  totalPatternCount: z.number().int().nonnegative(),
  recurringPatternCount: z.number().int().nonnegative(),
})

const ClearLearningDataInputSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("target"),
    targetLanguage: LanguageTagSchema,
  }),
  z.object({
    scope: z.literal("all"),
  }),
])

const ClearLearningDataOutputSchema = z.object({
  deletedMessages: z.number().int().nonnegative(),
  deletedOccurrences: z.number().int().nonnegative(),
  deletedPatterns: z.number().int().nonnegative(),
})

export const learningSummaryOperation = operation({
  id: "learning-summary",
  type: "query",
  expose: ["ui"],
  input: LearningSummaryInputSchema,
  output: LearningSummaryOutputSchema,
  async handler({ targetLanguage }) {
    return defaultStore().learningSummary(targetLanguage)
  },
})

export const clearLearningDataOperation = operation({
  id: "clear-learning-data",
  type: "command",
  expose: ["ui"],
  input: ClearLearningDataInputSchema,
  output: ClearLearningDataOutputSchema,
  async handler(input) {
    return defaultStore().clearLearningData(input)
  },
})

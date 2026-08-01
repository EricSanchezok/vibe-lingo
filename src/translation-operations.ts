import {
  operation,
  type PluginInvocationContext,
  type PluginTextSelectionSnapshot,
} from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import { defaultServices } from "./application/services"
import type { TranslationDestination, TranslationResult } from "./domain/translation"
import type { TranslationRow } from "./infrastructure/translation-repository"
import { canonicalLanguageTag } from "./language"
import { configuredProfile, modelRoleFor, readSettings } from "./settings"

type TranslateSelectionInput = {
  selection: PluginTextSelectionSnapshot
  destination?: TranslationDestination
  bypassCache?: boolean
}

type TranslationListInput = {
  targetLanguage?: string
  destinationLanguage?: string
  query?: string
  cursor?: string
  limit: number
}

type TranslationListItem = Omit<TranslationRow, "sourceHash" | "contractVersion">

type TranslationListOutput = {
  setupRequired: boolean
  items: TranslationListItem[]
  nextCursor?: string
}

type TranslationSummaryInput = { targetLanguage?: string }
type TranslationSummaryOutput = {
  setupRequired: boolean
  translations: number
  uses: number
  lastUsedAt?: number
}

type TranslationCommand =
  | { action: "delete"; translationId: string }
  | { action: "clear_target"; targetLanguage: string }
  | { action: "clear_all" }

type TranslationCommandOutput = {
  ok: boolean
  deletedTranslations: number
}

const SelectionSchema = z
  .object({
    selectionId: z.string().min(1).max(100),
    text: z
      .string()
      .min(1)
      .max(8_000)
      .refine((value) => [...value].length <= 4_000, "Selection must be at most 4,000 Unicode code points"),
    source: z.enum(["document", "code", "terminal"]),
    origin: z.enum(["user_message", "assistant_message", "editable", "other"]),
    editable: z.boolean(),
    wholeContainer: z.boolean(),
  })
  .strict()

const TranslationResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("translated"),
      translationId: z.string().uuid().optional(),
      sourceLanguage: z.string(),
      destinationLanguage: z.string(),
      translatedText: z.string(),
      cache: z.enum(["persistent_hit", "memory_hit", "miss"]),
      persistence: z.enum(["saved", "disabled", "privacy_excluded", "write_failed"]),
    })
    .strict(),
  z.object({ status: z.literal("setup_required") }).strict(),
  z
    .object({
      status: z.literal("not_translatable"),
      reason: z.string(),
    })
    .strict(),
])

async function publishChanged(context: PluginInvocationContext, targetLanguage: string, reason: string) {
  try {
    await context.events.publish("translation.changed", {
      targetLanguage,
      reason,
    })
  } catch {
    // SQLite is authoritative; live refresh is best effort.
  }
}

function canonicalOptional(value: string | undefined, field: string) {
  if (value === undefined) return undefined
  const canonical = canonicalLanguageTag(value)
  if (!canonical) throw new Error(`Invalid ${field}`)
  return canonical
}

export const translateSelectionOperation = operation<TranslateSelectionInput, TranslationResult>({
  id: "translate-selection",
  type: "command",
  expose: ["ui"],
  requires: ["settings.read", "agent.call"],
  input: z
    .object({
      selection: SelectionSchema,
      destination: z.enum(["adaptive", "native", "target"]).default("adaptive").optional(),
      bypassCache: z.boolean().default(false).optional(),
    })
    .strict(),
  output: TranslationResultSchema,
  async handler(input, context) {
    const settings = await readSettings(context)
    const profile = configuredProfile(settings)
    if (!profile) return { status: "setup_required" as const }
    const destination = input.destination ?? "adaptive"
    const bypassCache = input.bypassCache ?? false
    const result = await defaultServices().translationService.translate(
      {
        profile,
        selection: input.selection,
        destination,
        bypassCache,
        historyEnabled: settings.translationHistoryEnabled,
        modelRole: modelRoleFor(settings, "translation"),
      },
      context,
    )
    if (result.status === "translated" && result.persistence === "saved") {
      await publishChanged(context, profile.targetLanguage, "translated")
    }
    return result
  },
})

export const translationsListOperation = operation<TranslationListInput, TranslationListOutput>({
  id: "translations-list",
  type: "query",
  expose: ["ui"],
  input: z
    .object({
      targetLanguage: z.string().max(64).optional(),
      destinationLanguage: z.string().max(64).optional(),
      query: z.string().max(200).optional(),
      cursor: z.string().max(500).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    })
    .strict(),
  output: z.object({
    setupRequired: z.boolean(),
    items: z.array(
      z.object({
        id: z.string().uuid(),
        profileTargetLanguage: z.string(),
        nativeLanguage: z.string(),
        destinationPolicy: z.enum(["adaptive", "native", "target"]),
        detectedSourceLanguage: z.string(),
        destinationLanguage: z.string(),
        sourcePreview: z.string().optional(),
        sourceCharCount: z.number().int(),
        translatedText: z.string(),
        createdAt: z.number().int(),
        updatedAt: z.number().int(),
        lastUsedAt: z.number().int(),
        useCount: z.number().int(),
      }),
    ),
    nextCursor: z.string().optional(),
  }),
  async handler(input, context) {
    const settings = await readSettings(context)
    const profile = configuredProfile(settings)
    if (!profile) return { setupRequired: true, items: [] }
    const targetLanguage = canonicalOptional(input.targetLanguage, "target language") ?? profile.targetLanguage
    return {
      setupRequired: false,
      ...defaultServices().translations.list({
        profileTargetLanguage: targetLanguage,
        destinationLanguage: canonicalOptional(input.destinationLanguage, "destination language"),
        query: input.query,
        cursor: input.cursor,
        limit: input.limit,
      }),
    }
  },
})

export const translationSummaryOperation = operation<TranslationSummaryInput, TranslationSummaryOutput>({
  id: "translation-summary",
  type: "query",
  expose: ["ui"],
  input: z
    .object({
      targetLanguage: z.string().max(64).optional(),
    })
    .strict(),
  output: z.object({
    setupRequired: z.boolean(),
    translations: z.number().int().nonnegative(),
    uses: z.number().int().nonnegative(),
    lastUsedAt: z.number().int().optional(),
  }),
  async handler(input, context) {
    const profile = configuredProfile(await readSettings(context))
    if (!profile) return { setupRequired: true, translations: 0, uses: 0 }
    return {
      setupRequired: false,
      ...defaultServices().translations.summary(
        canonicalOptional(input.targetLanguage, "target language") ?? profile.targetLanguage,
      ),
    }
  },
})

const TranslationCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), translationId: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("clear_target"),
      targetLanguage: z.string().min(1).max(64),
    })
    .strict(),
  z.object({ action: z.literal("clear_all") }).strict(),
])

export const translationCommandOperation = operation<TranslationCommand, TranslationCommandOutput>({
  id: "translation-command",
  type: "command",
  expose: ["ui"],
  input: TranslationCommandSchema,
  output: z.object({
    ok: z.boolean(),
    deletedTranslations: z.number().int().nonnegative(),
  }),
  async handler(input, context) {
    const repository = defaultServices().translations
    let deletedTranslations = 0
    let targetLanguage = "*"
    if (input.action === "delete") {
      deletedTranslations = repository.delete(input.translationId) ? 1 : 0
    } else if (input.action === "clear_target") {
      const canonical = canonicalLanguageTag(input.targetLanguage)
      if (!canonical) throw new Error("Invalid target language")
      targetLanguage = canonical
      deletedTranslations = repository.clear({
        scope: "target",
        targetLanguage: canonical,
      }).deletedTranslations
    } else {
      deletedTranslations = repository.clear({
        scope: "all",
      }).deletedTranslations
    }
    defaultServices().translationService.clearMemory()
    if (deletedTranslations > 0) await publishChanged(context, targetLanguage, input.action)
    return { ok: true, deletedTranslations }
  },
})

export const translationOperations = [
  translateSelectionOperation,
  translationsListOperation,
  translationSummaryOperation,
  translationCommandOperation,
]

import {
  PLUGIN_MODEL_ROLES,
  type PluginInvocationContext,
  type PluginModelRole,
} from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import { OptionalLanguageTagSchema, canonicalLanguageTag } from "./language"

export const CorrectionModeSchema = z.enum(["focused", "strict", "off"])
export const ProficiencySchema = z.enum(["beginner", "intermediate", "advanced"])
export const ModelRoleSchema = z.enum(
  PLUGIN_MODEL_ROLES.filter((role) => role !== "vision") as [
    Exclude<PluginModelRole, "vision">,
    ...Array<Exclude<PluginModelRole, "vision">>,
  ],
)

export const VibeLingoSettingsSchema = z.object({
  nativeLanguage: OptionalLanguageTagSchema,
  targetLanguage: OptionalLanguageTagSchema,
  proficiency: ProficiencySchema.default("intermediate"),
  correctionMode: CorrectionModeSchema.default("focused"),
  naturalnessSuggestionsEnabled: z.boolean().default(true),
  trackingEnabled: z.boolean().default(true),
  recurringFocusEnabled: z.boolean().default(true),
  languageDetectionModelRole: ModelRoleSchema.default("nano"),
  learningAnalysisModelRole: ModelRoleSchema.default("mini"),
  translationModelRole: ModelRoleSchema.default("mini"),
  reviewModelRole: ModelRoleSchema.default("mini"),
  translationHistoryEnabled: z.boolean().default(true),
})

export type VibeLingoSettings = z.infer<typeof VibeLingoSettingsSchema>
export type LearningProfile = Pick<
  VibeLingoSettings,
  "nativeLanguage" | "targetLanguage" | "proficiency"
>

export const DEFAULT_SETTINGS: VibeLingoSettings = {
  nativeLanguage: "",
  targetLanguage: "",
  proficiency: "intermediate",
  correctionMode: "focused",
  naturalnessSuggestionsEnabled: true,
  trackingEnabled: true,
  recurringFocusEnabled: true,
  languageDetectionModelRole: "nano",
  learningAnalysisModelRole: "mini",
  translationModelRole: "mini",
  reviewModelRole: "mini",
  translationHistoryEnabled: true,
}

export type ModelWorkload =
  | "language_detection"
  | "learning_analysis"
  | "translation"
  | "review"

export function modelRoleFor(
  settings: VibeLingoSettings,
  workload: ModelWorkload,
): PluginModelRole {
  if (workload === "language_detection") return settings.languageDetectionModelRole
  if (workload === "learning_analysis") return settings.learningAnalysisModelRole
  if (workload === "translation") return settings.translationModelRole
  return settings.reviewModelRole
}

export async function modelRoleFromContext(
  context: PluginInvocationContext,
  workload: ModelWorkload,
): Promise<PluginModelRole> {
  return modelRoleFor(await readSettings(context), workload)
}

export function configuredProfile(settings: VibeLingoSettings): LearningProfile | undefined {
  const nativeLanguage = canonicalLanguageTag(settings.nativeLanguage)
  const targetLanguage = canonicalLanguageTag(settings.targetLanguage)
  if (!nativeLanguage || !targetLanguage || nativeLanguage === targetLanguage) return undefined
  return {
    nativeLanguage,
    targetLanguage,
    proficiency: settings.proficiency,
  }
}

export async function readSettings(context: PluginInvocationContext): Promise<VibeLingoSettings> {
  if (!context.settings?.get) throw new Error("VibeLingo settings are unavailable")
  const values = await context.settings.get()
  return VibeLingoSettingsSchema.parse(values)
}

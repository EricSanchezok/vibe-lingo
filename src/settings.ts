import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import { OptionalLanguageTagSchema, canonicalLanguageTag } from "./language"

export const CorrectionModeSchema = z.enum(["focused", "strict", "off"])
export const ProficiencySchema = z.enum(["beginner", "intermediate", "advanced"])

export const VibeLingoSettingsSchema = z.object({
  nativeLanguage: OptionalLanguageTagSchema,
  targetLanguage: OptionalLanguageTagSchema,
  proficiency: ProficiencySchema.default("intermediate"),
  correctionMode: CorrectionModeSchema.default("focused"),
  trackingEnabled: z.boolean().default(true),
  recurringFocusEnabled: z.boolean().default(true),
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
  trackingEnabled: true,
  recurringFocusEnabled: true,
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

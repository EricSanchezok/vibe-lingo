import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { defaultServices } from "./application/services"
import { canonicalLanguageTag, languageDisplayName } from "./language"
import { configuredProfile, readSettings } from "./settings"
import type { TranslationRow } from "./infrastructure/translation-repository"

export type TranslationHistoryInput = {
  language?: string
  query?: string
  limit?: number
}

function inlineText(value: string): string {
  return value.replace(/\s+/g, " ").replaceAll("`", "ˋ").trim()
}

function indentedBlock(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => `    ${line}`)
}

export function renderTranslationHistory(
  targetLanguage: string,
  items: TranslationRow[],
): string {
  if (items.length === 0) {
    return `No saved translations for ${languageDisplayName(targetLanguage, "en")}.`
  }
  return [
    `## Saved translations · ${languageDisplayName(targetLanguage, "en")}`,
    "",
    ...items.flatMap((item) => [
      `### ${languageDisplayName(item.detectedSourceLanguage, "en")} → ${languageDisplayName(item.destinationLanguage, "en")}`,
      `Source: ${inlineText(item.sourceText)}`,
      "Translation:",
      ...indentedBlock(item.translatedText),
      `Used ${item.useCount} time${item.useCount === 1 ? "" : "s"} · ${new Date(item.lastUsedAt).toISOString()}`,
      "",
    ]),
  ].join("\n")
}

export async function translationHistoryTool(
  input: TranslationHistoryInput,
  context: PluginInvocationContext,
) {
  const profile = configuredProfile(await readSettings(context))
  if (!profile)
    return "Complete VibeLingo setup before viewing translation history."
  const targetLanguage = input.language
    ? canonicalLanguageTag(input.language)
    : profile.targetLanguage
  if (!targetLanguage)
    return "The requested translation-history language tag is invalid."
  const list = defaultServices().translations.list({
    profileTargetLanguage: targetLanguage,
    query: input.query,
    limit: Math.min(10, Math.max(1, input.limit ?? 5)),
  })
  return renderTranslationHistory(targetLanguage, list.items)
}

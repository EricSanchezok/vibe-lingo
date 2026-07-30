import type {
  PluginModelRole,
  PluginTextSelectionSnapshot,
} from "@ericsanchezok/synergy-plugin"
import type { LearningProfile } from "../settings"

export const TRANSLATION_CONTRACT_VERSION = 1
export const MAX_TRANSLATION_CODEPOINTS = 8_000
export const MAX_TRANSLATION_SOURCE_CODEPOINTS = 4_000

export type TranslationDestination = "adaptive" | "native" | "target"
export type TranslationCache = "persistent_hit" | "memory_hit" | "miss"
export type TranslationPersistence =
  "saved" | "disabled" | "privacy_excluded" | "write_failed"

export type TranslationResult =
  | {
      status: "translated"
      translationId?: string
      sourceLanguage: string
      destinationLanguage: string
      translatedText: string
      cache: TranslationCache
      persistence: TranslationPersistence
    }
  | { status: "setup_required" }
  | { status: "not_translatable"; reason: string }

export type TranslateRequest = {
  profile: LearningProfile
  selection: PluginTextSelectionSnapshot
  destination: TranslationDestination
  bypassCache?: boolean
  historyEnabled: boolean
  modelRole: PluginModelRole
}

export type TranslationArtifact = {
  sourceLanguage: string
  destinationLanguage: string
  translatedText: string
  sensitive: boolean
}

export function normalizeTranslationSource(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").trim()
}

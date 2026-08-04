import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { containsSensitiveContent } from "../domain/privacy"
import { modelRoleFromContext, type LearningProfile } from "../settings"
import type { LearningRepository } from "../infrastructure/learning-repository"
import type {
  PatternPresentationRepository,
  PatternPresentationSource,
} from "../infrastructure/pattern-presentation-repository"
import {
  PATTERN_PRESENTER_AGENT_NAME,
  parsePatternPresentations,
} from "./presentation-contracts"
import { AGENT_CALL_TIMEOUT_MS } from "../agent-runtime"
import { modelLanguageDescriptor } from "./model-language"

export type PatternPresentation = PatternPresentationSource & {
  source: "localized" | "canonical_fallback"
}

function usesEnglish(language: string): boolean {
  try {
    return new Intl.Locale(language).language === "en"
  } catch {
    return false
  }
}

export class PatternPresentationService {
  constructor(
    readonly learning: LearningRepository,
    readonly presentations: PatternPresentationRepository,
  ) {}

  async present(
    profile: LearningProfile,
    patternKeys: string[],
    context: PluginInvocationContext,
  ): Promise<PatternPresentation[]> {
    const uniqueKeys = [...new Set(patternKeys)].slice(0, 20)
    const sources = this.learning.presentationSources(profile.targetLanguage, uniqueKeys)
    if (sources.length === 0) return []

    if (usesEnglish(profile.nativeLanguage)) {
      return sources.map((source) => ({ ...source, source: "canonical_fallback" }))
    }

    const cached = this.presentations.find(
      profile.targetLanguage,
      profile.nativeLanguage,
      sources,
    )
    const missing = sources.filter((source) => !cached.has(source.patternKey))
    if (missing.length > 0) {
      await this.generate(profile, missing, context).catch(() => undefined)
    }
    const refreshed = missing.length > 0
      ? this.presentations.find(profile.targetLanguage, profile.nativeLanguage, sources)
      : cached

    return sources.map((source) => {
      const localized = refreshed.get(source.patternKey)
      return localized
        ? {
            patternKey: source.patternKey,
            label: localized.label,
            rule: localized.rule,
            source: "localized" as const,
          }
        : { ...source, source: "canonical_fallback" as const }
    })
  }

  private async generate(
    profile: LearningProfile,
    sources: PatternPresentationSource[],
    context: PluginInvocationContext,
  ): Promise<void> {
    if (!context.agent?.call) return
    const response = await context.agent.call({
      agent: PATTERN_PRESENTER_AGENT_NAME,
      modelRole: await modelRoleFromContext(context, "review"),
      text: `Localize this JSON:\n${JSON.stringify({
        supportLanguage: modelLanguageDescriptor(profile.nativeLanguage),
        targetLanguage: modelLanguageDescriptor(profile.targetLanguage),
        patterns: sources,
      })}`,
      timeoutMs: AGENT_CALL_TIMEOUT_MS,
      maxOutputChars: 7_000,
    })
    const allowed = new Map(sources.map((source) => [source.patternKey, source]))
    const seen = new Set<string>()
    const values = parsePatternPresentations(response.text).items.flatMap((item) => {
      const source = allowed.get(item.patternKey)
      if (
        !source
        || seen.has(item.patternKey)
        || item.confidence < 0.9
        || containsSensitiveContent(item.label)
        || containsSensitiveContent(item.rule)
      ) return []
      seen.add(item.patternKey)
      return [{
        patternKey: item.patternKey,
        label: item.label,
        rule: item.rule,
        sourceLabel: source.label,
        sourceRule: source.rule,
      }]
    })
    this.presentations.save(
      profile.targetLanguage,
      profile.nativeLanguage,
      values,
    )
  }
}

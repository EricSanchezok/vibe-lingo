import { createHash } from "node:crypto"
import type {
  PluginInvocationContext,
  PluginModelRole,
} from "@ericsanchezok/synergy-plugin"
import {
  MAX_TRANSLATION_CODEPOINTS,
  MAX_TRANSLATION_SOURCE_CODEPOINTS,
  TRANSLATION_CONTRACT_VERSION,
  normalizeTranslationSource,
  type TranslateRequest,
  type TranslationArtifact,
  type TranslationResult,
} from "../domain/translation"
import {
  containsSensitiveContent,
  sanitizeFragment,
  truncateCodePoints,
} from "../domain/privacy"
import {
  canonicalLanguageTag,
  hasCompatibleTargetScript,
  languageDisplayName,
} from "../language"
import type { TranslationRepository } from "../infrastructure/translation-repository"

export const TRANSLATOR_AGENT_NAME = "vibe-lingo-translator"
export const TRANSLATOR_PROMPT = `You translate a selected passage for VibeLingo.
Return exactly one JSON object and no markdown or explanation.
For a translation, return {"translation":"...","sourceLanguage":"<BCP-47 tag>"}.
If there is no translatable natural language, return {"translation":null,"sourceLanguage":null}.
Use exactly these two keys. Preserve meaning, tone, formatting, code identifiers, and uncertainty.`

type Dependencies = {
  now?: () => number
  callTranslator?: (
    prompt: string,
    modelRole: PluginModelRole,
    context: PluginInvocationContext,
  ) => Promise<string>
}

type MemoryEntry = {
  artifact: TranslationArtifact
  expiresAt: number
  persistence: "disabled" | "privacy_excluded" | "write_failed" | "saved"
}

class InvalidTranslatorOutputError extends Error {
  constructor() {
    super("The translation response was incomplete.")
    this.name = "InvalidTranslatorOutputError"
  }
}

function languageBase(tag: string) {
  try {
    return new Intl.Locale(tag).language
  } catch {
    return tag.toLowerCase()
  }
}

export class TranslationService {
  readonly #memory = new Map<string, MemoryEntry>()
  readonly #inflight = new Map<
    string,
    Promise<TranslationArtifact | { reason: string }>
  >()
  readonly #now: () => number
  readonly #callTranslator: NonNullable<Dependencies["callTranslator"]>

  constructor(
    private readonly repository: TranslationRepository,
    dependencies: Dependencies = {},
  ) {
    this.#now = dependencies.now ?? Date.now
    this.#callTranslator =
      dependencies.callTranslator ??
      ((prompt, modelRole, context) =>
        context
          .agent!.call({
            agent: TRANSLATOR_AGENT_NAME,
            text: prompt,
            modelRole,
            timeoutMs: 15_000,
            maxOutputChars: MAX_TRANSLATION_CODEPOINTS + 1_000,
          })
          .then((result) => result.text))
  }

  clearMemory(): void {
    this.#memory.clear()
    this.#inflight.clear()
  }

  private identity(request: TranslateRequest, normalized: string) {
    const sourceHash = createHash("sha256")
      .update(
        [
          normalized,
          request.profile.nativeLanguage,
          request.profile.targetLanguage,
          request.destination,
          String(TRANSLATION_CONTRACT_VERSION),
        ].join("\u0000"),
      )
      .digest("hex")
    return {
      profileTargetLanguage: request.profile.targetLanguage,
      nativeLanguage: request.profile.nativeLanguage,
      destinationPolicy: request.destination,
      sourceHash,
      contractVersion: TRANSLATION_CONTRACT_VERSION,
    }
  }

  private prompt(request: TranslateRequest, normalized: string) {
    return JSON.stringify({
      task: "translate_selection",
      nativeLanguage: {
        tag: request.profile.nativeLanguage,
        name: languageDisplayName(request.profile.nativeLanguage, "en"),
      },
      targetLanguage: {
        tag: request.profile.targetLanguage,
        name: languageDisplayName(request.profile.targetLanguage, "en"),
      },
      destinationPolicy: request.destination,
      rules: {
        adaptive:
          "If source is target language, translate to native language; otherwise translate to target language.",
        native: "Translate to native language.",
        target: "Translate to target language.",
      },
      output: {
        translation:
          "translated text, or null when there is no natural language",
        sourceLanguage: "detected BCP-47 source-language tag, or null",
      },
      selection: normalized,
    })
  }

  private repairPrompt(
    request: TranslateRequest,
    normalized: string,
    invalidOutput: string,
  ) {
    return JSON.stringify({
      task: "repair_translation_output",
      instruction:
        'Translate the selection and return exactly {"translation":"...","sourceLanguage":"<BCP-47 tag>"}. Return both values as null only when there is no translatable natural language. Do not use status, translatedText, destinationLanguage, markdown, or any other keys.',
      nativeLanguage: request.profile.nativeLanguage,
      targetLanguage: request.profile.targetLanguage,
      destinationPolicy: request.destination,
      previousInvalidOutput: truncateCodePoints(invalidOutput, 600),
      selection: normalized,
    })
  }

  private jsonObject(text: string): Record<string, unknown> {
    const trimmed = text.trim()
    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()
    const candidates = [unfenced]
    const start = unfenced.indexOf("{")
    const end = unfenced.lastIndexOf("}")
    if (start >= 0 && end > start)
      candidates.push(unfenced.slice(start, end + 1))
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // A bounded repair call handles malformed output.
      }
    }
    throw new InvalidTranslatorOutputError()
  }

  private sourceLanguageHint(request: TranslateRequest, normalized: string) {
    const nativeMatch = hasCompatibleTargetScript(
      normalized,
      request.profile.nativeLanguage,
    )
    const targetMatch = hasCompatibleTargetScript(
      normalized,
      request.profile.targetLanguage,
    )
    if (nativeMatch && !targetMatch) return request.profile.nativeLanguage
    if (targetMatch && !nativeMatch) return request.profile.targetLanguage
    return undefined
  }

  private canonicalSourceLanguage(
    request: TranslateRequest,
    value: unknown,
    normalized: string,
  ) {
    if (typeof value === "string") {
      const canonical = canonicalLanguageTag(value)
      if (canonical) return canonical
      const normalizedName = value.trim().toLocaleLowerCase("en")
      for (const tag of [
        request.profile.nativeLanguage,
        request.profile.targetLanguage,
      ]) {
        if (
          languageDisplayName(tag, "en").toLocaleLowerCase("en") ===
          normalizedName
        ) {
          return tag
        }
      }
    }
    return this.sourceLanguageHint(request, normalized)
  }

  private parse(
    request: TranslateRequest,
    normalized: string,
    text: string,
  ): TranslationArtifact | { reason: string } {
    const value = this.jsonObject(text)
    const translation =
      value.translation ?? value.translatedText ?? value.translated_text ?? null
    if (
      value.status === "not_translatable" ||
      (translation === null &&
        (value.sourceLanguage === null ||
          value.detectedSourceLanguage === null ||
          value.detected_source_language === null))
    ) {
      return {
        reason: "The selection contains no translatable natural language.",
      }
    }
    if (typeof translation !== "string" || !translation.trim()) {
      throw new InvalidTranslatorOutputError()
    }
    const sourceLanguage = this.canonicalSourceLanguage(
      request,
      value.sourceLanguage ??
        value.detectedSourceLanguage ??
        value.detectedLanguage ??
        value.detected_source_language,
      normalized,
    )
    if (!sourceLanguage) throw new InvalidTranslatorOutputError()
    const expected =
      request.destination === "native"
        ? request.profile.nativeLanguage
        : request.destination === "target"
          ? request.profile.targetLanguage
          : languageBase(sourceLanguage) ===
              languageBase(request.profile.targetLanguage)
            ? request.profile.nativeLanguage
            : request.profile.targetLanguage
    const destinationLanguage = expected
    if (
      !translation.trim() ||
      [...translation].length > MAX_TRANSLATION_CODEPOINTS
    ) {
      throw new InvalidTranslatorOutputError()
    }
    return {
      sourceLanguage,
      destinationLanguage,
      translatedText: truncateCodePoints(
        translation,
        MAX_TRANSLATION_CODEPOINTS,
      ),
      sensitive: containsSensitiveContent(translation),
    }
  }

  private async generate(
    request: TranslateRequest,
    normalized: string,
    context: PluginInvocationContext,
  ) {
    const initial = await this.#callTranslator(
      this.prompt(request, normalized),
      request.modelRole,
      context,
    )
    try {
      return this.parse(request, normalized, initial)
    } catch (error) {
      if (!(error instanceof InvalidTranslatorOutputError)) throw error
    }
    const repaired = await this.#callTranslator(
      this.repairPrompt(request, normalized, initial),
      request.modelRole,
      context,
    )
    try {
      return this.parse(request, normalized, repaired)
    } catch {
      throw new InvalidTranslatorOutputError()
    }
  }

  private memoryGet(key: string) {
    const entry = this.#memory.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.#now()) {
      this.#memory.delete(key)
      return undefined
    }
    this.#memory.delete(key)
    this.#memory.set(key, entry)
    return entry
  }

  private memorySet(key: string, entry: MemoryEntry) {
    this.#memory.delete(key)
    this.#memory.set(key, entry)
    while (this.#memory.size > 100)
      this.#memory.delete(this.#memory.keys().next().value!)
  }

  async translate(
    request: TranslateRequest,
    context: PluginInvocationContext,
  ): Promise<TranslationResult> {
    const normalized = normalizeTranslationSource(request.selection.text)
    if (
      !normalized ||
      [...normalized].length > MAX_TRANSLATION_SOURCE_CODEPOINTS
    ) {
      return {
        status: "not_translatable",
        reason: "The selection is empty or too long.",
      }
    }
    const identity = this.identity(request, normalized)
    const key = identity.sourceHash
    const now = this.#now()

    if (!request.bypassCache) {
      let persistent: ReturnType<TranslationRepository["find"]>
      try {
        persistent = this.repository.find(identity)
      } catch (error) {
        context.log.debug("VibeLingo translation cache read failed", {
          reason: error instanceof Error ? error.message : String(error),
        })
      }
      if (persistent) {
        let persistence: "saved" | "write_failed" = "saved"
        if (request.historyEnabled) {
          try {
            this.repository.recordHit(persistent.id, {
              scopeId: context.scopeId,
              sessionId: context.sessionId,
              now,
            })
          } catch (error) {
            context.log.debug(
              "VibeLingo translation cache occurrence write failed",
              {
                reason: error instanceof Error ? error.message : String(error),
              },
            )
            persistence = "write_failed"
          }
        }
        return {
          status: "translated",
          translationId: persistent.id,
          sourceLanguage: persistent.detectedSourceLanguage,
          destinationLanguage: persistent.destinationLanguage,
          translatedText: persistent.translatedText,
          cache: "persistent_hit",
          persistence,
        }
      }
      const memory = this.memoryGet(key)
      if (memory) {
        return {
          status: "translated",
          sourceLanguage: memory.artifact.sourceLanguage,
          destinationLanguage: memory.artifact.destinationLanguage,
          translatedText: memory.artifact.translatedText,
          cache: "memory_hit",
          persistence: memory.persistence,
        }
      }
    }

    const flightKey = `${request.bypassCache ? "refresh" : "normal"}:${key}`
    let flight = this.#inflight.get(flightKey)
    if (!flight) {
      flight = this.generate(request, normalized, context).finally(() =>
        this.#inflight.delete(flightKey),
      )
      this.#inflight.set(flightKey, flight)
    }
    let generated: Awaited<typeof flight>
    try {
      generated = await flight
    } catch (error) {
      context.log.debug("VibeLingo translation generation failed", {
        reason: error instanceof Error ? error.name : "unknown",
      })
      throw new Error(
        "VibeLingo could not complete the translation. Please retry.",
      )
    }
    if ("reason" in generated)
      return { status: "not_translatable", reason: generated.reason }

    const sourceSensitive = containsSensitiveContent(normalized)
    const privacyExcluded = sourceSensitive || generated.sensitive
    let persistence: MemoryEntry["persistence"] = privacyExcluded
      ? "privacy_excluded"
      : request.historyEnabled
        ? "saved"
        : "disabled"
    let translationId: string | undefined
    if (!privacyExcluded && request.historyEnabled) {
      try {
        const row = this.repository.save({
          identity,
          detectedSourceLanguage: generated.sourceLanguage,
          destinationLanguage: generated.destinationLanguage,
          sourcePreview:
            request.selection.wholeContainer &&
            ["user_message", "assistant_message"].includes(
              request.selection.origin,
            )
              ? undefined
              : sanitizeFragment(normalized),
          sourceCharCount: [...normalized].length,
          translatedText: generated.translatedText,
          scopeId: context.scopeId,
          sessionId: context.sessionId,
          now,
        })
        translationId = row.id
      } catch (error) {
        context.log.debug("VibeLingo translation cache write failed", {
          reason: error instanceof Error ? error.message : String(error),
        })
        persistence = "write_failed"
      }
    }
    const ttl = privacyExcluded ? 5 * 60_000 : 30 * 60_000
    this.memorySet(key, {
      artifact: generated,
      expiresAt: now + ttl,
      persistence,
    })
    return {
      status: "translated",
      translationId,
      sourceLanguage: generated.sourceLanguage,
      destinationLanguage: generated.destinationLanguage,
      translatedText: generated.translatedText,
      cache: "miss",
      persistence,
    }
  }
}

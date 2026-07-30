import { createHash } from "node:crypto"
import type {
  PluginInvocationContext,
  PluginModelRole,
} from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
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
import { canonicalLanguageTag, languageDisplayName } from "../language"
import type { TranslationRepository } from "../infrastructure/translation-repository"

export const TRANSLATOR_AGENT_NAME = "vibe-lingo-translator"
export const TRANSLATOR_PROMPT = `You translate a selected passage for VibeLingo.
Return one JSON object and no markdown. Detect the source language, follow the requested destination policy,
and preserve meaning, tone, formatting, code identifiers, and uncertainty. Do not explain the translation.
If the input has no translatable natural language, return status "not_translatable" with a short reason.
Mark sensitive true if either input or translated output contains credentials, private keys, personal contact
details, private absolute paths, or other secrets.`

const AgentOutputSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("translated"),
      detectedSourceLanguage: z.string().min(1).max(64),
      destinationLanguage: z.string().min(1).max(64),
      translatedText: z.string().min(1),
      sensitive: z.boolean(),
    })
    .strict(),
  z
    .object({
      status: z.literal("not_translatable"),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
])

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
      selection: normalized,
    })
  }

  private parse(
    request: TranslateRequest,
    text: string,
  ): TranslationArtifact | { reason: string } {
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      throw new Error("Translator returned invalid JSON")
    }
    const parsed = AgentOutputSchema.parse(value)
    if (parsed.status === "not_translatable") return { reason: parsed.reason }
    const sourceLanguage = canonicalLanguageTag(parsed.detectedSourceLanguage)
    const destinationLanguage = canonicalLanguageTag(parsed.destinationLanguage)
    if (!sourceLanguage || !destinationLanguage)
      throw new Error("Translator returned an invalid language tag")
    const expected =
      request.destination === "native"
        ? request.profile.nativeLanguage
        : request.destination === "target"
          ? request.profile.targetLanguage
          : languageBase(sourceLanguage) ===
              languageBase(request.profile.targetLanguage)
            ? request.profile.nativeLanguage
            : request.profile.targetLanguage
    if (languageBase(destinationLanguage) !== languageBase(expected)) {
      throw new Error("Translator returned an unexpected destination language")
    }
    if (
      !parsed.translatedText.trim() ||
      [...parsed.translatedText].length > MAX_TRANSLATION_CODEPOINTS
    ) {
      throw new Error("Translated text exceeded its storage bound")
    }
    return {
      sourceLanguage,
      destinationLanguage,
      translatedText: truncateCodePoints(
        parsed.translatedText,
        MAX_TRANSLATION_CODEPOINTS,
      ),
      sensitive:
        parsed.sensitive || containsSensitiveContent(parsed.translatedText),
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
      flight = this.#callTranslator(
        this.prompt(request, normalized),
        request.modelRole,
        context,
      )
        .then((text) => this.parse(request, text))
        .finally(() => this.#inflight.delete(flightKey))
      this.#inflight.set(flightKey, flight)
    }
    const generated = await flight
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

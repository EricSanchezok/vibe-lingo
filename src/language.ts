import { z } from "zod"

export const COMMON_LANGUAGE_TAGS = [
  "en",
  "zh-Hans",
  "zh-Hant",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "pt-BR",
  "it",
  "ru",
  "ar",
  "hi",
  "th",
  "vi",
  "id",
] as const

export function canonicalLanguageTag(value: string): string | undefined {
  const candidate = value.trim()
  if (!candidate) return undefined
  try {
    const canonical = Intl.getCanonicalLocales(candidate)[0]
    if (
      !canonical ||
      canonical.toLowerCase() === "und" ||
      canonical.toLowerCase().includes("-x-")
    ) return undefined
    return canonical
  } catch {
    return undefined
  }
}

export function hasCompatibleTargetScript(text: string, targetLanguage: string): boolean {
  const script = languageScript(targetLanguage)
  if (script === "Jpan") {
    return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
  }
  if (script === "Kore") {
    return /[\p{Script=Hangul}\p{Script=Han}]/u.test(text)
  }
  return scriptCharacters(text, script) > 0
}

export const LanguageTagSchema = z.string().transform((value, context) => {
  const canonical = canonicalLanguageTag(value)
  if (!canonical) {
    context.addIssue({
      code: "custom",
      message: "Enter a valid BCP-47 language tag, such as en, zh-Hans, or pt-BR.",
    })
    return z.NEVER
  }
  return canonical
})

export const OptionalLanguageTagSchema = z.string().default("").transform((value, context) => {
  if (!value.trim()) return ""
  const canonical = canonicalLanguageTag(value)
  if (!canonical) {
    context.addIssue({
      code: "custom",
      message: "Enter a valid BCP-47 language tag, such as en, zh-Hans, or pt-BR.",
    })
    return z.NEVER
  }
  return canonical
})

export function languageDisplayName(tag: string, locale = "en"): string {
  const canonical = canonicalLanguageTag(tag)
  if (!canonical) return tag
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(canonical) ?? canonical
  } catch {
    return canonical
  }
}

export function languageScript(tag: string): string | undefined {
  const canonical = canonicalLanguageTag(tag)
  if (!canonical) return undefined
  try {
    return new Intl.Locale(canonical).maximize().script
  } catch {
    return undefined
  }
}

const SCRIPT_PATTERNS: Record<string, RegExp> = {
  Arab: /\p{Script=Arabic}/gu,
  Cyrl: /\p{Script=Cyrillic}/gu,
  Deva: /\p{Script=Devanagari}/gu,
  Grek: /\p{Script=Greek}/gu,
  Hang: /\p{Script=Hangul}/gu,
  Hebr: /\p{Script=Hebrew}/gu,
  Latn: /\p{Script=Latin}/gu,
  Thai: /\p{Script=Thai}/gu,
}

function scriptCharacters(text: string, script: string | undefined): number {
  if (script === "Hans" || script === "Hant" || script === "Hani") {
    return text.match(/\p{Script=Han}/gu)?.length ?? 0
  }
  if (script === "Jpan") {
    return text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0
  }
  if (script === "Kore") {
    return text.match(/[\p{Script=Hangul}\p{Script=Han}]/gu)?.length ?? 0
  }
  const pattern = script ? SCRIPT_PATTERNS[script] : undefined
  return pattern ? (text.match(pattern)?.length ?? 0) : (text.match(/\p{L}/gu)?.length ?? 0)
}

export function hasTargetLanguageSignal(text: string, targetLanguage: string): boolean {
  const script = languageScript(targetLanguage)
  if (script === "Jpan") {
    return (text.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0) >= 2
  }
  if (script === "Kore") {
    return (text.match(/\p{Script=Hangul}/gu)?.length ?? 0) >= 2
  }
  if (script === "Hans" || script === "Hant" || script === "Hani") {
    return scriptCharacters(text, script) >= 3
  }
  if (!script || !SCRIPT_PATTERNS[script]) {
    return scriptCharacters(text, script) >= 3
  }
  if (scriptCharacters(text, script) < 3) return false
  try {
    const locale = canonicalLanguageTag(targetLanguage) ?? "en"
    const segments = new Intl.Segmenter(locale, { granularity: "word" }).segment(text)
    return Array.from(segments).filter((segment) => segment.isWordLike).length >= 3
  } catch {
    return (text.match(/[\p{L}\p{M}]+/gu)?.length ?? 0) >= 3
  }
}

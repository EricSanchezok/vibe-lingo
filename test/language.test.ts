import { describe, expect, test } from "bun:test"
import {
  LanguageTagSchema,
  OptionalLanguageTagSchema,
  canonicalLanguageTag,
  hasCompatibleTargetScript,
  languageScript,
} from "../src/language"
import { configuredProfile, VibeLingoSettingsSchema } from "../src/settings"

describe("multilingual profile", () => {
  test("canonicalizes Intl-supported BCP-47 tags and rejects invalid or private-use input", () => {
    expect(canonicalLanguageTag(" zh-hans ")).toBe("zh-Hans")
    expect(canonicalLanguageTag("pt-br")).toBe("pt-BR")
    expect(canonicalLanguageTag("tlh")).toBe("tlh")
    expect(canonicalLanguageTag("not a language")).toBeUndefined()
    expect(canonicalLanguageTag("en-x-private")).toBeUndefined()
  })

  test("preserves canonicalization in JSON-Schema-compatible validators", () => {
    expect(LanguageTagSchema.parse(" zh-hans ")).toBe("zh-Hans")
    expect(OptionalLanguageTagSchema.parse("pt-br")).toBe("pt-BR")
    expect(OptionalLanguageTagSchema.parse(undefined)).toBe("")
    expect(OptionalLanguageTagSchema.parse("   ")).toBe("")
    expect(LanguageTagSchema.safeParse("en-x-private").success).toBe(false)
  })

  test("requires two valid, distinct languages before activation", () => {
    const base = VibeLingoSettingsSchema.parse({})
    expect(configuredProfile(base)).toBeUndefined()
    expect(
      configuredProfile(
        VibeLingoSettingsSchema.parse({
          ...base,
          nativeLanguage: "en-US",
          targetLanguage: "en-US",
        }),
      ),
    ).toBeUndefined()
    expect(
      configuredProfile(
        VibeLingoSettingsSchema.parse({
          ...base,
          nativeLanguage: "en",
          targetLanguage: "es",
        }),
      ),
    ).toEqual({
      nativeLanguage: "en",
      targetLanguage: "es",
      proficiency: "intermediate",
    })
  })

  test("validates correction fragments against the configured target script", () => {
    expect(languageScript("en")).toBe("Latn")
    expect(hasCompatibleTargetScript("Please add this button", "en")).toBe(true)
    expect(hasCompatibleTargetScript("请帮我修改页面", "zh-Hans")).toBe(true)
    expect(hasCompatibleTargetScript("ボタンを追加", "ja")).toBe(true)
    expect(hasCompatibleTargetScript("버튼을 추가해 주세요", "ko")).toBe(true)
    expect(hasCompatibleTargetScript("Добавьте эту кнопку", "ru")).toBe(true)
    expect(hasCompatibleTargetScript("tlhIngan Hol Dajatlh", "tlh")).toBe(true)
    expect(hasCompatibleTargetScript("añade un botón", "es")).toBe(true)
    expect(hasCompatibleTargetScript("ボタン", "en")).toBe(false)
  })
})

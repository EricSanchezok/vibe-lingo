import { describe, expect, test } from "bun:test"
import {
  canonicalLanguageTag,
  hasCompatibleTargetScript,
  hasTargetLanguageSignal,
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

  test("uses controlled script signals for Latin, Han, Japanese, Korean, Cyrillic, and unknown scripts", () => {
    expect(languageScript("en")).toBe("Latn")
    expect(hasTargetLanguageSignal("Please add this button", "en")).toBe(true)
    expect(hasTargetLanguageSignal("fix it", "en")).toBe(false)
    expect(hasTargetLanguageSignal("请帮我修改页面", "zh-Hans")).toBe(true)
    expect(hasTargetLanguageSignal("请帮我修改页面", "ja")).toBe(false)
    expect(hasTargetLanguageSignal("ボタンを追加", "ja")).toBe(true)
    expect(hasTargetLanguageSignal("버튼을 추가해 주세요", "ko")).toBe(true)
    expect(hasTargetLanguageSignal("Добавьте эту кнопку", "ru")).toBe(true)
    expect(hasTargetLanguageSignal("tlhIngan Hol Dajatlh", "tlh")).toBe(true)
    expect(hasCompatibleTargetScript("añade un botón", "es")).toBe(true)
    expect(hasCompatibleTargetScript("ボタン", "en")).toBe(false)
  })
})

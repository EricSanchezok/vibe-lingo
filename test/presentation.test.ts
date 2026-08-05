import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { invocationContext, seedCorrection } from "./helpers"
import { languageDisplayName } from "../src/language"

const temporaryDirectories: string[] = []

function services() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-presentation-"))
  temporaryDirectories.push(directory)
  return createServices(new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const profile = {
  nativeLanguage: "zh-Hans",
  targetLanguage: "en",
  proficiency: "intermediate" as const,
}

function seed(service: ReturnType<typeof services>) {
  seedCorrection(service, {
    messageId: "message-1",
    scopeId: "scope-a",
    sessionId: "session-a",
    observedAt: 1_000,
  }, profile, {
    patternKey: "missing_article",
    category: "grammar",
    severity: "high_value",
    label: "Missing article",
    rule: "Use an article before a singular countable noun.",
    originalFragment: "add button",
    correctedFragment: "add a button",
    confidence: 0.98,
    sensitive: false,
  })
}

describe("localized pattern presentations", () => {
  test("generates once, caches by support language, and invalidates changed source metadata", async () => {
    const service = services()
    seed(service)
    let calls = 0
    const context = invocationContext({
      agent: {
        async call(input) {
          calls += 1
          expect(input.agent).toBe("vibe-lingo-pattern-presenter")
          expect(input.timeoutMs).toBe(120_000)
          expect(JSON.parse(input.text.slice(input.text.indexOf("\n") + 1))).toMatchObject({
            supportLanguage: { tag: "zh-Hans", name: languageDisplayName("zh-Hans", "en") },
            targetLanguage: { tag: "en", name: "English" },
          })
          return {
            text: JSON.stringify({
              items: [{
                patternKey: "missing_article",
                label: calls === 1 ? "缺少冠词" : "冠词使用",
                rule: "单数可数名词前使用合适的冠词。",
                confidence: 0.98,
              }],
            }),
          }
        },
      },
    })

    await expect(service.presentationService.present(
      profile,
      ["missing_article"],
      context,
    )).resolves.toEqual([{
      patternKey: "missing_article",
      label: "缺少冠词",
      rule: "单数可数名词前使用合适的冠词。",
      source: "localized",
    }])
    await service.presentationService.present(profile, ["missing_article"], context)
    expect(calls).toBe(1)

    service.database.connection().query(
      "UPDATE learning_patterns SET label = ? WHERE target_language = ? AND pattern_key = ?",
    ).run("Article choice", "en", "missing_article")
    const refreshed = await service.presentationService.present(
      profile,
      ["missing_article"],
      context,
    )
    expect(calls).toBe(2)
    expect(refreshed[0]?.label).toBe("冠词使用")
  })

  test("falls back to canonical metadata for invalid output and never calls an Agent for English support", async () => {
    const service = services()
    seed(service)
    let calls = 0
    const context = invocationContext({
      agent: {
        async call() {
          calls += 1
          return { text: "{\"items\":[{\"patternKey\":\"unknown\",\"label\":\"x\",\"rule\":\"y\",\"confidence\":1}]}" }
        },
      },
    })
    expect(await service.presentationService.present(
      profile,
      ["missing_article"],
      context,
    )).toEqual([{
      patternKey: "missing_article",
      label: "Missing article",
      rule: "Use an article before a singular countable noun.",
      source: "canonical_fallback",
    }])
    expect(calls).toBe(1)

    expect(await service.presentationService.present(
      { ...profile, nativeLanguage: "en" },
      ["missing_article"],
      context,
    )).toMatchObject([{ source: "canonical_fallback" }])
    expect(calls).toBe(1)
  })

  test("presentation cache cascades with pattern cleanup", async () => {
    const service = services()
    seed(service)
    await service.presentationService.present(profile, ["missing_article"], invocationContext({
      agent: {
        async call() {
          return {
            text: JSON.stringify({
              items: [{
                patternKey: "missing_article",
                label: "缺少冠词",
                rule: "使用合适的冠词。",
                confidence: 0.99,
              }],
            }),
          }
        },
      },
    }))
    expect(service.database.connection().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM pattern_presentations",
    ).get()?.count).toBe(1)
    service.learning.patternCommand("en", { action: "delete", patternKey: "missing_article" })
    expect(service.database.connection().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM pattern_presentations",
    ).get()?.count).toBe(0)
  })
})

import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { suggestExpressionTool } from "../src/suggest-expression"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function services() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-suggest-expression-"))
  temporaryDirectories.push(directory)
  return createServices(new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const input = {
  sourceExpression: "请帮我把这个按钮加到设置页面。",
  targetExpression: "Please add this button to the settings page.",
}

function context(options: {
  profile?: boolean
  mode?: "focused" | "strict" | "off"
  enabled?: boolean
} = {}) {
  const profile = options.profile ?? true
  return invocationContext({
    settings: {
      async get() {
        return {
          nativeLanguage: profile ? "zh-Hans" : "",
          targetLanguage: profile ? "en" : "",
          proficiency: "intermediate",
          correctionMode: options.mode ?? "focused",
          naturalnessSuggestionsEnabled: true,
          expressionSuggestionsEnabled: options.enabled ?? true,
          trackingEnabled: true,
          recurringFocusEnabled: true,
        }
      },
    },
  })
}

describe("expression suggestion tool", () => {
  test("shows a persistence-free target-language example", async () => {
    const service = services()
    let published = 0
    const result = await suggestExpressionTool(
      input,
      invocationContext({
        ...context(),
        events: {
          async publish() {
            published++
          },
        },
      }),
      service,
    )
    expect(result.title).toBe("How to say this in en")
    expect(result.output).toContain('Your expression: "请帮我把这个按钮加到设置页面。"')
    expect(result.output).toContain('In en: "Please add this button to the settings page."')
    expect(result.metadata).toMatchObject({
      vibeLingo: {
        status: "shown",
        targetLanguage: "en",
      },
    })
    expect(published).toBe(0)

    service.database.initialize()
    const db = service.database.connection()
    expect(db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM correction_batches").get()?.count).toBe(0)
    expect(db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM message_observations").get()?.count).toBe(0)
    expect(db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM learning_events").get()?.count).toBe(0)
  })

  test("rejects empty or overlong expressions", async () => {
    const service = services()
    await expect(suggestExpressionTool({ ...input, sourceExpression: "" }, context(), service))
      .rejects.toThrow("empty or exceeds VibeLingo's privacy bounds")
    await expect(suggestExpressionTool({ ...input, targetExpression: "" }, context(), service))
      .rejects.toThrow("empty or exceeds VibeLingo's privacy bounds")
    await expect(
      suggestExpressionTool({ ...input, sourceExpression: "x".repeat(2_001) }, context(), service),
    ).rejects.toThrow("empty or exceeds VibeLingo's privacy bounds")
    await expect(
      suggestExpressionTool({ ...input, notes: "x".repeat(501) }, context(), service),
    ).rejects.toThrow("empty or exceeds VibeLingo's privacy bounds")
  })

  test("accepts long real-world expressions and normalizes uppercase field variants", async () => {
    const service = services()
    const result = await suggestExpressionTool(
      {
        SourceExpression: "In questo nuovo albero di lavoro, esplora il codice sorgente sinergico e indaga.",
        TargetExpression: "In this new worktree, explore the Synergy source code and investigate.",
        Note: "compatto, sommario visivo è più vicino alla forma espandibile della scheda UI.",
      } as never,
      context(),
      service,
    )
    expect(result.output).toContain(
      'Your expression: "In questo nuovo albero di lavoro, esplora il codice sorgente sinergico e indaga."',
    )
    expect(result.output).toContain(
      'In en: "In this new worktree, explore the Synergy source code and investigate."',
    )
    expect(result.output).toContain(
      "Note: compatto, sommario visivo è più vicino alla forma espandibile della scheda UI.",
    )

    const long = await suggestExpressionTool(
      {
        sourceExpression: "x".repeat(1_500),
        targetExpression: "y".repeat(1_200),
      },
      context(),
      service,
    )
    expect(long.output).toContain("x".repeat(1_500))
  })

  test("rejects when coaching is not configured or disabled", async () => {
    const service = services()
    await expect(suggestExpressionTool(input, context({ profile: false }), service))
      .rejects.toThrow("VibeLingo coaching is not configured for this Scope")
    await expect(suggestExpressionTool(input, context({ mode: "off" }), service))
      .rejects.toThrow("VibeLingo coaching is not configured for this Scope")
    await expect(suggestExpressionTool(input, context({ enabled: false }), service))
      .rejects.toThrow("Expression suggestions are disabled for this Scope")
  })
})

import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { progressTool, renderProgress } from "../src/progress"
import { VibeLingoStore } from "../src/storage"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function store(): VibeLingoStore {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-progress-"))
  temporaryDirectories.push(directory)
  return new VibeLingoStore(path.join(directory, "vibe-lingo.sqlite"))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe("progress output", () => {
  test("renders evidence-backed counts and optional provenance without proficiency claims", () => {
    const output = renderProgress(
      {
        targetLanguage: "en",
        analyzedMessages: 12,
        findingsLast30Days: 4,
        patterns: [
          {
            patternKey: "missing_article",
            category: "grammar",
            label: "Missing article",
            rule: "Use a or the for one countable thing.",
            occurrenceCount: 4,
            sessionCount: 2,
            firstSeenAt: Date.UTC(2026, 0, 1),
            lastSeenAt: Date.UTC(2026, 0, 3),
            severity: "high_value",
            examples: [
              {
                observedAt: Date.UTC(2026, 0, 3),
                scopeId: "scope-a",
                sessionId: "session-a",
                messageId: "message-a",
                originalFragment: "add button",
                correctedFragment: "add a button",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("Analyzed messages: 12")
    expect(output).toContain("4 occurrence(s) across 2 session(s)")
    expect(output).toContain("`add button` → `add a button`")
    expect(output).toContain("session `session-a`")
    expect(output).not.toContain("proficiency")
    expect(output).not.toContain("mastered")
  })

  test("keeps stored fragments inside a single safe Markdown line", () => {
    const output = renderProgress(
      {
        targetLanguage: "en",
        analyzedMessages: 1,
        findingsLast30Days: 1,
        patterns: [
          {
            patternKey: "word_choice",
            category: "word_choice",
            label: "Word choice",
            rule: "Prefer the more precise word.",
            occurrenceCount: 1,
            sessionCount: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            severity: "minor",
            examples: [
              {
                observedAt: 1,
                scopeId: "scope",
                sessionId: "session",
                messageId: "message",
                originalFragment: "one\n`two`",
                correctedFragment: "one two",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("`one ˋtwoˋ` → `one two`")
  })

  test("requires setup and defaults queries to the active target language", async () => {
    const database = store()
    const unconfigured = await progressTool(
      {},
      invocationContext({
        settings: {
          async get() {
            return {}
          },
        },
      }),
      database,
    )
    expect(unconfigured.metadata).toMatchObject({ setupRequired: true })

    database.recordAnalysis(
      {
        messageId: "message-es",
        scopeId: "scope-test",
        sessionId: "session-test",
        observedAt: Date.now(),
      },
      "es",
      [
        {
          patternKey: "missing_article",
          category: "grammar",
          severity: "high_value",
          label: "Missing article",
          rule: "Use an article with a singular countable noun.",
          originalFragment: "añade botón",
          correctedFragment: "añade un botón",
          confidence: 0.95,
          sensitive: false,
        },
      ],
    )
    const configured = await progressTool(
      {},
      invocationContext({
        settings: {
          async get() {
            return {
              nativeLanguage: "en",
              targetLanguage: "es",
              proficiency: "intermediate",
              correctionMode: "focused",
              trackingEnabled: true,
              recurringFocusEnabled: true,
            }
          },
        },
      }),
      database,
    )
    expect(configured.title).toContain("Spanish")
    expect(configured.metadata).toMatchObject({ language: "es", analyzedMessages: 1 })
  })
})

import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import {
  containsSensitiveContent,
  deterministicSkipReason,
  findingsForStorage,
  hasEscapeHatch,
  parseAnalysisResult,
  processUserMessage,
} from "../src/analyzer"
import { VibeLingoStore } from "../src/storage"
import type { AnalysisResult } from "../src/types"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function store(): VibeLingoStore {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-analyzer-"))
  temporaryDirectories.push(directory)
  return new VibeLingoStore(path.join(directory, "vibe-lingo.sqlite"))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const validResult: AnalysisResult = {
  isEnglishAttempt: true,
  findings: [
    {
      patternKey: "missing_infinitive_to",
      category: "grammar",
      severity: "high_value",
      label: "Missing to",
      rule: "Use want to followed by the action.",
      originalFragment: "I want add a button",
      correctedFragment: "I want to add a button",
      confidence: 0.97,
      sensitive: false,
    },
  ],
}

describe("background prefilter and output validation", () => {
  test("recognizes escape hatches and deterministic skip cases", () => {
    expect(hasEscapeHatch("Please just do it this time")).toBe(true)
    expect(hasEscapeHatch("跳过纠正，直接运行")).toBe(true)
    expect(deterministicSkipReason("fix it")).toBe("too_little_english")
    expect(deterministicSkipReason("```ts\nconst value = 1\n```")).toBe("mostly_code")
    expect(deterministicSkipReason("Please add a button to settings.")).toBeUndefined()
  })

  test("accepts strict JSON and rejects Markdown-wrapped JSON", () => {
    expect(parseAnalysisResult(JSON.stringify(validResult))).toEqual(validResult)
    expect(() => parseAnalysisResult(`\`\`\`json\n${JSON.stringify(validResult)}\n\`\`\``)).toThrow()
  })

  test("filters low confidence and drops sensitive fragments", () => {
    const lowConfidence: AnalysisResult = {
      ...validResult,
      findings: [{ ...validResult.findings[0], confidence: 0.5 }],
    }
    expect(findingsForStorage(lowConfidence)).toEqual([])
    expect(containsSensitiveContent("token=abcdefghijklmnopqrstuvwxyz123456789")).toBe(true)
    const sensitive = findingsForStorage({
      ...validResult,
      findings: [
        {
          ...validResult.findings[0],
          originalFragment: "See https://private.example.com",
        },
      ],
    })
    expect(sensitive[0]).not.toHaveProperty("originalFragment")
    expect(sensitive[0]).not.toHaveProperty("correctedFragment")
  })

  test("deduplicates synonymous output that reuses the same stable key", () => {
    expect(
      findingsForStorage({
        ...validResult,
        findings: [validResult.findings[0], { ...validResult.findings[0], label: "Duplicate" }],
      }),
    ).toHaveLength(1)
  })
})

describe("background observer behavior", () => {
  test("stores a validated finding without retaining the full message", async () => {
    const database = store()
    const calls: unknown[] = []
    const context = invocationContext({
      agent: {
        async call(input) {
          calls.push(input)
          return { text: JSON.stringify(validResult) }
        },
      },
    })
    await processUserMessage(
      {
        message: {
          id: "message-one",
          text: "I want add a button to the settings page.",
          createdAt: 100,
        },
      },
      context,
      {
        store: database,
        async readSettings() {
          return {
            correctionMode: "focused",
            trackingEnabled: true,
            recurringFocusEnabled: true,
          }
        },
        async hasEligibleSession() {
          return true
        },
      },
    )
    expect(calls).toHaveLength(1)
    expect(database.isAnalyzed("message-one")).toBe(true)
    const snapshot = database.progress({ limit: 5, includeExamples: true, now: 100 })
    expect(snapshot.analyzedMessages).toBe(1)
    expect(snapshot.patterns[0]).toMatchObject({
      patternKey: "missing_infinitive_to",
      occurrenceCount: 1,
    })
    expect(snapshot.patterns[0].examples[0].originalFragment).toBe("I want add a button")
  })

  test("does not persist escape-hatch messages and swallows analyzer failures", async () => {
    const database = store()
    const dependency = {
      store: database,
      async readSettings() {
        return {
          correctionMode: "focused" as const,
          trackingEnabled: true,
          recurringFocusEnabled: true,
        }
      },
      async hasEligibleSession() {
        return true
      },
    }
    await processUserMessage(
      {
        message: {
          id: "message-escape",
          text: "I want add a button, just do it",
          createdAt: 100,
        },
      },
      invocationContext(),
      dependency,
    )
    await processUserMessage(
      {
        message: {
          id: "message-invalid",
          text: "I want add another button to settings.",
          createdAt: 101,
        },
      },
      invocationContext({
        agent: {
          async call() {
            return { text: "not json" }
          },
        },
      }),
      dependency,
    )
    expect(database.isAnalyzed("message-escape")).toBe(false)
    expect(database.isAnalyzed("message-invalid")).toBe(false)
  })
})

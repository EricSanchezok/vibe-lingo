import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { recordCorrectionTool } from "../src/correction"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function services() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-correction-tool-"))
  temporaryDirectories.push(directory)
  return createServices(new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const input = {
  restatement: "Add a button to the settings page.",
  corrections: [{
    kind: "correction" as const,
    originalFragment: "add button",
    correctedFragment: "add a button",
  }],
}

function context(options: {
  tracking?: boolean
  naturalness?: boolean
  mode?: "focused" | "strict"
  assistantMessageId?: string
} = {}) {
  return invocationContext({
    actor: {
      type: "agent",
      agent: "synergy",
      messageId: options.assistantMessageId ?? "assistant-one",
      userMessageId: "user-one",
      callId: "turn-one",
    },
    settings: {
      async get() {
        return {
          nativeLanguage: "zh-Hans",
          targetLanguage: "en",
          proficiency: "intermediate",
          correctionMode: options.mode ?? "focused",
          naturalnessSuggestionsEnabled: options.naturalness ?? true,
          trackingEnabled: options.tracking ?? true,
          recurringFocusEnabled: true,
        }
      },
    },
  })
}

describe("foreground correction tool", () => {
  test("shows the same card content without persistence when tracking is off", async () => {
    const service = services()
    let starts = 0
    const result = await recordCorrectionTool(
      input,
      invocationContext({
        ...context({ tracking: false }),
        agent: {
          async start() {
            starts++
            return { callId: "unexpected" }
          },
        },
      }),
      service,
    )
    expect(result.output).toContain('Got it: "Add a button to the settings page."')
    expect(result.output).toContain('"add button" → "add a button"')
    expect(result.metadata).toMatchObject({ vibeLingo: { status: "not_saved" } })
    expect(starts).toBe(0)
    service.database.initialize()
    expect(service.database.connection().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM correction_batches",
    ).get()?.count).toBe(0)
  })

  test("atomically records visible pairs and returns before metadata analysis completes", async () => {
    const service = services()
    let startedAgent = ""
    const result = await recordCorrectionTool(
      input,
      invocationContext({
        ...context(),
        agent: {
          async start(request) {
            startedAgent = request.agent
            return { callId: "correction-call" }
          },
        },
      }),
      service,
    )
    expect(startedAgent).toBe("vibe-lingo-correction-analyzer")
    expect(result.metadata).toMatchObject({
      vibeLingo: {
        status: "analyzing",
        analysisStatus: "queued",
        targetLanguage: "en",
      },
    })
    const stored = service.corrections.byAssistantMessage("en", "assistant-one")
    expect(stored).toMatchObject({
      userMessageId: "user-one",
      status: "queued",
      corrections: [{
        originalFragment: "add button",
        correctedFragment: "add a button",
      }],
    })
    expect(JSON.stringify(
      service.database.connection().query("SELECT * FROM correction_batches").all(),
    )).not.toContain(input.restatement)
  })

  test("is idempotent for identical calls and rejects a second correction for one response", async () => {
    const service = services()
    const ctx = invocationContext({
      ...context(),
      agent: {
        async start() {
          return { callId: "same-call" }
        },
      },
    })
    const first = await recordCorrectionTool(input, ctx, service)
    const duplicate = await recordCorrectionTool(input, ctx, service)
    const conflict = await recordCorrectionTool({
      restatement: "Add a panel.",
      corrections: [{ kind: "correction", originalFragment: "add panel", correctedFragment: "add a panel" }],
    }, ctx, service)
    expect(first.metadata).toMatchObject({ vibeLingo: { status: "analyzing" } })
    expect(duplicate.metadata).toMatchObject({ vibeLingo: { status: "analyzing" } })
    expect(conflict.metadata).toMatchObject({ vibeLingo: { status: "conflict" } })
    expect(service.database.connection().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM correction_batches",
    ).get()?.count).toBe(1)
  })

  test("accepts up to eight mixed items regardless of correction mode", async () => {
    const service = services()
    const corrections = Array.from({ length: 8 }, (_, index) =>
      index === 7
        ? {
            kind: "naturalness" as const,
            originalFragment: "I allow you to continue cleaning",
            correctedFragment: "go ahead and continue the cleanup",
            explanation: "这里用 allow 会显得正式，像是在上对下授权。",
          }
        : {
            kind: "correction" as const,
            originalFragment: `original ${index}`,
            correctedFragment: `corrected ${index}`,
          })
    await expect(recordCorrectionTool(
      { restatement: "Use the corrected wording.", corrections },
      context({ tracking: false }),
      service,
    )).resolves.toMatchObject({ metadata: { vibeLingo: { status: "not_saved" } } })
    await expect(recordCorrectionTool(
      { restatement: "Use the corrected wording.", corrections },
      context({ tracking: false, mode: "strict" }),
      service,
    )).resolves.toMatchObject({ metadata: { vibeLingo: { status: "not_saved" } } })
    await expect(recordCorrectionTool(
      { restatement: "Use the corrected wording.", corrections: [...corrections, corrections[0]] },
      context({ tracking: false }),
      service,
    )).rejects.toThrow("between one and eight")
  })

  test("enforces naturalness settings and explanation bounds", async () => {
    const service = services()
    const naturalness = {
      restatement: "Okay, go ahead and continue the cleanup.",
      corrections: [{
        kind: "naturalness" as const,
        originalFragment: "I allow you to continue cleaning",
        correctedFragment: "go ahead and continue the cleanup",
        explanation: "这里用 allow 会显得正式，像是在上对下授权。",
      }],
    }
    await expect(recordCorrectionTool(
      naturalness,
      context({ naturalness: false, tracking: false }),
      service,
    )).rejects.toThrow("Naturalness suggestions are disabled")
    await expect(recordCorrectionTool({
      ...naturalness,
      corrections: [{ ...naturalness.corrections[0], explanation: "" }],
    }, context({ tracking: false }), service)).rejects.toThrow("requires one short support-language explanation")
    await expect(recordCorrectionTool({
      ...naturalness,
      corrections: [{ ...naturalness.corrections[0], explanation: "x".repeat(201) }],
    }, context({ tracking: false }), service)).rejects.toThrow("requires one short support-language explanation")
    await expect(recordCorrectionTool({
      ...input,
      corrections: [{ ...input.corrections[0], explanation: "Do not store this." }],
    }, context({ tracking: false }), service)).rejects.toThrow("Only naturalness items include an explanation")
  })

  test("does not persist visible naturalness explanations", async () => {
    const service = services()
    const explanation = "这里用 allow 会显得正式，像是在上对下授权。"
    await recordCorrectionTool({
      restatement: "Okay, go ahead and continue the cleanup.",
      corrections: [{
        kind: "naturalness",
        originalFragment: "I allow you to continue cleaning",
        correctedFragment: "go ahead and continue the cleanup",
        explanation,
      }],
    }, invocationContext({
      ...context(),
      agent: { async start() { return { callId: "naturalness-call" } } },
    }), service)
    expect(JSON.stringify(service.database.connection().query("SELECT * FROM correction_batches").all())).not.toContain(explanation)
    expect(JSON.stringify(service.database.connection().query("SELECT * FROM correction_items").all())).not.toContain(explanation)
  })

  test("requires the host-provided source user message", async () => {
    const service = services()
    await expect(recordCorrectionTool(
      input,
      invocationContext({
        ...context(),
        actor: {
          type: "agent",
          agent: "synergy",
          messageId: "assistant",
          callId: "turn",
        },
      }),
      service,
    )).rejects.toThrow("requires a user-facing Agent tool call")
  })
})

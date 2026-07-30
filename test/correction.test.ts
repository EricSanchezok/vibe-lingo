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
    originalFragment: "add button",
    correctedFragment: "add a button",
  }],
}

function context(options: { tracking?: boolean; assistantMessageId?: string } = {}) {
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
          correctionMode: "focused",
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
      corrections: [{ originalFragment: "add panel", correctedFragment: "add a panel" }],
    }, ctx, service)
    expect(first.metadata).toMatchObject({ vibeLingo: { status: "analyzing" } })
    expect(duplicate.metadata).toMatchObject({ vibeLingo: { status: "analyzing" } })
    expect(conflict.metadata).toMatchObject({ vibeLingo: { status: "conflict" } })
    expect(service.database.connection().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM correction_batches",
    ).get()?.count).toBe(1)
  })

  test("enforces focused bounds and requires the host-provided source user message", async () => {
    const service = services()
    await expect(recordCorrectionTool({
      ...input,
      corrections: [input.corrections[0], input.corrections[0]],
    }, context(), service)).rejects.toThrow("Focused mode requires exactly one correction")
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

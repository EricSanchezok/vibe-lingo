import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import {
  correctionStatus,
  retryCorrectionAnalysis,
  type CorrectionRecoveryDependencies,
} from "../src/correction-recovery"
import type { CorrectionBatch } from "../src/infrastructure/correction-repository"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { DEFAULT_SETTINGS } from "../src/settings"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-recovery-"))
  temporaryDirectories.push(directory)
  const services = createServices(new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")))
  const settings = {
    ...DEFAULT_SETTINGS,
    nativeLanguage: "zh-Hans",
    targetLanguage: "en",
  }
  let now = 20_000
  const dependencies: CorrectionRecoveryDependencies = {
    services,
    async readSettings() {
      return settings
    },
    now() {
      return now
    },
  }
  const create = (scopeId = "scope-test") => {
    const created = services.corrections.create({
      profile: {
        nativeLanguage: "zh-Hans",
        targetLanguage: "en",
        proficiency: "intermediate",
      },
      identity: {
        messageId: crypto.randomUUID(),
        scopeId,
        sessionId: "session-test",
        observedAt: 1_000,
      },
      assistantMessageId: crypto.randomUUID(),
      correction: {
        restatement: "Add a button.",
        corrections: [{ originalFragment: "add button", correctedFragment: "add a button" }],
      },
    })
    if (!created.batch) throw new Error("batch missing")
    return created.batch
  }
  return {
    services,
    settings,
    dependencies,
    create,
    setNow(value: number) {
      now = value
    },
  }
}

function queueBatch(
  services: ReturnType<typeof setup>["services"],
  batch: CorrectionBatch,
  queuedAt: number,
  callId = "orphaned-call",
) {
  const claimed = services.corrections.claimAnalysisAttempt({
    batchId: batch.id,
    scopeId: batch.scopeId,
    expectedCorrelationId: batch.correlationId,
    correlationId: batch.correlationId,
    now: queuedAt,
  })
  if (!claimed) throw new Error("correction batch was not claimed")
  if (
    !services.corrections.attachAnalysisCall({
      batchId: batch.id,
      scopeId: batch.scopeId,
      correlationId: batch.correlationId,
      callId,
    })
  ) {
    throw new Error("correction call was not attached")
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe("correction recovery projection", () => {
  test("keeps fresh queued work waiting, exposes stale recovery, and hides other Scopes", async () => {
    const { services, dependencies, create, setNow } = setup()
    const batch = create()
    queueBatch(services, batch, 10_000)
    const context = invocationContext({
      agent: {
        async start() {
          return { callId: "unused" }
        },
      },
    })

    expect(await correctionStatus(batch.id, context, dependencies)).toEqual({
      found: true,
      status: "queued",
      patternKeys: [],
      recovery: "waiting",
      retryAt: 40_000,
    })

    setNow(40_001)
    expect(await correctionStatus(batch.id, context, dependencies)).toMatchObject({
      found: true,
      status: "queued",
      recovery: "retry_available",
    })
    expect(await correctionStatus(batch.id, invocationContext({ scopeId: "scope-other" }), dependencies)).toEqual({
      found: false,
      patternKeys: [],
      recovery: "none",
    })
  })

  test("claims one explicit retry and returns the fresh waiting projection", async () => {
    const { services, dependencies, create, setNow } = setup()
    const batch = create()
    queueBatch(services, batch, 10_000)
    setNow(40_001)
    let starts = 0
    const context = invocationContext({
      agent: {
        async start() {
          starts++
          return { callId: "retry-call" }
        },
      },
    })

    const retried = await retryCorrectionAnalysis(batch.id, context, dependencies)
    expect(retried).toMatchObject({
      found: true,
      status: "queued",
      recovery: "waiting",
    })
    expect(starts).toBe(1)
    expect(services.corrections.byId(batch.id)).toMatchObject({
      status: "queued",
      callId: "retry-call",
    })
    expect(services.corrections.byId(batch.id)?.correlationId).not.toBe(batch.correlationId)

    expect(await retryCorrectionAnalysis(batch.id, context, dependencies)).toMatchObject({
      status: "queued",
      recovery: "waiting",
    })
    expect(starts).toBe(1)
  })

  test("marks unresolved work unavailable when tracking no longer permits analysis", async () => {
    const { settings, dependencies, create } = setup()
    const batch = create()
    settings.trackingEnabled = false

    expect(await correctionStatus(batch.id, invocationContext(), dependencies)).toEqual({
      found: true,
      status: "pending",
      patternKeys: [],
      recovery: "retry_unavailable",
    })
  })

  test("allows saved corrections to finish when foreground coaching is off", async () => {
    const { settings, dependencies, create } = setup()
    const batch = create()
    settings.correctionMode = "off"

    expect(
      await correctionStatus(
        batch.id,
        invocationContext({
          agent: {
            async start() {
              return { callId: "unused" }
            },
          },
        }),
        dependencies,
      ),
    ).toMatchObject({
      found: true,
      status: "pending",
      recovery: "retry_available",
    })
  })
})

import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import {
  CORRECTION_ANALYZER_AGENT_NAME,
  LANGUAGE_CLASSIFIER_AGENT_NAME,
  USAGE_ANALYZER_AGENT_NAME,
  correctionAnalyzerRequest,
  deterministicSkipReason,
  enqueueCorrectionAnalysis,
  handleAgentCallAfter,
  hasEscapeHatch,
  processUserMessage,
  type AnalysisDependencies,
} from "../src/analysis"
import { createServices } from "../src/application/services"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { invocationContext, seedCorrection } from "./helpers"

const temporaryDirectories: string[] = []

function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-analysis-"))
  temporaryDirectories.push(directory)
  const services = createServices(
    new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")),
  )
  const settings = {
    nativeLanguage: "zh-Hans",
    targetLanguage: "en",
    proficiency: "intermediate" as const,
    correctionMode: "focused" as const,
    trackingEnabled: true,
    recurringFocusEnabled: true,
  }
  const dependencies: AnalysisDependencies = {
    services,
    async readSettings() {
      return settings
    },
    async hasEligibleSession() {
      return true
    },
  }
  return { services, settings, dependencies }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe("nano language classification", () => {
  test("skips only deterministic privacy/size cases and preserves sparse short input", () => {
    expect(hasEscapeHatch("Please just do it this time")).toBe(true)
    expect(hasEscapeHatch("跳过纠正，直接运行")).toBe(true)
    expect(deterministicSkipReason("fix it")).toBeUndefined()
    expect(deterministicSkipReason("```ts\nconst value = 1\n```")).toBe("mostly_code")
    expect(deterministicSkipReason("x".repeat(4_001))).toBe("too_long")
  })

  test("retries once in memory and stores only the final target-attempt observation", async () => {
    const { services, dependencies } = setup()
    let calls = 0
    await processUserMessage(
      {
        message: {
          id: "message-retry",
          text: "I want add a button.",
          createdAt: 100,
        },
      },
      invocationContext({
        agent: {
          async call(input) {
            expect(input.agent).toBe(LANGUAGE_CLASSIFIER_AGENT_NAME)
            calls++
            return { text: calls === 1 ? "not json" : '{"isTargetLanguageAttempt":true}' }
          },
        },
      }),
      dependencies,
    )
    expect(calls).toBe(2)
    expect(services.learning.learningSummary("en")).toMatchObject({
      analyzedMessages: 1,
      targetAttempts: 1,
      totalPatternCount: 0,
    })
    expect(JSON.stringify(
      services.database.connection().query("SELECT * FROM message_observations").all(),
    )).not.toContain("I want add a button")
  })

  test("does not classify or persist escape-hatch and tracking-off messages", async () => {
    const { services, dependencies, settings } = setup()
    let calls = 0
    const context = invocationContext({
      agent: {
        async call() {
          calls++
          return { text: '{"isTargetLanguageAttempt":true}' }
        },
      },
    })
    await processUserMessage({
      message: { id: "escape", text: "I want add a button, just do it", createdAt: 1 },
    }, context, dependencies)
    settings.trackingEnabled = false
    await processUserMessage({
      message: { id: "off", text: "I want add a panel.", createdAt: 2 },
    }, context, dependencies)
    expect(calls).toBe(0)
    expect(services.learning.isObserved("escape", "en")).toBe(false)
    expect(services.learning.isObserved("off", "en")).toBe(false)
  })
})

describe("lightweight asynchronous teaching analysis", () => {
  test("starts usage analysis only for supplied known patterns and writes its completion once", async () => {
    const { services, dependencies } = setup()
    seedCorrection(services, {
      messageId: "seed",
      scopeId: "scope-test",
      sessionId: "seed-session",
      observedAt: 10,
    }, {
      nativeLanguage: "zh-Hans",
      targetLanguage: "en",
      proficiency: "intermediate",
    }, {
      patternKey: "missing_article",
      category: "grammar",
      severity: "high_value",
      label: "Missing article",
      rule: "Use an article before one singular countable noun.",
      originalFragment: "add button",
      correctedFragment: "add a button",
    })

    let started:
      | { agent: string; text: string; correlationId: string }
      | undefined
    const context = invocationContext({
      agent: {
        async call() {
          return { text: '{"isTargetLanguageAttempt":true}' }
        },
        async start(input) {
          started = input
          return { callId: "usage-call" }
        },
      },
    })
    await processUserMessage({
      message: {
        id: "natural",
        text: "Add a button to the settings panel.",
        createdAt: 20,
      },
    }, context, dependencies)
    expect(started?.agent).toBe(USAGE_ANALYZER_AGENT_NAME)
    expect(started?.text).toContain("missing_article")

    const completion = {
      call: {
        callId: "usage-call",
        correlationId: started!.correlationId,
        status: "completed" as const,
        text: JSON.stringify({
          demonstrations: [{
            patternKey: "missing_article",
            fragment: "Add a button",
            confidence: 0.97,
            sensitive: false,
          }],
        }),
        startedAt: 20,
        completedAt: 21,
      },
    }
    await handleAgentCallAfter(completion, context, dependencies)
    await handleAgentCallAfter(completion, context, dependencies)
    expect(services.learning.patternDetail("en", "missing_article")?.naturalCorrectCount).toBe(1)
  })

  test("tool-first observation skips Nano but still checks other known-pattern usage", async () => {
    const { services, dependencies } = setup()
    const profile = {
      nativeLanguage: "zh-Hans",
      targetLanguage: "en",
      proficiency: "intermediate" as const,
    }
    seedCorrection(services, {
      messageId: "seed",
      scopeId: "scope-test",
      sessionId: "seed-session",
      observedAt: 10,
    }, profile, {
      patternKey: "missing_article",
      category: "grammar",
      severity: "high_value",
      label: "Missing article",
      rule: "Use an article before one singular countable noun.",
    })
    services.learning.recordObservation({
      messageId: "tool-first",
      scopeId: "scope-test",
      sessionId: "session-test",
      observedAt: 20,
    }, profile, "target_attempt", "foreground_correction")

    let classifierCalls = 0
    let usageStarts = 0
    await processUserMessage({
      message: {
        id: "tool-first",
        text: "Add a button, then update settings.",
        createdAt: 20,
      },
    }, invocationContext({
      agent: {
        async call() {
          classifierCalls++
          return { text: '{"isTargetLanguageAttempt":false}' }
        },
        async start(input) {
          expect(input.agent).toBe(USAGE_ANALYZER_AGENT_NAME)
          usageStarts++
          return { callId: "usage-tool-first" }
        },
      },
    }), dependencies)

    expect(classifierCalls).toBe(0)
    expect(usageStarts).toBe(1)
    expect(services.learning.messageObservation("tool-first", "en")).toMatchObject({
      classification: "target_attempt",
      reason: "foreground_correction",
      usageStatus: "queued",
    })
  })

  test("analyzes only the stored visible correction pair and never rewrites it", async () => {
    const { services, dependencies } = setup()
    const created = services.corrections.create({
      profile: {
        nativeLanguage: "zh-Hans",
        targetLanguage: "en",
        proficiency: "intermediate",
      },
      identity: {
        messageId: "user-message",
        scopeId: "scope-test",
        sessionId: "session-test",
        observedAt: 100,
      },
      assistantMessageId: "assistant-message",
      correction: {
        restatement: "Add a button.",
        corrections: [{ originalFragment: "add button", correctedFragment: "add a button" }],
      },
    })
    if (!created.batch) throw new Error("batch missing")
    let request:
      | { agent: string; text: string; correlationId: string }
      | undefined
    const context = invocationContext({
      agent: {
        async start(input) {
          request = input
          return { callId: "correction-call" }
        },
      },
    })
    expect(await enqueueCorrectionAnalysis(
      created.batch,
      {
        nativeLanguage: "zh-Hans",
        targetLanguage: "en",
        proficiency: "intermediate",
      },
      context,
      dependencies,
    )).toBe("queued")
    expect(request?.agent).toBe(CORRECTION_ANALYZER_AGENT_NAME)
    expect(request?.text).toBe(correctionAnalyzerRequest(
      created.batch,
      {
        nativeLanguage: "zh-Hans",
        targetLanguage: "en",
        proficiency: "intermediate",
      },
      [],
      [],
    ))
    expect(request?.text).not.toContain("Add a button.")

    await handleAgentCallAfter({
      call: {
        callId: "correction-call",
        correlationId: request!.correlationId,
        status: "completed",
        text: JSON.stringify({
          items: [{
            correctionIndex: 0,
            accepted: true,
            patternKey: "missing_article",
            category: "grammar",
            severity: "high_value",
            label: "Missing article",
            rule: "Use an article before one singular countable noun.",
            confidence: 0.98,
            sensitive: false,
          }],
        }),
        startedAt: 100,
        completedAt: 101,
      },
    }, context, dependencies)
    expect(services.corrections.byId(created.batch.id)).toMatchObject({
      status: "analyzed",
      corrections: [{
        originalFragment: "add button",
        correctedFragment: "add a button",
        patternKey: "missing_article",
        accepted: true,
      }],
    })
  })

  test("marks invalid or failed completion without throwing or creating evidence", async () => {
    const { services, dependencies } = setup()
    const created = services.corrections.create({
      profile: {
        nativeLanguage: "zh-Hans",
        targetLanguage: "en",
        proficiency: "intermediate",
      },
      identity: {
        messageId: "user-failed",
        scopeId: "scope-test",
        sessionId: "session-test",
        observedAt: 100,
      },
      assistantMessageId: "assistant-failed",
      correction: {
        restatement: "Add a panel.",
        corrections: [{ originalFragment: "add panel", correctedFragment: "add a panel" }],
      },
    })
    if (!created.batch) throw new Error("batch missing")
    await handleAgentCallAfter({
      call: {
        callId: "failed",
        correlationId: created.batch.correlationId,
        status: "completed",
        text: "not json",
        startedAt: 100,
        completedAt: 101,
      },
    }, invocationContext(), dependencies)
    expect(services.corrections.byId(created.batch.id)?.status).toBe("failed")
    expect(services.learning.patternDetail("en", "missing_article")).toBeUndefined()
  })
})

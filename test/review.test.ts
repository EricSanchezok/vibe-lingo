import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { DAY_MS, type ReviewContent } from "../src/domain/types"
import { scheduleAfterReview } from "../src/domain/schedule"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { invocationContext } from "./helpers"

const temporaryDirectories: string[] = []

function services() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-review-"))
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

const content: ReviewContent = {
  challenge: "Ask an agent to add one button.",
  hintOne: "Think about the word before a singular noun.",
  hintTwo: "Use a before button.",
  explanation: "单数可数名词前通常需要冠词。",
  referenceAnswer: "Add a button.",
  transferChallenge: "Ask an agent to create one settings panel.",
  rubric: "The singular countable noun has an appropriate article.",
}

function seedPracticing(service: ReturnType<typeof services>, now = 1_000) {
  for (let index = 0; index < 3; index++) {
    service.learning.recordAnalysis({
      messageId: `message-${index}`,
      scopeId: "scope-a",
      sessionId: index === 1 ? "session-b" : "session-a",
      observedAt: now + index,
    }, profile, true, [{
      patternKey: "missing_article",
      category: "grammar",
      severity: "high_value",
      label: "Missing article",
      rule: "Use a or the before one countable thing.",
      originalFragment: "add button",
      correctedFragment: "add a button",
      confidence: 0.98,
      sensitive: false,
    }], [])
  }
}

describe("deterministic review scheduling", () => {
  test("uses the transparent 1/3/7/14/30 day ladder", () => {
    const now = 100
    expect(scheduleAfterReview({ step: 0 }, "failed", now)).toEqual({ step: 0, dueAt: now + DAY_MS })
    expect(scheduleAfterReview({ step: 0 }, "assisted", now)).toEqual({ step: 0, dueAt: now + DAY_MS })
    expect(scheduleAfterReview({ step: 3 }, "abandoned", now)).toEqual({ step: 0, dueAt: now + DAY_MS })
    expect(scheduleAfterReview({ step: 0 }, "independent", now)).toEqual({ step: 1, dueAt: now + 3 * DAY_MS })
    expect(scheduleAfterReview({ step: 1 }, "independent", now)).toEqual({ step: 2, dueAt: now + 7 * DAY_MS })
    expect(scheduleAfterReview({ step: 4 }, "independent", now)).toEqual({ step: 4, dueAt: now + 30 * DAY_MS })
  })
})

describe("review state machine", () => {
  test("starts explicitly selected upcoming patterns without silently adding them by default", async () => {
    const service = services()
    seedPracticing(service)
    const now = 10_000
    service.database.connection().query(
      "UPDATE learning_patterns SET due_at = ? WHERE target_language = ? AND pattern_key = ?",
    ).run(now + DAY_MS, "en", "missing_article")
    const context = invocationContext({
      agent: {
        async call() {
          return { text: JSON.stringify(content) }
        },
      },
    })
    const dueOnly = await service.reviewService.start({
      profile,
      scopeId: "scope-a",
      now,
    }, context)
    expect(dueOnly).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })

    const selected = await service.reviewService.start({
      profile,
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      now,
    }, context)
    expect(selected).toMatchObject({
      ok: true,
      data: {
        totalItems: 1,
        currentItem: { patternKey: "missing_article" },
      },
    })
  })

  test("keeps answers hidden, evaluates recall and transfer, and completes idempotently", async () => {
    const service = services()
    seedPracticing(service)
    const calls: string[] = []
    const context = invocationContext({
      agent: {
        async call(input) {
          calls.push(input.agent)
          if (input.agent === "vibe-lingo-review-builder") return { text: JSON.stringify(content) }
          return {
            text: JSON.stringify({
              verdict: "correct",
              feedback: "很好。",
              naturalAnswer: input.text.includes("settings panel") ? "Create a settings panel." : "Add a button.",
              confidence: 0.98,
              sensitive: false,
            }),
          }
        },
      },
    })
    const started = await service.reviewService.start({ profile, scopeId: "scope-a" }, context)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.data.currentItem).toMatchObject({
      stage: "awaiting_response",
      challenge: content.challenge,
    })
    expect(started.data.currentItem?.referenceAnswer).toBeUndefined()

    const recall = await service.reviewService.command({
      action: "submit_answer",
      reviewId: started.data.id,
      requestId: "recall-one",
      expectedRevision: started.revision,
      answer: "Add a button.",
    }, profile, context)
    expect(recall.ok).toBe(true)
    if (!recall.ok) return
    expect(recall.data.currentItem).toMatchObject({
      stage: "awaiting_transfer",
      referenceAnswer: content.referenceAnswer,
      latestFeedback: "很好。",
    })

    const transfer = await service.reviewService.command({
      action: "submit_answer",
      reviewId: recall.data.id,
      requestId: "transfer-one",
      expectedRevision: recall.revision,
      answer: "Create a settings panel.",
    }, profile, context)
    expect(transfer.ok).toBe(true)
    if (!transfer.ok) return
    expect(transfer.data.currentItem).toMatchObject({
      stage: "item_completed",
      outcome: "independent",
    })

    const completed = await service.reviewService.command({
      action: "next_item",
      reviewId: transfer.data.id,
      requestId: "finish-review",
      expectedRevision: transfer.revision,
    }, profile, context)
    expect(completed).toMatchObject({
      ok: true,
      data: {
        status: "completed",
        summary: {
          completedPatternCount: 1,
          independentRecallCount: 1,
          assistedPatternCount: 0,
          successfulTransferCount: 1,
        },
        completedItems: [{
          patternKey: "missing_article",
          outcome: "independent",
          scheduleStep: 1,
        }],
      },
    })
    const repeated = await service.reviewService.command({
      action: "submit_answer",
      reviewId: recall.data.id,
      requestId: "transfer-one",
      expectedRevision: recall.revision,
      answer: "Create a settings panel.",
    }, profile, context)
    expect(repeated).toMatchObject({
      ok: true,
      revision: transfer.revision,
      data: {
        status: "active",
        currentItem: { stage: "item_completed", outcome: "independent" },
      },
    })
    expect(calls.filter((agent) => agent === "vibe-lingo-review-evaluator")).toHaveLength(2)
    expect(service.learning.patternDetail("en", "missing_article")?.independentReviewCount).toBe(1)
    expect(service.learning.patternEvidence("en", "missing_article").some(
      (evidence) => evidence.kind === "review_transfer" && evidence.outcome === "independent",
    )).toBe(true)
    expect(service.learning.patternReviewHistory("en", "missing_article")).toHaveLength(1)
    expect(service.learning.patternReviewHistory("en", "missing_article", 20, "scope-a")).toHaveLength(1)
    expect(service.learning.patternReviewHistory("en", "missing_article", 20, "scope-b")).toHaveLength(0)
    expect(service.learning.learningSummary("en", { now: Date.now() })).toMatchObject({
      reviewCount: 1,
      reviewRecallCountLast30Days: 1,
      independentRecallCountLast30Days: 1,
      successfulTransferCountLast30Days: 1,
      successfulTransferSessionCountLast30Days: 1,
      awaitingVerificationCount: 1,
    })
    expect(service.learning.journey({
      targetLanguage: "en",
      types: ["review_item_completed"],
      limit: 20,
    }).items).toHaveLength(1)
    const completedEvent = service.learning.journey({
      targetLanguage: "en",
      types: ["review_completed"],
      limit: 20,
    }).items[0]
    const completedRecord = service.learning.learningRecord("en", completedEvent.id)
    expect(completedRecord).toMatchObject({
      event: { reviewId: started.data.id },
      patterns: [{ patternKey: "missing_article" }],
    })
    expect(completedRecord?.evidence.map((item) => item.kind).sort())
      .toEqual(["review_recall", "review_transfer"])
    const receipts = service.database.connection()
      .query<{ state_json: string }, []>("SELECT state_json FROM review_commands")
      .all()
    expect(receipts.every((receipt) =>
      !receipt.state_json.includes("Add a button")
      && !receipt.state_json.includes("很好")
    )).toBe(true)
  })

  test("hinted success is assisted and schedules the pattern for tomorrow", () => {
    const service = services()
    seedPracticing(service)
    const state = service.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      firstContent: content,
      now: 10_000,
    })
    const hinted = service.reviews.requestHint(state.id, "hint", state.revision, 10_001)
    expect(hinted).not.toBe("conflict")
    if (!hinted || hinted === "conflict" || hinted === "invalid") return
    const recall = service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "recall",
      expectedRevision: hinted.revision,
      answer: "Add a button.",
      evaluation: {
        verdict: "correct",
        feedback: "Correct",
        naturalAnswer: "Add a button.",
        confidence: 0.99,
        sensitive: false,
      },
      now: 10_002,
      scopeId: "scope-a",
      sessionId: "review-session",
    })
    expect(recall).not.toBe("conflict")
    if (!recall || recall === "conflict" || recall === "invalid") return
    const transfer = service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "transfer",
      expectedRevision: recall.revision,
      answer: "Create a panel.",
      evaluation: {
        verdict: "correct",
        feedback: "Correct",
        naturalAnswer: "Create a panel.",
        confidence: 0.99,
        sensitive: false,
      },
      now: 10_003,
      scopeId: "scope-a",
      sessionId: "review-session",
    })
    expect(transfer).toMatchObject({ currentItem: { outcome: "assisted" } })
    const detail = service.learning.patternDetail("en", "missing_article")
    expect(detail?.dueAt).toBe(10_003 + DAY_MS)
    expect(service.learning.reviewQueue("en", 3, 10_003)).toHaveLength(0)
    if (!transfer || transfer === "conflict" || transfer === "invalid") return
    service.reviews.nextItem(state.id, "complete", transfer.revision, 10_004)
    expect(service.learning.upcomingReviewQueue("en", 3, 10_003)).toHaveLength(1)
  })

  test("records incorrect recall honestly and enforces privacy at the repository boundary", () => {
    const service = services()
    seedPracticing(service)
    const state = service.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      firstContent: content,
      now: 10_000,
    })
    expect(service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "too-uncertain",
      expectedRevision: state.revision,
      answer: "Add button.",
      evaluation: {
        verdict: "correct",
        feedback: "Maybe.",
        naturalAnswer: "Add a button.",
        confidence: 0.7,
        sensitive: false,
      },
    })).toBe("invalid")

    const result = service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "incorrect-sensitive",
      expectedRevision: state.revision,
      answer: "password=super-private-value",
      evaluation: {
        verdict: "incorrect",
        feedback: "password=private-feedback",
        naturalAnswer: "password=private-answer",
        confidence: 0.99,
        sensitive: true,
      },
      now: 10_001,
      scopeId: "scope-a",
      sessionId: "review-session",
    })
    expect(result).toMatchObject({
      currentItem: { stage: "awaiting_repair" },
    })
    expect(service.learning.patternEvidence("en", "missing_article")[0]).toMatchObject({
      kind: "review_recall",
      outcome: "incorrect",
      correctedFragment: undefined,
    })
    expect(service.database.connection().query<{
      answer: string | null
      feedback: string | null
      natural_answer: string | null
    }, []>(
      "SELECT answer, feedback, natural_answer FROM review_attempts",
    ).get()).toEqual({ answer: null, feedback: null, natural_answer: null })
  })

  test("rejects unsafe generated review content before creating a session", () => {
    const service = services()
    seedPracticing(service)
    expect(() => service.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      firstContent: {
        ...content,
        challenge: "Open https://private.example and repeat its token.",
      },
    })).toThrow("privacy validation")
    expect(service.reviews.openReview("en")).toBeUndefined()
  })

  test("supports transfer hints and rejects commands that are invalid for the current state", async () => {
    const service = services()
    seedPracticing(service)
    const state = service.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      firstContent: content,
      now: 20_000,
    })
    const recall = service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "transfer-hint-recall",
      expectedRevision: state.revision,
      answer: "Add a button.",
      evaluation: {
        verdict: "correct",
        feedback: "Correct",
        naturalAnswer: "Add a button.",
        confidence: 0.99,
        sensitive: false,
      },
      now: 20_001,
      scopeId: "scope-a",
      sessionId: "review-session",
    })
    if (!recall || recall === "conflict" || recall === "invalid") {
      throw new Error("recall failed")
    }
    const hinted = service.reviews.requestHint(
      state.id,
      "transfer-hint",
      recall.revision,
      20_002,
    )
    expect(hinted).toMatchObject({
      currentItem: {
        stage: "awaiting_transfer",
        hintLevel: 1,
        visibleHints: [content.hintOne],
      },
    })
    if (!hinted || hinted === "conflict" || hinted === "invalid") {
      throw new Error("hint failed")
    }
    const transfer = service.reviews.submitEvaluation({
      reviewId: state.id,
      requestId: "transfer-after-hint",
      expectedRevision: hinted.revision,
      answer: "Create a settings panel.",
      evaluation: {
        verdict: "correct",
        feedback: "Correct",
        naturalAnswer: "Create a settings panel.",
        confidence: 0.99,
        sensitive: false,
      },
      now: 20_003,
      scopeId: "scope-a",
      sessionId: "review-session",
    })
    expect(transfer).toMatchObject({ currentItem: { outcome: "assisted" } })

    const second = services()
    seedPracticing(second)
    const paused = second.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article"],
      firstContent: content,
    })
    const pausedState = second.reviews.setStatus(
      paused.id,
      "pause",
      paused.revision,
      "pause",
    )
    if (!pausedState || pausedState === "conflict" || pausedState === "invalid") {
      throw new Error("pause failed")
    }
    let evaluatorCalls = 0
    const invalid = await second.reviewService.command({
      action: "submit_answer",
      reviewId: paused.id,
      requestId: "paused-answer",
      expectedRevision: pausedState.revision,
      answer: "Add a button.",
    }, profile, invocationContext({
      agent: {
        async call() {
          evaluatorCalls++
          return { text: "{}" }
        },
      },
    }))
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", retryable: false },
    })
    expect(evaluatorCalls).toBe(0)
    expect(second.reviews.commandResult(paused.id, "paused-answer")).toBeUndefined()
  })

  test("abandons an open review before merging either of its patterns", () => {
    const service = services()
    seedPracticing(service)
    for (let index = 0; index < 3; index++) {
      service.learning.recordAnalysis({
        messageId: `merge-source-${index}`,
        scopeId: "scope-a",
        sessionId: index === 1 ? "merge-session-b" : "merge-session-a",
        observedAt: 2_000 + index,
      }, profile, true, [{
        patternKey: "article_alias",
        category: "grammar",
        severity: "high_value",
        label: "Article alias",
        rule: "Use an article before one countable thing.",
        originalFragment: "add panel",
        correctedFragment: "add a panel",
        confidence: 0.98,
        sensitive: false,
      }], [])
    }
    const active = service.reviews.create({
      targetLanguage: "en",
      scopeId: "scope-a",
      patternKeys: ["missing_article", "article_alias"],
      firstContent: content,
      now: 3_000,
    })

    const merged = service.learning.patternCommand("en", {
      action: "merge",
      sourceKey: "article_alias",
      targetKey: "missing_article",
    })

    expect(merged?.pattern).toMatchObject({
      patternKey: "missing_article",
      occurrenceCount: 6,
      stage: "practicing",
    })
    expect(service.reviews.openReview("en")).toBeUndefined()
    expect(service.reviews.state(active.id)).toMatchObject({
      status: "abandoned",
      totalItems: 1,
    })
    expect(service.learning.patternDetail("en", "article_alias")?.patternKey)
      .toBe("missing_article")
  })

  test("invalid review-model output leaves the database unchanged", async () => {
    const service = services()
    seedPracticing(service)
    const result = await service.reviewService.start({ profile, scopeId: "scope-a" }, invocationContext({
      agent: {
        async call() {
          return { text: "not-json" }
        },
      },
    }))
    expect(result).toMatchObject({
      ok: false,
      error: { code: "GENERATION_FAILED", retryable: true },
    })
    expect(service.reviews.openReview("en")).toBeUndefined()
  })

  test("low-confidence evaluation does not change review state or write an attempt", async () => {
    const service = services()
    seedPracticing(service)
    const context = invocationContext({
      agent: {
        async call(input) {
          if (input.agent === "vibe-lingo-review-builder") return { text: JSON.stringify(content) }
          return {
            text: JSON.stringify({
              verdict: "correct",
              feedback: "Probably correct.",
              naturalAnswer: "Add a button.",
              confidence: 0.7,
              sensitive: false,
            }),
          }
        },
      },
    })
    const started = await service.reviewService.start({
      profile,
      scopeId: "scope-a",
      patternKeys: ["missing_article", "missing_article"],
    }, context)
    expect(started).toMatchObject({ ok: true, data: { totalItems: 1 } })
    if (!started.ok) return
    const result = await service.reviewService.command({
      action: "submit_answer",
      reviewId: started.data.id,
      requestId: "uncertain",
      expectedRevision: started.revision,
      answer: "Add a button.",
    }, profile, context)
    expect(result).toMatchObject({
      ok: false,
      error: { code: "EVALUATION_FAILED", retryable: true },
    })
    expect(service.reviews.state(started.data.id)).toMatchObject({
      revision: started.revision,
      currentItem: { stage: "awaiting_response" },
    })
    const attempts = service.database.connection()
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM review_attempts")
      .get()
    expect(Number(attempts?.count)).toBe(0)
  })

  test("generates the next item lazily and commits content with the cursor in one revision", async () => {
    const service = services()
    seedPracticing(service)
    for (let index = 0; index < 3; index++) {
      service.learning.recordAnalysis({
        messageId: `word-choice-${index}`,
        scopeId: "scope-a",
        sessionId: index === 1 ? "word-session-b" : "word-session-a",
        observedAt: 2_000 + index,
      }, profile, true, [{
        patternKey: "precise_word_choice",
        category: "word_choice",
        severity: "high_value",
        label: "Precise word choice",
        rule: "Choose the word that matches the intended action.",
        originalFragment: "make the component",
        correctedFragment: "build the component",
        confidence: 0.98,
        sensitive: false,
      }], [])
    }
    let builderCalls = 0
    const context = invocationContext({
      agent: {
        async call(input) {
          if (input.agent === "vibe-lingo-review-builder") {
            builderCalls++
            return { text: JSON.stringify(content) }
          }
          return {
            text: JSON.stringify({
              verdict: "correct",
              feedback: "Correct.",
              naturalAnswer: "Add a button.",
              confidence: 0.99,
              sensitive: false,
            }),
          }
        },
      },
    })
    const started = await service.reviewService.start({
      profile,
      scopeId: "scope-a",
      patternKeys: ["missing_article", "precise_word_choice"],
      limit: 2,
      now: 3_000,
    }, context)
    if (!started.ok) throw new Error("review did not start")
    const recall = await service.reviewService.command({
      action: "submit_answer",
      reviewId: started.data.id,
      requestId: "lazy-recall",
      expectedRevision: started.revision,
      answer: "Add a button.",
    }, profile, context)
    if (!recall.ok) throw new Error("recall failed")
    const transfer = await service.reviewService.command({
      action: "submit_answer",
      reviewId: started.data.id,
      requestId: "lazy-transfer",
      expectedRevision: recall.revision,
      answer: "Create a panel.",
    }, profile, context)
    if (!transfer.ok) throw new Error("transfer failed")
    const before = service.database.connection().query<{ challenge: string | null }, [string]>(
      "SELECT challenge FROM review_items WHERE review_id = ? AND ordinal = 1",
    ).get(started.data.id)
    expect(before?.challenge).toBeNull()

    const next = await service.reviewService.command({
      action: "next_item",
      reviewId: started.data.id,
      requestId: "lazy-next",
      expectedRevision: transfer.revision,
    }, profile, context)
    expect(next).toMatchObject({
      ok: true,
      revision: transfer.revision + 1,
      data: {
        currentIndex: 1,
        currentItem: { stage: "awaiting_response", challenge: content.challenge },
      },
    })
    expect(builderCalls).toBe(2)
  })

  test("verifies only across two independent reviews, a later natural use, two Sessions, and seven days", () => {
    const service = services()
    const base = Date.UTC(2026, 0, 1)
    seedPracticing(service, base)

    function completeReview(at: number, suffix: string) {
      const state = service.reviews.create({
        targetLanguage: "en",
        scopeId: "scope-a",
        patternKeys: ["missing_article"],
        firstContent: content,
        now: at,
      })
      const recall = service.reviews.submitEvaluation({
        reviewId: state.id,
        requestId: `recall-${suffix}`,
        expectedRevision: state.revision,
        answer: "Add a button.",
        evaluation: {
          verdict: "correct",
          feedback: "Correct",
          naturalAnswer: "Add a button.",
          confidence: 0.99,
          sensitive: false,
        },
        now: at + 1,
        scopeId: "scope-a",
        sessionId: `review-session-${suffix}`,
      })
      if (!recall || recall === "conflict" || recall === "invalid") {
        throw new Error("recall failed")
      }
      const transfer = service.reviews.submitEvaluation({
        reviewId: state.id,
        requestId: `transfer-${suffix}`,
        expectedRevision: recall.revision,
        answer: "Create a panel.",
        evaluation: {
          verdict: "correct",
          feedback: "Correct",
          naturalAnswer: "Create a panel.",
          confidence: 0.99,
          sensitive: false,
        },
        now: at + 2,
        scopeId: "scope-a",
        sessionId: `review-session-${suffix}`,
      })
      if (!transfer || transfer === "conflict" || transfer === "invalid") {
        throw new Error("transfer failed")
      }
      service.reviews.nextItem(state.id, `finish-${suffix}`, transfer.revision, at + 3)
    }

    completeReview(base + DAY_MS, "one")
    completeReview(base + 8 * DAY_MS, "two")
    expect(service.learning.patternDetail("en", "missing_article")?.stage).toBe("practicing")

    service.learning.recordAnalysis({
      messageId: "natural-use",
      scopeId: "scope-b",
      sessionId: "real-session",
      observedAt: base + 9 * DAY_MS,
    }, profile, true, [], [{
      patternKey: "missing_article",
      fragment: "Add a button to the settings page.",
      confidence: 0.99,
      sensitive: false,
    }])
    expect(service.learning.patternDetail("en", "missing_article")).toMatchObject({
      stage: "verified",
      independentReviewCount: 2,
      naturalCorrectCount: 1,
      dueAt: undefined,
    })

    service.learning.recordAnalysis({
      messageId: "lapse",
      scopeId: "scope-b",
      sessionId: "real-session-two",
      observedAt: base + 10 * DAY_MS,
    }, profile, true, [{
      patternKey: "missing_article",
      category: "grammar",
      severity: "high_value",
      label: "Missing article",
      rule: "Use a or the before one countable thing.",
      originalFragment: "add button",
      correctedFragment: "add a button",
      confidence: 0.99,
      sensitive: false,
    }], [])
    expect(service.learning.patternDetail("en", "missing_article")).toMatchObject({
      stage: "practicing",
      dueAt: base + 11 * DAY_MS,
    })
  })
})

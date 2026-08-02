import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { SCHEMA_VERSION, VibeLingoDatabase } from "../src/infrastructure/database"
import type { MessageIdentity } from "../src/domain/types"
import { seedCorrection } from "./helpers"

const temporaryDirectories: string[] = []

function services() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-storage-"))
  temporaryDirectories.push(directory)
  const filename = path.join(directory, "vibe-lingo.sqlite")
  return {
    filename,
    service: createServices(new VibeLingoDatabase(filename)),
  }
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

function identity(index: number, overrides: Partial<MessageIdentity> = {}): MessageIdentity {
  return {
    messageId: `message-${index}`,
    scopeId: "scope-a",
    sessionId: index % 2 ? "session-a" : "session-b",
    observedAt: 1_000 + index,
    ...overrides,
  }
}

const articleFinding = {
  patternKey: "missing_article",
  category: "grammar" as const,
  severity: "high_value" as const,
  label: "Missing article",
  rule: "Use an article before one singular countable noun.",
  originalFragment: "add button",
  correctedFragment: "add a button",
  confidence: 0.98,
  sensitive: false,
}

describe("current destructive schema", () => {
  test("creates one current schema with WAL, foreign keys, and a busy timeout", () => {
    const { service } = services()
    const db = service.database.connection()
    expect(db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version).toBe(SCHEMA_VERSION)
    expect(db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode).toBe("wal")
    expect(db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1)
    expect(db.query<{ timeout: number }, []>("PRAGMA busy_timeout").get()?.timeout).toBe(5_000)
  })

  test("replaces every non-current database instead of migrating legacy data", () => {
    const { filename, service } = services()
    service.database.close()
    fs.rmSync(filename, { force: true })
    const legacy = new Database(filename, { create: true })
    legacy.exec(
      "CREATE TABLE legacy_messages (body TEXT); INSERT INTO legacy_messages VALUES ('private message'); PRAGMA user_version = 2",
    )
    legacy.close()

    service.database.initialize()
    const db = service.database.connection()
    expect(
      db
        .query<
          { present: number },
          []
        >("SELECT COUNT(*) AS present FROM sqlite_master WHERE type='table' AND name='legacy_messages'")
        .get()?.present,
    ).toBe(0)
    expect(db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version).toBe(SCHEMA_VERSION)
  })

  test("recreates a version-matching database when required structure is missing", () => {
    const { filename, service } = services()
    const current = service.database.connection()
    current.exec("INSERT INTO learning_profiles VALUES ('en', 'zh-Hans', 'intermediate', 1, 1, 0)")
    current.exec("DROP INDEX corrections_status_time")
    service.database.close()

    service.database.initialize()
    const rebuilt = service.database.connection()
    expect(rebuilt.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM learning_profiles").get()?.count).toBe(0)
    expect(
      rebuilt
        .query<{ count: number }, []>(
          `SELECT COUNT(*) AS count FROM sqlite_master
       WHERE type='index' AND name='corrections_status_time'`,
        )
        .get()?.count,
    ).toBe(1)
    expect(fs.existsSync(filename)).toBe(true)
  })
})

describe("activity, corrections, and evidence convergence", () => {
  test("keeps target-language activity without inventing a pattern", () => {
    const { service } = services()
    for (let index = 0; index < 5; index++) {
      service.learning.recordObservation(identity(index), profile, "target_attempt", "target_attempt")
    }
    const summary = service.learning.learningSummary("en", {
      now: 2_000,
      timeZone: "UTC",
    })
    expect(summary).toMatchObject({
      analyzedMessages: 5,
      targetAttempts: 5,
      totalPatternCount: 0,
    })
  })

  test("a foreground correction is authoritative over a later not-target classification", () => {
    const { service } = services()
    const message = identity(1)
    service.learning.recordObservation(message, profile, "target_attempt", "foreground_correction")
    service.learning.recordObservation(message, profile, "not_target", "not_target_language")
    const row = service.database
      .connection()
      .query<
        {
          classification: string
          reason: string
        },
        []
      >("SELECT classification, reason FROM message_observations")
      .get()
    expect(row).toEqual({
      classification: "target_attempt",
      reason: "foreground_correction",
    })
  })

  test("stores the visible correction once without storing its restatement", () => {
    const { service } = services()
    const message = identity(1)
    const input = {
      restatement: "Please add a button.",
      corrections: [
        {
          originalFragment: "add button",
          correctedFragment: "add a button",
        },
      ],
    }
    const first = service.corrections.create({
      profile,
      identity: message,
      assistantMessageId: "assistant-one",
      correction: input,
    })
    const duplicate = service.corrections.create({
      profile,
      identity: message,
      assistantMessageId: "assistant-one",
      correction: input,
    })
    const conflict = service.corrections.create({
      profile,
      identity: message,
      assistantMessageId: "assistant-one",
      correction: {
        ...input,
        corrections: [{ originalFragment: "add panel", correctedFragment: "add a panel" }],
      },
    })
    expect(first.kind).toBe("created")
    expect(duplicate.kind).toBe("existing")
    expect(conflict.kind).toBe("conflict")
    expect(
      service.database
        .connection()
        .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM correction_batches")
        .get()?.count,
    ).toBe(1)
    const schema =
      service.database
        .connection()
        .query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE name='correction_batches'")
        .get()?.sql ?? ""
    expect(schema).not.toContain("restatement")
    expect(JSON.stringify(service.database.connection().query("SELECT * FROM correction_batches").all())).not.toContain(
      "Please add a button",
    )
  })

  test("reports unresolved correction analysis across history while keeping today counts local", () => {
    const { service } = services()
    const correction = {
      restatement: "Please add a button.",
      corrections: [{ originalFragment: "add button", correctedFragment: "add a button" }],
    }
    const pending = service.corrections.create({
      profile,
      identity: identity(1),
      assistantMessageId: "assistant-pending",
      correction,
    })
    const failed = service.corrections.create({
      profile,
      identity: identity(2),
      assistantMessageId: "assistant-failed",
      correction,
    })
    if (!pending.batch || !failed.batch) throw new Error("correction batch missing")
    service.corrections.failAnalysisAttempt({
      batchId: failed.batch.id,
      scopeId: failed.batch.scopeId,
      correlationId: failed.batch.correlationId,
    })

    expect(
      service.learning.learningSummary("en", {
        now: 10 * 86_400_000,
        timeZone: "UTC",
      }),
    ).toMatchObject({
      correctionsToday: 0,
      correctionsAnalyzing: 1,
      correctionsFailed: 1,
    })
  })

  test("creates candidate evidence once and promotes high-value patterns only across sessions", () => {
    const { service } = services()
    seedCorrection(service, identity(1, { sessionId: "session-a" }), profile, articleFinding)
    seedCorrection(service, identity(2, { sessionId: "session-a" }), profile, articleFinding)
    expect(service.learning.patternDetail("en", "missing_article")?.stage).toBe("candidate")
    seedCorrection(service, identity(3, { sessionId: "session-b" }), profile, articleFinding)
    expect(service.learning.patternDetail("en", "missing_article")).toMatchObject({
      stage: "practicing",
      occurrenceCount: 3,
    })

    const batch = service.corrections.byAssistantMessage("en", "assistant-message-3")
    if (!batch) throw new Error("seeded correction missing")
    expect(service.learning.recordCorrectionAnalysis(batch.id, { items: [] })).toBe(false)
    expect(service.learning.patternDetail("en", "missing_article")?.occurrenceCount).toBe(3)
  })

  test("lets correction evidence win regardless of usage completion order", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, articleFinding)

    const message = identity(2)
    service.learning.recordObservation(message, profile, "target_attempt", "target_attempt")
    service.learning.markUsageQueued("en", message.messageId, "usage:en:message-2", "usage-call")
    service.learning.recordUsageAnalysis(
      message,
      profile,
      [
        {
          patternKey: "missing_article",
          fragment: "Add a button.",
          confidence: 0.99,
          sensitive: false,
        },
      ],
      "usage:en:message-2",
    )
    seedCorrection(service, message, profile, articleFinding)

    const rows = service.database
      .connection()
      .query<{ kind: string }, []>(
        `SELECT kind FROM pattern_evidence
       WHERE target_language='en' AND pattern_key='missing_article' AND user_message_id='message-2'`,
      )
      .all()
    expect(rows).toEqual([{ kind: "error" }])

    service.learning.recordUsageAnalysis(
      message,
      profile,
      [
        {
          patternKey: "missing_article",
          fragment: "Add a button.",
          confidence: 0.99,
          sensitive: false,
        },
      ],
      "usage:en:message-2",
    )
    expect(
      service.database
        .connection()
        .query<{ count: number }, []>(
          `SELECT COUNT(*) AS count FROM pattern_evidence
       WHERE user_message_id='message-2'`,
        )
        .get()?.count,
    ).toBe(1)
  })

  test("retains only five concrete correction pairs per pattern", () => {
    const { service } = services()
    for (let index = 0; index < 7; index++) {
      seedCorrection(service, identity(index), profile, {
        ...articleFinding,
        originalFragment: `add button ${index}`,
        correctedFragment: `add a button ${index}`,
      })
    }
    const rows = service.database
      .connection()
      .query<
        {
          original_fragment: string | null
          corrected_fragment: string | null
        },
        []
      >(
        `SELECT ci.original_fragment, ci.corrected_fragment
       FROM correction_items ci
       JOIN correction_batches cb ON cb.id=ci.batch_id
       WHERE ci.pattern_key='missing_article'
       ORDER BY cb.created_at DESC`,
      )
      .all()
    expect(rows.filter((row) => row.original_fragment || row.corrected_fragment)).toHaveLength(5)
  })

  test("sanitizes sensitive correction pairs and leaves no duplicate error fragment in evidence", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, {
      ...articleFinding,
      originalFragment: "open https://private.example.com/token",
      correctedFragment: "open the private URL",
      sensitive: true,
    })
    const item = service.database
      .connection()
      .query<
        {
          original_fragment: string | null
          corrected_fragment: string | null
        },
        []
      >("SELECT original_fragment, corrected_fragment FROM correction_items")
      .get()
    expect(item).toEqual({ original_fragment: null, corrected_fragment: null })
    const evidence = service.database
      .connection()
      .query<
        {
          original_fragment: string | null
          corrected_fragment: string | null
        },
        []
      >("SELECT original_fragment, corrected_fragment FROM pattern_evidence")
      .get()
    expect(evidence).toEqual({
      original_fragment: null,
      corrected_fragment: null,
    })
  })

  test("rejects metadata when the visible correction is not in the target script", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, {
      ...articleFinding,
      originalFragment: "添加按钮",
      correctedFragment: "添加一个按钮",
    })
    expect(service.learning.patternDetail("en", "missing_article")).toBeUndefined()
    expect(service.corrections.byAssistantMessage("en", "assistant-message-1")?.corrections[0]).toMatchObject({
      accepted: false,
    })
  })

  test("keeps visible correction history aligned with merge, not-error, and delete commands", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, articleFinding)
    seedCorrection(service, identity(2), profile, {
      ...articleFinding,
      patternKey: "article_alias",
    })

    service.learning.patternCommand("en", {
      action: "merge",
      sourceKey: "article_alias",
      targetKey: "missing_article",
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-2")?.corrections[0]).toMatchObject({
      patternKey: "missing_article",
      accepted: true,
    })

    service.learning.patternCommand("en", {
      action: "not_error",
      patternKey: "missing_article",
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-1")?.corrections[0]).toMatchObject({
      accepted: false,
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-1")?.corrections[0]).not.toHaveProperty(
      "patternKey",
    )

    seedCorrection(service, identity(3), profile, {
      ...articleFinding,
      patternKey: "temporary_pattern",
    })
    service.learning.patternCommand("en", {
      action: "delete",
      patternKey: "temporary_pattern",
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-3")?.corrections[0]).toMatchObject({
      accepted: false,
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-3")?.corrections[0]).not.toHaveProperty(
      "patternKey",
    )
  })

  test("does not accumulate new pattern evidence while a pattern is ignored", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, articleFinding)
    service.learning.patternCommand("en", {
      action: "ignore",
      patternKey: "missing_article",
    })
    seedCorrection(service, identity(2), profile, articleFinding)

    expect(service.learning.patternDetail("en", "missing_article")).toMatchObject({
      disposition: "ignored",
      occurrenceCount: 1,
    })
    expect(service.corrections.byAssistantMessage("en", "assistant-message-2")?.corrections[0]).toMatchObject({
      accepted: false,
    })
  })
})

describe("retry and cleanup invariants", () => {
  test("does not retry a freshly queued correction until the grace period expires", () => {
    const { service } = services()
    const created = service.corrections.create({
      profile,
      identity: identity(1),
      assistantMessageId: "assistant",
      correction: {
        restatement: "Add a button.",
        corrections: [{ originalFragment: "add button", correctedFragment: "add a button" }],
      },
    })
    if (!created.batch) throw new Error("batch missing")
    const claimed = service.corrections.claimAnalysisAttempt({
      batchId: created.batch.id,
      scopeId: created.batch.scopeId,
      expectedCorrelationId: created.batch.correlationId,
      correlationId: created.batch.correlationId,
      now: 10_000,
    })
    if (!claimed) throw new Error("correction batch was not claimed")
    service.corrections.attachAnalysisCall({
      batchId: created.batch.id,
      scopeId: created.batch.scopeId,
      correlationId: created.batch.correlationId,
      callId: "call",
    })
    expect(service.corrections.retryable(20_000, 30_000)).toBeUndefined()
    expect(service.corrections.retryable(40_001, 30_000)?.id).toBe(created.batch.id)
  })

  test("claims one stale correction attempt atomically and rotates its correlation", () => {
    const { service } = services()
    const created = service.corrections.create({
      profile,
      identity: identity(1),
      assistantMessageId: "assistant-claim",
      correction: {
        restatement: "Add a button.",
        corrections: [{ originalFragment: "add button", correctedFragment: "add a button" }],
      },
    })
    if (!created.batch) throw new Error("batch missing")
    const initiallyClaimed = service.corrections.claimAnalysisAttempt({
      batchId: created.batch.id,
      scopeId: created.batch.scopeId,
      expectedCorrelationId: created.batch.correlationId,
      correlationId: created.batch.correlationId,
      now: 10_000,
    })
    if (!initiallyClaimed) throw new Error("correction batch was not claimed")
    service.corrections.attachAnalysisCall({
      batchId: created.batch.id,
      scopeId: created.batch.scopeId,
      correlationId: created.batch.correlationId,
      callId: "orphaned-call",
    })

    expect(
      service.corrections.claimAnalysisAttempt({
        batchId: created.batch.id,
        scopeId: "scope-a",
        expectedCorrelationId: created.batch.correlationId,
        correlationId: "correction:retry:one",
        now: 20_000,
        queuedGraceMs: 30_000,
      }),
    ).toBeUndefined()

    expect(
      service.corrections.claimAnalysisAttempt({
        batchId: created.batch.id,
        scopeId: "scope-a",
        expectedCorrelationId: created.batch.correlationId,
        correlationId: "correction:retry:one",
        now: 40_001,
        queuedGraceMs: 30_000,
      }),
    ).toMatchObject({
      status: "queued",
      correlationId: "correction:retry:one",
      queuedAt: 40_001,
    })
    expect(service.corrections.byId(created.batch.id)).not.toHaveProperty("callId")

    expect(
      service.corrections.claimAnalysisAttempt({
        batchId: created.batch.id,
        scopeId: "scope-a",
        expectedCorrelationId: created.batch.correlationId,
        correlationId: "correction:retry:two",
        now: 40_001,
        queuedGraceMs: 30_000,
      }),
    ).toBeUndefined()
  })

  test("clears one language transactionally without touching another namespace", () => {
    const { service } = services()
    seedCorrection(service, identity(1), profile, articleFinding)
    const spanish = { ...profile, nativeLanguage: "en", targetLanguage: "es" }
    seedCorrection(service, identity(1), spanish, {
      ...articleFinding,
      patternKey: "spanish_article",
      originalFragment: "añade botón",
      correctedFragment: "añade un botón",
    })
    const result = service.learning.clearLearningData({
      scope: "target",
      targetLanguage: "en",
    })
    expect(result.deletedPatterns).toBe(1)
    expect(service.learning.patternDetail("en", "missing_article")).toBeUndefined()
    expect(service.learning.patternDetail("es", "spanish_article")).toBeDefined()
    expect(
      service.database
        .connection()
        .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM correction_batches WHERE target_language='en'`)
        .get()?.count,
    ).toBe(0)
  })
})

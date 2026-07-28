import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "fs"
import os from "os"
import path from "path"
import { DAY_MS, type MessageIdentity, type StoredFinding } from "../src/domain/types"
import { SCHEMA_VERSION, VibeLingoDatabase } from "../src/infrastructure/database"
import { LearningRepository } from "../src/infrastructure/learning-repository"

const temporaryDirectories: string[] = []

function repository(): { learning: LearningRepository; filename: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-storage-"))
  temporaryDirectories.push(directory)
  const filename = path.join(directory, "vibe-lingo.sqlite")
  return { learning: new LearningRepository(new VibeLingoDatabase(filename)), filename }
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

const finding: StoredFinding = {
  patternKey: "missing_article",
  category: "grammar",
  severity: "high_value",
  label: "Missing article",
  rule: "Use a or the for one countable thing.",
  originalFragment: "add button",
  correctedFragment: "add a button",
  confidence: 0.95,
  sensitive: false,
}

function identity(index: number, overrides: Partial<MessageIdentity> = {}): MessageIdentity {
  return {
    messageId: `message-${index}`,
    scopeId: index % 2 ? "scope-a" : "scope-b",
    sessionId: index % 2 ? "session-a" : "session-b",
    observedAt: 1_000 + index,
    ...overrides,
  }
}

describe("vNext learning repository", () => {
  test("destructively replaces a legacy schema instead of carrying migration code", () => {
    const { learning, filename } = repository()
    const legacy = new Database(filename, { create: true })
    legacy.exec(`
      CREATE TABLE error_patterns(pattern_key TEXT);
      INSERT INTO error_patterns VALUES ('legacy');
      PRAGMA user_version = 2;
    `)
    legacy.close()
    learning.initialize()
    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version)).toBe(
      SCHEMA_VERSION,
    )
    expect(raw.query("SELECT name FROM sqlite_master WHERE name = 'error_patterns'").get()).toBeNull()
    expect(raw.query("SELECT COUNT(*) AS count FROM learning_patterns").get()).toEqual({ count: 0 })
    raw.close()
  })

  test("repairs an incomplete database even when its version marker looks current", () => {
    const { learning, filename } = repository()
    const malformed = new Database(filename, { create: true })
    malformed.exec(`CREATE TABLE placeholder(value TEXT); PRAGMA user_version = ${SCHEMA_VERSION};`)
    malformed.close()
    learning.initialize()
    const tables = learning.database.connection()
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      )
      .all()
      .map((row) => row.name)
    expect(tables).toContain("review_commands")
    expect(tables).toContain("learning_events")
    expect(tables).not.toContain("placeholder")
  })

  test("preserves current-schema data across overlapping generation initialization", () => {
    const { learning, filename } = repository()
    learning.rememberProfile(profile, 1_000)

    const overlapping = new LearningRepository(new VibeLingoDatabase(filename))
    overlapping.initialize()
    expect(overlapping.profileList()).toEqual([
      expect.objectContaining({ targetLanguage: "en", firstUsedAt: 1_000 }),
    ])
    overlapping.close()
  })

  test("rebuilds a current-version database when a required index is missing", () => {
    const { learning, filename } = repository()
    learning.rememberProfile(profile, 1_000)
    learning.close()
    const damaged = new Database(filename)
    damaged.exec("DROP INDEX analyzed_scope_time")
    damaged.close()

    const repaired = new LearningRepository(new VibeLingoDatabase(filename))
    repaired.initialize()
    expect(repaired.profileList()).toEqual([])
    const indexes = repaired.database.connection()
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      )
      .all()
      .map((row) => row.name)
    expect(indexes).toContain("analyzed_scope_time")
    repaired.close()
  })

  test("deduplicates messages and promotes only after three errors in two Sessions", () => {
    const { learning } = repository()
    expect(learning.recordAnalysis(identity(1), profile, true, [finding], [])).toBe(true)
    expect(learning.recordAnalysis(identity(1), profile, true, [finding], [])).toBe(false)
    expect(learning.recurringPatterns("en")).toEqual([])
    learning.recordAnalysis(identity(2), profile, true, [finding], [])
    learning.recordAnalysis(identity(3), profile, true, [finding], [])
    expect(learning.recurringPatterns("en")[0]).toMatchObject({
      patternKey: "missing_article",
      occurrenceCount: 3,
      sessionCount: 2,
    })
    expect(learning.reviewQueue("en", 3, 2_000)[0]).toMatchObject({
      patternKey: "missing_article",
    })
  })

  test("records known-pattern demonstrations but rejects unknown or conflicting ones", () => {
    const { learning } = repository()
    learning.recordAnalysis(identity(1), profile, true, [finding], [])
    learning.recordAnalysis(identity(2), profile, true, [], [
      { patternKey: "missing_article", fragment: "add a button", confidence: 0.95, sensitive: false },
      { patternKey: "unknown_pattern", fragment: "valid", confidence: 0.99, sensitive: false },
    ])
    learning.recordAnalysis(identity(3), profile, true, [finding], [
      { patternKey: "missing_article", fragment: "add a card", confidence: 0.99, sensitive: false },
    ])
    const detail = learning.patternDetail("en", "missing_article")
    expect(detail).toMatchObject({ occurrenceCount: 2, naturalCorrectCount: 1 })
  })

  test("enforces confidence, privacy, and target-attempt invariants at the repository boundary", () => {
    const { learning, filename } = repository()
    learning.recordAnalysis(identity(1), profile, false, [finding], [])
    learning.recordAnalysis(identity(2), profile, true, [{ ...finding, confidence: 0.4 }], [])
    learning.recordAnalysis(identity(3), profile, true, [{
      ...finding,
      originalFragment: "password=should-not-be-stored",
      correctedFragment: "password=still-private",
      sensitive: true,
    }], [])
    learning.recordAnalysis(identity(4), profile, true, [{
      ...finding,
      patternKey: "private_metadata",
      label: "password=should-not-be-metadata",
    }, {
      ...finding,
      patternKey: "INVALID KEY",
    }], [])
    expect(learning.patternDetail("en", "missing_article")?.occurrenceCount).toBe(1)
    expect(learning.patternDetail("en", "private_metadata")).toBeUndefined()
    learning.close()
    const raw = new Database(filename, { readonly: true })
    expect(raw.query<{
      original_fragment: string | null
      corrected_fragment: string | null
    }, []>(
      "SELECT original_fragment, corrected_fragment FROM pattern_evidence",
    ).get()).toEqual({ original_fragment: null, corrected_fragment: null })
    raw.close()
  })

  test("retains only five content-bearing evidence rows while preserving counts", () => {
    const { learning, filename } = repository()
    for (let index = 0; index < 7; index++) {
      learning.recordAnalysis(identity(index), profile, true, [{
        ...finding,
        originalFragment: `add button ${index}`,
        correctedFragment: `add a button ${index}`,
      }], [])
    }
    expect(learning.patternDetail("en", "missing_article")?.occurrenceCount).toBe(7)
    learning.close()
    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM pattern_evidence WHERE original_fragment IS NOT NULL",
    ).get()?.count)).toBe(5)
    raw.close()
  })

  test("keeps target languages isolated and supports target/all cleanup", () => {
    const { learning } = repository()
    learning.recordAnalysis(identity(1), profile, true, [finding], [])
    learning.recordAnalysis(identity(1), { ...profile, nativeLanguage: "en", targetLanguage: "es" }, true, [{
      ...finding,
      originalFragment: "añade botón",
      correctedFragment: "añade un botón",
    }], [])
    expect(learning.learningSummary("en").targetAttempts).toBe(1)
    expect(learning.learningSummary("es").targetAttempts).toBe(1)
    expect(learning.clearLearningData({ scope: "target", targetLanguage: "es" })).toMatchObject({
      deletedMessages: 1,
      deletedOccurrences: 1,
      deletedPatterns: 1,
    })
    expect(learning.learningSummary("en").targetAttempts).toBe(1)
    expect(learning.clearLearningData({ scope: "all" }).deletedMessages).toBe(1)
  })

  test("uses evidence rather than error counts for active days and trend curves", () => {
    const { learning } = repository()
    const now = Date.UTC(2026, 6, 28, 12)
    learning.recordAnalysis(identity(1, { observedAt: now - DAY_MS }), profile, true, [], [])
    learning.recordAnalysis(identity(2, { observedAt: now }), profile, true, [finding], [])
    learning.recordAnalysis(identity(3, { observedAt: now }), profile, false, [], [])
    const summary = learning.learningSummary("en", { now, timeZone: "UTC" })
    expect(summary).toMatchObject({
      analyzedMessages: 3,
      targetAttempts: 2,
      activeDays: 2,
      findingsLast30Days: 1,
    })
    expect(summary.trends["7"].reduce((sum, point) => sum + point.targetAttempts, 0)).toBe(2)
  })

  test("buckets activity by IANA timezone across a daylight-saving boundary", () => {
    const { learning } = repository()
    const beforeMidnight = Date.UTC(2026, 2, 8, 4, 30)
    const afterMidnight = Date.UTC(2026, 2, 8, 5, 30)
    learning.recordAnalysis(identity(1, { observedAt: beforeMidnight }), profile, true, [], [])
    learning.recordAnalysis(identity(2, { observedAt: afterMidnight }), profile, true, [], [])
    const summary = learning.learningSummary("en", {
      now: Date.UTC(2026, 2, 10, 12),
      timeZone: "America/New_York",
    })
    expect(summary.activeDays).toBe(2)
    expect(summary.trends["7"].map((point) => point.date)).toHaveLength(7)
    expect(new Set(summary.trends["7"].map((point) => point.date)).size).toBe(7)
  })

  test("keeps an unbroken streak active until the next local day is missed", () => {
    const { learning } = repository()
    const now = Date.UTC(2026, 6, 28, 12)
    learning.recordAnalysis(identity(1, { observedAt: now - 2 * DAY_MS }), profile, true, [], [])
    learning.recordAnalysis(identity(2, { observedAt: now - DAY_MS }), profile, true, [], [])
    expect(learning.learningSummary("en", { now, timeZone: "UTC" }).currentStreakDays).toBe(2)
    expect(learning.learningSummary("en", {
      now: now + DAY_MS,
      timeZone: "UTC",
    }).currentStreakDays).toBe(0)
  })

  test("keeps journey practice events at Session granularity", () => {
    const { learning } = repository()
    learning.recordAnalysis(identity(1, {
      scopeId: "scope-a",
      sessionId: "shared-session",
    }), profile, true, [], [])
    learning.recordAnalysis(identity(2, {
      scopeId: "scope-a",
      sessionId: "shared-session",
    }), profile, true, [], [])
    learning.recordAnalysis(identity(3, {
      scopeId: "scope-a",
      sessionId: "other-session",
    }), profile, true, [], [])
    const journey = learning.journey({ targetLanguage: "en", limit: 20 })
    expect(journey.items.filter((event) => event.type === "practice_started")).toHaveLength(2)
    expect(learning.learningSummary("en").targetAttempts).toBe(3)
  })

  test("supports the journey filters and record detail required by the product screens", () => {
    const { learning } = repository()
    const first = identity(1, {
      scopeId: "scope-a",
      sessionId: "shared-session",
      observedAt: 10_000,
    })
    learning.recordAnalysis(first, profile, true, [finding], [])
    learning.recordAnalysis(identity(2, {
      scopeId: "scope-a",
      sessionId: "shared-session",
      observedAt: 11_000,
    }), profile, true, [], [])
    const page = learning.journey({
      targetLanguage: "en",
      types: ["practice_started"],
      from: 9_000,
      to: 12_000,
      limit: 20,
    })
    expect(page.items).toHaveLength(1)
    const record = learning.learningRecord("en", page.items[0].id)
    expect(record?.sessionSummary).toMatchObject({
      analyzedMessages: 2,
      targetAttempts: 2,
      findings: 1,
      discoveredPatterns: 1,
    })
    expect(record?.evidence).toHaveLength(1)
    expect(record?.patterns[0]).toMatchObject({ patternKey: "missing_article" })
    expect(learning.journey({
      targetLanguage: "en",
      types: ["pattern_verified"],
      limit: 20,
    }).items).toEqual([])
  })

  test("ignore, reject, delete, and merge follow distinct lifecycle semantics", () => {
    const { learning } = repository()
    learning.recordAnalysis(identity(1), profile, true, [finding], [])
    learning.recordAnalysis(identity(2), profile, true, [{
      ...finding,
      patternKey: "article_alias",
      label: "Article alias",
    }], [])
    expect(learning.patternCommand("en", { action: "ignore", patternKey: "missing_article" })?.pattern)
      .toMatchObject({ disposition: "ignored" })
    expect(learning.listPatterns({ targetLanguage: "en", limit: 20 }).items)
      .not.toContainEqual(expect.objectContaining({ patternKey: "missing_article" }))
    expect(learning.listPatterns({ targetLanguage: "en", status: "ignored", limit: 20 }).items)
      .toContainEqual(expect.objectContaining({ patternKey: "missing_article" }))
    expect(learning.patternCommand("en", { action: "restore", patternKey: "missing_article" })?.pattern)
      .toMatchObject({ disposition: "active" })
    learning.patternCommand("en", {
      action: "merge",
      sourceKey: "article_alias",
      targetKey: "missing_article",
    })
    expect(learning.patternDetail("en", "article_alias")?.occurrenceCount).toBe(2)
    learning.patternCommand("en", { action: "not_error", patternKey: "missing_article" })
    expect(learning.suppressedKeys("en")).toContain("missing_article")
    expect(learning.patternDetail("en", "missing_article")?.occurrenceCount).toBe(0)
    learning.patternCommand("en", { action: "delete", patternKey: "missing_article" })
    expect(learning.patternDetail("en", "missing_article")).toBeUndefined()
  })

  test("uses stable keyset cursors for every pattern sort and filters current Scope", () => {
    const { learning } = repository()
    const keys = ["alpha_pattern", "beta_pattern", "gamma_pattern", "delta_pattern"]
    keys.forEach((patternKey, patternIndex) => {
      for (let occurrence = 0; occurrence < 3; occurrence++) {
        learning.recordAnalysis(identity(
          100 + patternIndex * 10 + occurrence,
          {
            scopeId: patternKey === "delta_pattern" ? "scope-b" : "scope-a",
            sessionId: occurrence === 1 ? `session-${patternKey}-b` : `session-${patternKey}-a`,
            observedAt: 10_000 + patternIndex * 100 + occurrence,
          },
        ), profile, true, [{
          ...finding,
          patternKey,
          label: patternKey,
        }], [])
      }
    })

    for (const sort of ["priority", "recent", "frequency", "due"] as const) {
      const seen: string[] = []
      let cursor: string | undefined
      do {
        const page = learning.listPatterns({
          targetLanguage: "en",
          sort,
          cursor,
          limit: 2,
          now: 20_000,
        })
        seen.push(...page.items.map((item) => item.patternKey))
        cursor = page.nextCursor
      } while (cursor)
      expect(new Set(seen).size).toBe(4)
      expect(seen).toHaveLength(4)
    }

    const current = learning.listPatterns({
      targetLanguage: "en",
      scopeId: "scope-a",
      limit: 20,
    })
    expect(current.items.map((item) => item.patternKey)).not.toContain("delta_pattern")
    expect(learning.listPatterns({
      targetLanguage: "en",
      status: "focus",
      limit: 20,
      now: 20_000,
    }).items).toHaveLength(4)
    expect(() => learning.listPatterns({
      targetLanguage: "en",
      cursor: "not-a-cursor",
      limit: 20,
    })).toThrow("Invalid cursor")
  })
})

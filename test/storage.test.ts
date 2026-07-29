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

const v1Schema = `
  CREATE TABLE analyzed_messages (
    message_id TEXT PRIMARY KEY,
    scope_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    analyzed_at INTEGER NOT NULL,
    result TEXT NOT NULL
  );

  CREATE TABLE error_patterns (
    target_language TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    rule TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    occurrence_count INTEGER NOT NULL,
    PRIMARY KEY (target_language, pattern_key)
  );

  CREATE TABLE error_occurrences (
    id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    target_language TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    original_fragment TEXT,
    corrected_fragment TEXT,
    confidence REAL NOT NULL,
    scope_id TEXT,
    session_id TEXT,
    severity TEXT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (message_id, pattern_key)
  );
`

const v2Schema = `
  CREATE TABLE analyzed_messages (
    target_language TEXT NOT NULL,
    message_id TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    analyzed_at INTEGER NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (target_language, message_id)
  );

  CREATE TABLE error_patterns (
    target_language TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    rule TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    occurrence_count INTEGER NOT NULL,
    PRIMARY KEY (target_language, pattern_key)
  );

  CREATE TABLE error_occurrences (
    id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    target_language TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    original_fragment TEXT,
    corrected_fragment TEXT,
    confidence REAL NOT NULL,
    scope_id TEXT,
    session_id TEXT,
    severity TEXT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (message_id, pattern_key, target_language)
  );
`

describe("schema migration", () => {
  test("fresh empty database creates current schema", () => {
    const { learning, filename } = repository()
    learning.initialize()
    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version)).toBe(
      SCHEMA_VERSION,
    )
    const tables = raw.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    ).all().map((r) => r.name)
    expect(tables).toContain("learning_profiles")
    expect(tables).toContain("learning_patterns")
    expect(tables).toContain("pattern_evidence")
    expect(tables).toContain("review_sessions")
    expect(tables).toContain("learning_events")
    raw.close()
  })

  test("migrates v1 schema preserving messages, patterns, and occurrences", () => {
    const { filename } = repository()
    const legacy = new Database(filename, { create: true })
    legacy.exec(v1Schema)
    legacy.exec(`
      INSERT INTO analyzed_messages (message_id, scope_id, session_id, analyzed_at, result)
      VALUES ('msg1', 's1', 'session1', 1000, 'findings'),
             ('msg2', 's1', 'session1', 1100, 'no_findings'),
             ('msg3', 's2', 'session2', 1200, 'skipped');
      INSERT INTO error_patterns (target_language, pattern_key, category, label, rule,
                                   first_seen_at, last_seen_at, occurrence_count)
      VALUES ('en', 'missing_article', 'grammar', 'Missing article',
              'Use a or the', 1000, 1000, 1),
             ('en', 'spelling_error', 'spelling', 'Spelling',
              'Check spelling', 1000, 1100, 2);
      INSERT INTO error_occurrences (id, message_id, pattern_key, target_language,
                                      observed_at, original_fragment, corrected_fragment,
                                      confidence, severity, scope_id, session_id)
      VALUES ('e1', 'msg1', 'missing_article', 'en', 1000, 'a cat', 'the cat', 0.95, 'high_value', 's1', 'session1'),
             ('e2', 'msg1', 'spelling_error', 'en', 1000, 'recieve', 'receive', 0.99, 'high_value', 's1', 'session1'),
             ('e3', 'msg2', 'spelling_error', 'en', 1100, 'wierd', 'weird', 0.97, 'high_value', 's1', 'session1');
      PRAGMA user_version = 1;
    `)
    legacy.close()

    const learning = new LearningRepository(new VibeLingoDatabase(filename))
    learning.initialize()

    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version)).toBe(
      SCHEMA_VERSION,
    )
    expect(raw.query("SELECT name FROM sqlite_master WHERE name = 'error_patterns'").get()).toBeNull()
    expect(raw.query("SELECT name FROM sqlite_master WHERE name = 'error_occurrences'").get()).toBeNull()

    const messages = raw.query<{
      target_language: string
      message_id: string
      classification: string
      finding_count: number
    }, []>(
      "SELECT target_language, message_id, classification, finding_count FROM analyzed_messages ORDER BY message_id",
    ).all()
    expect(messages).toHaveLength(3)
    expect(messages[0]).toEqual({
      target_language: "en", message_id: "msg1", classification: "target_attempt", finding_count: 2,
    })
    expect(messages[1]).toEqual({
      target_language: "en", message_id: "msg2", classification: "target_attempt", finding_count: 1,
    })
    expect(messages[2]).toEqual({
      target_language: "en", message_id: "msg3", classification: "skipped", finding_count: 0,
    })

    const patterns = raw.query<{
      target_language: string
      pattern_key: string
      stage: string
      revision: number
    }, []>(
      "SELECT target_language, pattern_key, stage, revision FROM learning_patterns ORDER BY pattern_key",
    ).all()
    expect(patterns).toHaveLength(2)
    expect(patterns[0]).toMatchObject({
      target_language: "en", pattern_key: "missing_article", stage: "candidate",
    })
    expect(patterns[1]).toMatchObject({
      target_language: "en", pattern_key: "spelling_error", stage: "candidate",
    })

    const evidence = raw.query<{ kind: string; outcome: string; pattern_key: string; message_id: string }, []>(
      "SELECT kind, outcome, pattern_key, message_id FROM pattern_evidence ORDER BY id",
    ).all()
    expect(evidence).toHaveLength(3)
    expect(evidence.every((e) => e.kind === "error" && e.outcome === "incorrect")).toBe(true)
    raw.close()
    learning.close()
  })

  test("migrates v1 pattern that meets recurring threshold to practicing stage", () => {
    const { filename } = repository()
    const legacy = new Database(filename, { create: true })
    legacy.exec(v1Schema)
    legacy.exec(`
      INSERT INTO analyzed_messages (message_id, scope_id, session_id, analyzed_at, result)
      VALUES ('m1', 's1', 'sess1', 1000, 'findings'),
             ('m2', 's2', 'sess2', 1100, 'findings'),
             ('m3', 's3', 'sess3', 1200, 'findings');
      INSERT INTO error_patterns (target_language, pattern_key, category, label, rule,
                                   first_seen_at, last_seen_at, occurrence_count)
      VALUES ('en', 'recurring_pat', 'grammar', 'Recurring', 'Rule', 1000, 1200, 3);
      INSERT INTO error_occurrences (id, message_id, pattern_key, target_language,
                                      observed_at, confidence, severity, scope_id, session_id)
      VALUES ('e1', 'm1', 'recurring_pat', 'en', 1000, 0.95, 'high_value', 's1', 'sess1'),
             ('e2', 'm2', 'recurring_pat', 'en', 1100, 0.95, 'high_value', 's2', 'sess2'),
             ('e3', 'm3', 'recurring_pat', 'en', 1200, 0.95, 'high_value', 's3', 'sess3');
      PRAGMA user_version = 1;
    `)
    legacy.close()

    const learning = new LearningRepository(new VibeLingoDatabase(filename))
    learning.initialize()

    const raw = new Database(filename, { readonly: true })
    const patterns = raw.query<{
      pattern_key: string
      stage: string
      due_at: number | null
    }, []>(
      "SELECT pattern_key, stage, due_at FROM learning_patterns",
    ).all()
    expect(patterns).toHaveLength(1)
    expect(patterns[0].pattern_key).toBe("recurring_pat")
    expect(patterns[0].stage).toBe("practicing")
    expect(patterns[0].due_at).not.toBeNull()
    raw.close()
    learning.close()
  })

  test("migrates v2 schema preserving target_language on messages and occurrences", () => {
    const { filename } = repository()
    const legacy = new Database(filename, { create: true })
    legacy.exec(v2Schema)
    legacy.exec(`
      INSERT INTO analyzed_messages (target_language, message_id, scope_id, session_id, analyzed_at, result)
      VALUES ('en', 'msg1', 's1', 'session1', 1000, 'findings'),
             ('es', 'msg2', 's2', 'session2', 1100, 'findings');
      INSERT INTO error_patterns (target_language, pattern_key, category, label, rule,
                                   first_seen_at, last_seen_at, occurrence_count)
      VALUES ('en', 'missing_article', 'grammar', 'Missing article', 'Use a or the', 1000, 1000, 1),
             ('es', 'subjunctive', 'grammar', 'Subjunctive', 'Use que', 1100, 1100, 1);
      INSERT INTO error_occurrences (id, message_id, pattern_key, target_language,
                                      observed_at, original_fragment, corrected_fragment,
                                      confidence, severity, scope_id, session_id)
      VALUES ('e1', 'msg1', 'missing_article', 'en', 1000, 'a cat', 'the cat', 0.95, 'high_value', 's1', 'session1'),
             ('e2', 'msg2', 'subjunctive', 'es', 1100, 'quiero que', 'quiero que tu', 0.90, 'high_value', 's2', 'session2');
      PRAGMA user_version = 2;
    `)
    legacy.close()

    const learning = new LearningRepository(new VibeLingoDatabase(filename))
    learning.initialize()

    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version)).toBe(
      SCHEMA_VERSION,
    )

    const messages = raw.query<{
      target_language: string
      message_id: string
      classification: string
    }, []>(
      "SELECT target_language, message_id, classification FROM analyzed_messages ORDER BY message_id",
    ).all()
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ target_language: "en", message_id: "msg1", classification: "target_attempt" })
    expect(messages[1]).toEqual({ target_language: "es", message_id: "msg2", classification: "target_attempt" })

    const profiles = raw.query<{ target_language: string }, []>(
      "SELECT target_language FROM learning_profiles ORDER BY target_language",
    ).all()
    expect(profiles).toEqual([])

    const evidence = raw.query<{ target_language: string; pattern_key: string }, []>(
      "SELECT target_language, pattern_key FROM pattern_evidence ORDER BY target_language",
    ).all()
    expect(evidence).toEqual([
      { target_language: "en", pattern_key: "missing_article" },
      { target_language: "es", pattern_key: "subjunctive" },
    ])
    raw.close()
    learning.close()
  })

  test("idempotent migration does not duplicate data on repeated open", () => {
    const { filename } = repository()
    const legacy = new Database(filename, { create: true })
    legacy.exec(v2Schema)
    legacy.exec(`
      INSERT INTO analyzed_messages (target_language, message_id, scope_id, session_id, analyzed_at, result)
      VALUES ('en', 'msg1', 's1', 'session1', 1000, 'findings');
      INSERT INTO error_patterns (target_language, pattern_key, category, label, rule,
                                   first_seen_at, last_seen_at, occurrence_count)
      VALUES ('en', 'p1', 'grammar', 'P1', 'R1', 1000, 1000, 1);
      INSERT INTO error_occurrences (id, message_id, pattern_key, target_language,
                                      observed_at, confidence, severity, scope_id, session_id)
      VALUES ('e1', 'msg1', 'p1', 'en', 1000, 0.95, 'high_value', 's1', 'session1');
      PRAGMA user_version = 2;
    `)
    legacy.close()

    const first = new LearningRepository(new VibeLingoDatabase(filename))
    first.initialize()
    first.close()

    const second = new LearningRepository(new VibeLingoDatabase(filename))
    second.initialize()
    const raw = second.database.connection()
    const count = raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM analyzed_messages",
    ).get()
    expect(Number(count?.count)).toBe(1)
    expect(raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM learning_patterns",
    ).get()?.count).toBe(1)
    expect(raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM pattern_evidence",
    ).get()?.count).toBe(1)
    second.close()
  })

  test("repairs missing indexes on current-schema database preserving all data", () => {
    const { learning, filename } = repository()
    learning.rememberProfile(profile, 1_000)
    learning.close()

    const damaged = new Database(filename)
    damaged.exec("DROP INDEX analyzed_scope_time")
    damaged.exec("DROP INDEX events_language_time")
    damaged.close()

    const repaired = new LearningRepository(new VibeLingoDatabase(filename))
    repaired.initialize()
    expect(repaired.profileList()).toEqual([
      expect.objectContaining({ targetLanguage: "en", firstUsedAt: 1_000 }),
    ])
    const indexes = repaired.database.connection()
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      )
      .all()
      .map((row) => row.name)
    expect(indexes).toContain("analyzed_scope_time")
    expect(indexes).toContain("events_language_time")
    repaired.close()
  })

  test("throws clear error and preserves data for malformed/unrecognized schema", () => {
    const { filename } = repository()
    const malformed = new Database(filename, { create: true })
    malformed.exec(`
      CREATE TABLE unrecognized_table(id TEXT PRIMARY KEY, value TEXT);
      INSERT INTO unrecognized_table VALUES ('k1', 'v1');
      PRAGMA user_version = 2;
    `)
    malformed.close()

    expect(() => {
      const db = new VibeLingoDatabase(filename)
      db.initialize()
    }).toThrow("Schema migration blocked")

    const raw = new Database(filename, { readonly: true })
    expect(raw.query("SELECT name FROM sqlite_master WHERE name = 'unrecognized_table'").get()).toBeTruthy()
    expect(raw.query<{ value: string }, []>("SELECT value FROM unrecognized_table WHERE id = 'k1'").get()).toEqual({
      value: "v1",
    })
    raw.close()
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

  test("upgrades v5 in place and backfills historical reasons", () => {
    const { learning, filename } = repository()
    learning.recordSkipped(identity(1), profile, "too_little_target_language")
    learning.recordAnalysis(identity(2), profile, true, [finding], [], "target_attempt")
    learning.close()

    const v5 = new Database(filename)
    v5.exec("ALTER TABLE analyzed_messages DROP COLUMN reason")
    v5.exec("PRAGMA user_version = 5")
    v5.close()

    const upgraded = new LearningRepository(new VibeLingoDatabase(filename))
    upgraded.initialize()
    const raw = new Database(filename, { readonly: true })
    expect(Number(raw.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version)).toBe(
      SCHEMA_VERSION,
    )
    expect(raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM analyzed_messages",
    ).get()?.count).toBe(2)
    expect(raw.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM analyzed_messages WHERE reason = 'historical_unknown'",
    ).get()?.count).toBe(2)
    expect(raw.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" })
    raw.close()
    upgraded.close()
  })
})

describe("vNext learning repository", () => {
  test("persists skip and classification reasons", () => {
    const { learning, filename } = repository()
    learning.recordSkipped(identity(1), profile, "too_little_target_language")
    learning.recordSkipped(identity(2), profile, "mostly_code")
    learning.recordAnalysis(identity(3), profile, false, [], [], "not_target_language")
    learning.recordAnalysis(identity(4), profile, true, [finding], [], "target_attempt")

    const rows = new Database(filename, { readonly: true })
      .query<{ message_id: string; classification: string; reason: string }, []>(
        "SELECT message_id, classification, reason FROM analyzed_messages ORDER BY message_id",
      )
      .all()
    expect(rows).toEqual([
      { message_id: "message-1", classification: "skipped", reason: "too_little_target_language" },
      { message_id: "message-2", classification: "skipped", reason: "mostly_code" },
      { message_id: "message-3", classification: "not_target", reason: "not_target_language" },
      { message_id: "message-4", classification: "target_attempt", reason: "target_attempt" },
    ])
  })

  test("deduplicates messages and promotes non-minor findings after two Sessions", () => {
    const { learning } = repository()
    const firstSession = identity(1, { sessionId: "same-session" })
    expect(learning.recordAnalysis(firstSession, profile, true, [finding], [])).toBe(true)
    expect(learning.recordAnalysis(firstSession, profile, true, [finding], [])).toBe(false)
    expect(learning.recurringPatterns("en")).toEqual([])
    learning.recordAnalysis(identity(2, { sessionId: "same-session" }), profile, true, [finding], [])
    expect(learning.recurringPatterns("en")).toEqual([])
    learning.recordAnalysis(identity(3, { sessionId: "other-session" }), profile, true, [finding], [])
    expect(learning.recurringPatterns("en")[0]).toMatchObject({
      patternKey: "missing_article",
      occurrenceCount: 3,
      sessionCount: 2,
    })
    expect(learning.reviewQueue("en", 3, 2_000)[0]).toMatchObject({
      patternKey: "missing_article",
    })
  })

  test("makes two non-minor findings in two Sessions immediately reviewable", () => {
    const { learning } = repository()
    learning.recordAnalysis(identity(1, { sessionId: "session-a" }), profile, true, [finding], [])
    learning.recordAnalysis(identity(2, { sessionId: "session-b" }), profile, true, [finding], [])
    expect(learning.patternDetail("en", "missing_article")).toMatchObject({
      stage: "practicing",
      occurrenceCount: 2,
      sessionCount: 2,
    })
    expect(learning.reviewQueue("en", 3, 2_000)[0]?.patternKey).toBe("missing_article")
  })

  test("keeps minor findings as candidates until three errors span two Sessions", () => {
    const { learning } = repository()
    const minor = { ...finding, severity: "minor" as const }
    learning.recordAnalysis(identity(1, { sessionId: "session-a" }), profile, true, [minor], [])
    learning.recordAnalysis(identity(2, { sessionId: "session-b" }), profile, true, [minor], [])
    expect(learning.patternDetail("en", "missing_article")?.stage).toBe("candidate")
    learning.recordAnalysis(identity(3, { sessionId: "session-a" }), profile, true, [minor], [])
    expect(learning.patternDetail("en", "missing_article")?.stage).toBe("practicing")
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

  test("counts all local-day analysis activity without treating no-finding attempts as patterns", () => {
    const { learning } = repository()
    const now = Date.UTC(2026, 6, 29, 4)
    for (let index = 0; index < 5; index++) {
      learning.recordAnalysis(
        identity(index, {
          sessionId: index < 3 ? "session-a" : "session-b",
          observedAt: now - index * 1_000,
        }),
        profile,
        true,
        [],
        [],
      )
    }
    learning.recordAnalysis(
      identity(9, { sessionId: "session-c", observedAt: now }),
      profile,
      false,
      [],
      [],
    )
    const summary = learning.learningSummary("en", {
      now,
      timeZone: "Asia/Shanghai",
    })
    expect(summary).toMatchObject({
      analyzedMessagesToday: 6,
      targetAttemptsToday: 5,
      targetSessionsToday: 2,
      findingMessagesToday: 0,
      findingsToday: 0,
      totalPatternCount: 0,
      lastAnalyzedAt: now,
    })
  })

  test("buckets activity by IANA timezone across a daylight-saving boundary", () => {
    const { learning } = repository()
    const beforeMidnight = Date.UTC(2026, 2, 8, 4, 30)
    const afterMidnight = Date.UTC(2026, 2, 8, 5, 30)
    learning.recordAnalysis(identity(1, { observedAt: beforeMidnight }), profile, true, [], [])
    learning.recordAnalysis(identity(2, { observedAt: afterMidnight }), profile, true, [], [])
    const summary = learning.learningSummary("en", {
      now: afterMidnight,
      timeZone: "America/New_York",
    })
    expect(summary.activeDays).toBe(2)
    expect(summary).toMatchObject({
      analyzedMessagesToday: 1,
      targetAttemptsToday: 1,
      targetSessionsToday: 1,
    })
    expect(summary.trends["7"].map((point) => point.date)).toHaveLength(7)
    expect(new Set(summary.trends["7"].map((point) => point.date)).size).toBe(7)
  })

  test("applies Scope filtering to local-day activity", () => {
    const { learning } = repository()
    const now = Date.UTC(2026, 6, 29, 12)
    learning.recordAnalysis(
      identity(1, { scopeId: "scope-a", sessionId: "session-a", observedAt: now }),
      profile,
      true,
      [finding],
      [],
    )
    learning.recordAnalysis(
      identity(2, { scopeId: "scope-b", sessionId: "session-b", observedAt: now }),
      profile,
      true,
      [],
      [],
    )
    expect(learning.learningSummary("en", {
      scopeId: "scope-a",
      now,
      timeZone: "Asia/Shanghai",
    })).toMatchObject({
      analyzedMessagesToday: 1,
      targetAttemptsToday: 1,
      targetSessionsToday: 1,
      findingMessagesToday: 1,
      findingsToday: 1,
    })
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
    }), profile, true, [finding], [])
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
    expect(journey.items.find(
      (event) => event.type === "practice_started" && event.sessionId === "shared-session",
    )).toMatchObject({
      attemptCount: 2,
      findingMessageCount: 1,
      findingCount: 1,
      demonstrationCount: 0,
    })
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
    expect(record?.event).toMatchObject({
      attemptCount: 2,
      findingMessageCount: 1,
      findingCount: 1,
      demonstrationCount: 0,
    })
    expect(record?.sessionSummary).toMatchObject({
      analyzedMessages: 2,
      targetAttempts: 2,
      findingMessages: 1,
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

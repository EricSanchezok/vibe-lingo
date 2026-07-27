import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "fs"
import os from "os"
import path from "path"
import { VibeLingoStore, type MessageIdentity, type StoredFinding } from "../src/storage"

const temporaryDirectories: string[] = []

function databasePath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-storage-"))
  temporaryDirectories.push(directory)
  return path.join(directory, "vibe-lingo.sqlite")
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

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
    scopeId: index % 2 === 0 ? "scope-a" : "scope-b",
    sessionId: index % 2 === 0 ? "session-a" : "session-b",
    observedAt: 1_000 + index,
    ...overrides,
  }
}

describe("VibeLingo SQLite store", () => {
  test("deduplicates deliveries and promotes patterns only after distinct-session recurrence", () => {
    const store = new VibeLingoStore(databasePath())
    expect(store.recordAnalysis(identity(1), "en", [finding])).toBe(true)
    expect(store.recordAnalysis(identity(1), "en", [finding])).toBe(false)
    expect(store.recurringPatterns("en")).toEqual([])
    store.recordAnalysis(identity(2), "en", [finding])
    store.recordAnalysis(identity(3), "en", [finding])
    const recurring = store.recurringPatterns("en")
    expect(recurring).toHaveLength(1)
    expect(recurring[0]).toMatchObject({
      patternKey: "missing_article",
      occurrenceCount: 3,
      sessionCount: 2,
    })
  })

  test("retains only five fragment pairs while preserving all provenance and counts", () => {
    const filename = databasePath()
    const store = new VibeLingoStore(filename)
    for (let index = 0; index < 7; index++) {
      store.recordAnalysis(identity(index), "en", [
        {
          ...finding,
          originalFragment: `add button ${index}`,
          correctedFragment: `add a button ${index}`,
        },
      ])
    }
    const snapshot = store.progress({
      targetLanguage: "en",
      limit: 5,
      includeExamples: true,
      now: 2_000,
    })
    expect(snapshot.patterns[0].occurrenceCount).toBe(7)
    expect(snapshot.patterns[0].examples).toHaveLength(3)
    store.close()
    const raw = new Database(filename, { readonly: true })
    const retained = raw
      .query<{ count: number }, []>(
        "SELECT COUNT(*) AS count FROM error_occurrences WHERE original_fragment IS NOT NULL",
      )
      .get()
    expect(Number(retained?.count)).toBe(5)
    raw.close()
  })

  test("supports global and current-Scope progress views", () => {
    const store = new VibeLingoStore(databasePath())
    store.recordAnalysis(identity(1, { scopeId: "scope-a" }), "en", [finding])
    store.recordAnalysis(identity(2, { scopeId: "scope-a" }), "en", [finding])
    store.recordAnalysis(identity(3, { scopeId: "scope-b" }), "en", [finding])
    expect(
      store.progress({ targetLanguage: "en", limit: 5, includeExamples: false }).patterns[0]
        .occurrenceCount,
    ).toBe(3)
    expect(
      store.progress({
        targetLanguage: "en",
        scopeId: "scope-a",
        limit: 5,
        includeExamples: false,
      }).patterns[0].occurrenceCount,
    ).toBe(2)
  })

  test("keeps the same message and pattern isolated by target language", () => {
    const store = new VibeLingoStore(databasePath())
    expect(store.recordAnalysis(identity(1), "en", [finding])).toBe(true)
    expect(
      store.recordAnalysis(identity(1), "es", [
        {
          ...finding,
          patternKey: "missing_article",
          originalFragment: "añade botón",
          correctedFragment: "añade un botón",
        },
      ]),
    ).toBe(true)
    expect(
      store.progress({ targetLanguage: "en", limit: 5, includeExamples: true }).patterns[0]
        .examples[0].originalFragment,
    ).toBe("add button")
    expect(
      store.progress({ targetLanguage: "es", limit: 5, includeExamples: true }).patterns[0]
        .examples[0].originalFragment,
    ).toBe("añade botón")
  })

  test("clears one target namespace or all learning data without touching the other language", () => {
    const store = new VibeLingoStore(databasePath())
    store.recordAnalysis(identity(1), "en", [finding])
    store.recordAnalysis(identity(1), "es", [finding])
    expect(store.clearLearningData({ scope: "target", targetLanguage: "es" })).toEqual({
      deletedMessages: 1,
      deletedOccurrences: 1,
      deletedPatterns: 1,
    })
    expect(store.learningSummary("es").analyzedMessages).toBe(0)
    expect(store.learningSummary("en").analyzedMessages).toBe(1)
    expect(store.clearLearningData({ scope: "target", targetLanguage: "es" })).toEqual({
      deletedMessages: 0,
      deletedOccurrences: 0,
      deletedPatterns: 0,
    })
    expect(store.clearLearningData({ scope: "all" }).deletedMessages).toBe(1)
    expect(store.learningSummary("en").totalPatternCount).toBe(0)
  })

  test("allows overlapping generation connections and deletes its owned directory", () => {
    const filename = databasePath()
    const first = new VibeLingoStore(filename)
    const second = new VibeLingoStore(filename)
    first.recordAnalysis(identity(1), "en", [finding])
    second.recordAnalysis(identity(2), "en", [finding])
    expect(
      first.progress({ targetLanguage: "en", limit: 5, includeExamples: false }).patterns[0]
        .occurrenceCount,
    ).toBe(2)
    second.close()
    first.deleteData()
    expect(fs.existsSync(path.dirname(filename))).toBe(false)
  })

  test("migrates v1 English data to the v2 composite message namespace", () => {
    const filename = databasePath()
    const legacy = new Database(filename, { create: true })
    legacy.exec(`
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
        id TEXT PRIMARY KEY,
        target_language TEXT NOT NULL,
        pattern_key TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        observed_at INTEGER NOT NULL,
        severity TEXT NOT NULL,
        confidence REAL NOT NULL,
        original_fragment TEXT,
        corrected_fragment TEXT,
        UNIQUE (message_id, pattern_key),
        FOREIGN KEY (target_language, pattern_key)
          REFERENCES error_patterns(target_language, pattern_key)
          ON DELETE CASCADE
      );
      INSERT INTO analyzed_messages VALUES
        ('legacy-message', 'scope-a', 'session-a', 1000, 'findings');
      INSERT INTO error_patterns VALUES
        ('en', 'missing_article', 'grammar', 'Missing article', 'Use an article.', 1000, 1000, 1);
      INSERT INTO error_occurrences VALUES
        ('legacy-occurrence', 'en', 'missing_article', 'scope-a', 'session-a',
         'legacy-message', 1000, 'high_value', 0.95, 'add button', 'add a button');
      PRAGMA user_version = 1;
    `)
    legacy.close()

    const store = new VibeLingoStore(filename)
    expect(store.isAnalyzed("legacy-message", "en")).toBe(true)
    expect(
      store.progress({ targetLanguage: "en", limit: 5, includeExamples: true }).patterns[0],
    ).toMatchObject({
      occurrenceCount: 1,
      examples: [{ originalFragment: "add button", correctedFragment: "add a button" }],
    })
    expect(store.recordAnalysis(identity(9, { messageId: "legacy-message" }), "es", [finding])).toBe(
      true,
    )
    store.close()
    const migrated = new Database(filename, { readonly: true })
    expect(migrated.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version).toBe(
      2,
    )
    migrated.close()
  })
})

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
    expect(store.recordAnalysis(identity(1), [finding])).toBe(true)
    expect(store.recordAnalysis(identity(1), [finding])).toBe(false)
    expect(store.recurringPatterns()).toEqual([])
    store.recordAnalysis(identity(2), [finding])
    store.recordAnalysis(identity(3), [finding])
    const recurring = store.recurringPatterns()
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
      store.recordAnalysis(identity(index), [
        {
          ...finding,
          originalFragment: `add button ${index}`,
          correctedFragment: `add a button ${index}`,
        },
      ])
    }
    const snapshot = store.progress({ limit: 5, includeExamples: true, now: 2_000 })
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
    store.recordAnalysis(identity(1, { scopeId: "scope-a" }), [finding])
    store.recordAnalysis(identity(2, { scopeId: "scope-a" }), [finding])
    store.recordAnalysis(identity(3, { scopeId: "scope-b" }), [finding])
    expect(store.progress({ limit: 5, includeExamples: false }).patterns[0].occurrenceCount).toBe(3)
    expect(
      store.progress({ scopeId: "scope-a", limit: 5, includeExamples: false }).patterns[0].occurrenceCount,
    ).toBe(2)
  })

  test("allows overlapping generation connections and deletes its owned directory", () => {
    const filename = databasePath()
    const first = new VibeLingoStore(filename)
    const second = new VibeLingoStore(filename)
    first.recordAnalysis(identity(1), [finding])
    second.recordAnalysis(identity(2), [finding])
    expect(first.progress({ limit: 5, includeExamples: false }).patterns[0].occurrenceCount).toBe(2)
    second.close()
    first.deleteData()
    expect(fs.existsSync(path.dirname(filename))).toBe(false)
  })
})

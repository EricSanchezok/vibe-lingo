import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"
import { synergyRoot } from "@ericsanchezok/synergy-plugin/paths"
import {
  MAX_STORED_EXAMPLES,
  TARGET_LANGUAGE,
  type AnalysisFinding,
  type ErrorCategory,
  type ErrorSeverity,
  type KnownPattern,
  type ProgressExample,
  type ProgressPattern,
  type ProgressSnapshot,
  type RecurringPattern,
} from "./types"

export type MessageIdentity = {
  messageId: string
  scopeId: string
  sessionId: string
  observedAt: number
}

export type StoredFinding = Omit<AnalysisFinding, "originalFragment" | "correctedFragment"> & {
  originalFragment?: string
  correctedFragment?: string
}

type PatternRow = {
  pattern_key: string
  category: ErrorCategory
  label: string
  rule: string
  occurrence_count: number
  session_count: number
  first_seen_at?: number
  last_seen_at: number
  severity_rank: number
}

type ExampleRow = {
  observed_at: number
  scope_id: string
  session_id: string
  message_id: string
  original_fragment: string | null
  corrected_fragment: string | null
}

function severityFromRank(rank: number): ErrorSeverity {
  if (rank >= 3) return "meaning_affecting"
  if (rank >= 2) return "high_value"
  return "minor"
}

function numberValue(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0)
}

export function defaultDataDirectory(): string {
  return path.join(synergyRoot(), "data", "plugins", "vibe-lingo")
}

export function defaultDatabasePath(): string {
  return path.join(defaultDataDirectory(), "vibe-lingo.sqlite")
}

export class VibeLingoStore {
  #database?: Database

  constructor(readonly filename: string = defaultDatabasePath()) {}

  initialize(): void {
    this.#connection()
  }

  close(): void {
    this.#database?.close()
    this.#database = undefined
  }

  deleteData(): void {
    this.close()
    fs.rmSync(path.dirname(this.filename), { recursive: true, force: true })
  }

  isAnalyzed(messageId: string): boolean {
    const row = this.#connection()
      .query<{ present: number }, [string]>("SELECT 1 AS present FROM analyzed_messages WHERE message_id = ? LIMIT 1")
      .get(messageId)
    return Boolean(row?.present)
  }

  recordSkipped(identity: MessageIdentity): boolean {
    const result = this.#connection()
      .query(
        `INSERT OR IGNORE INTO analyzed_messages
          (message_id, scope_id, session_id, analyzed_at, result)
         VALUES (?, ?, ?, ?, 'skipped')`,
      )
      .run(identity.messageId, identity.scopeId, identity.sessionId, identity.observedAt)
    return numberValue(result.changes) > 0
  }

  recordAnalysis(identity: MessageIdentity, findings: StoredFinding[]): boolean {
    const database = this.#connection()
    const transaction = database.transaction(() => {
      const messageInsert = database
        .query(
          `INSERT OR IGNORE INTO analyzed_messages
            (message_id, scope_id, session_id, analyzed_at, result)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          identity.messageId,
          identity.scopeId,
          identity.sessionId,
          identity.observedAt,
          findings.length > 0 ? "findings" : "no_findings",
        )
      if (numberValue(messageInsert.changes) === 0) return false

      for (const finding of findings) {
        database
          .query(
            `INSERT INTO error_patterns
              (target_language, pattern_key, category, label, rule, first_seen_at, last_seen_at, occurrence_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT(target_language, pattern_key) DO UPDATE SET
               category = excluded.category,
               label = excluded.label,
               rule = excluded.rule`,
          )
          .run(
            TARGET_LANGUAGE,
            finding.patternKey,
            finding.category,
            finding.label,
            finding.rule,
            identity.observedAt,
            identity.observedAt,
          )

        const occurrence = database
          .query(
            `INSERT OR IGNORE INTO error_occurrences
              (id, target_language, pattern_key, scope_id, session_id, message_id, observed_at,
               severity, confidence, original_fragment, corrected_fragment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            TARGET_LANGUAGE,
            finding.patternKey,
            identity.scopeId,
            identity.sessionId,
            identity.messageId,
            identity.observedAt,
            finding.severity,
            finding.confidence,
            finding.originalFragment ?? null,
            finding.correctedFragment ?? null,
          )
        if (numberValue(occurrence.changes) === 0) continue

        database
          .query(
            `UPDATE error_patterns
             SET occurrence_count = occurrence_count + 1,
                 first_seen_at = MIN(first_seen_at, ?),
                 last_seen_at = MAX(last_seen_at, ?)
             WHERE target_language = ? AND pattern_key = ?`,
          )
          .run(identity.observedAt, identity.observedAt, TARGET_LANGUAGE, finding.patternKey)

        database
          .query(
            `UPDATE error_occurrences
             SET original_fragment = NULL, corrected_fragment = NULL
             WHERE id IN (
               SELECT id
               FROM error_occurrences
               WHERE target_language = ? AND pattern_key = ?
                 AND (original_fragment IS NOT NULL OR corrected_fragment IS NOT NULL)
               ORDER BY observed_at DESC, id DESC
               LIMIT -1 OFFSET ?
             )`,
          )
          .run(TARGET_LANGUAGE, finding.patternKey, MAX_STORED_EXAMPLES)
      }
      return true
    })
    return transaction()
  }

  knownPatterns(limit = 30): KnownPattern[] {
    const rows = this.#connection()
      .query<
        { pattern_key: string; category: ErrorCategory; label: string; rule: string },
        [string, number]
      >(
        `SELECT pattern_key, category, label, rule
         FROM error_patterns
         WHERE target_language = ?
         ORDER BY last_seen_at DESC
         LIMIT ?`,
      )
      .all(TARGET_LANGUAGE, limit)
    return rows.map((row) => ({
      patternKey: row.pattern_key,
      category: row.category,
      label: row.label,
      rule: row.rule,
    }))
  }

  recurringPatterns(limit = 3): RecurringPattern[] {
    const rows = this.#connection()
      .query<PatternRow, [string, number]>(
        `SELECT
           p.pattern_key,
           p.category,
           p.label,
           p.rule,
           p.occurrence_count,
           COUNT(DISTINCT o.session_id) AS session_count,
           p.last_seen_at,
           MAX(CASE o.severity
             WHEN 'meaning_affecting' THEN 3
             WHEN 'high_value' THEN 2
             ELSE 1
           END) AS severity_rank
         FROM error_patterns p
         JOIN error_occurrences o
           ON o.target_language = p.target_language AND o.pattern_key = p.pattern_key
         WHERE p.target_language = ? AND p.occurrence_count >= 3
         GROUP BY p.target_language, p.pattern_key
         HAVING COUNT(DISTINCT o.session_id) >= 2
         ORDER BY severity_rank DESC, p.occurrence_count DESC, p.last_seen_at DESC
         LIMIT ?`,
      )
      .all(TARGET_LANGUAGE, limit)
    return rows.map((row) => this.#recurringFromRow(row))
  }

  progress(input: {
    scopeId?: string
    limit: number
    includeExamples: boolean
    now?: number
  }): ProgressSnapshot {
    const database = this.#connection()
    const since = (input.now ?? Date.now()) - 30 * 24 * 60 * 60 * 1_000
    const analyzed = input.scopeId
      ? database
          .query<{ count: number }, [string]>(
            "SELECT COUNT(*) AS count FROM analyzed_messages WHERE scope_id = ? AND result != 'skipped'",
          )
          .get(input.scopeId)
      : database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM analyzed_messages WHERE result != 'skipped'",
          )
          .get()
    const recent = input.scopeId
      ? database
          .query<{ count: number }, [number, string]>(
            "SELECT COUNT(*) AS count FROM error_occurrences WHERE observed_at >= ? AND scope_id = ?",
          )
          .get(since, input.scopeId)
      : database
          .query<{ count: number }, [number]>(
            "SELECT COUNT(*) AS count FROM error_occurrences WHERE observed_at >= ?",
          )
          .get(since)

    const scopeClause = input.scopeId ? "AND o.scope_id = ?" : ""
    const bindings: Array<string | number> = [TARGET_LANGUAGE]
    if (input.scopeId) bindings.push(input.scopeId)
    bindings.push(input.limit)
    const rows = database
      .query<PatternRow, Array<string | number>>(
        `SELECT
           p.pattern_key,
           p.category,
           p.label,
           p.rule,
           COUNT(*) AS occurrence_count,
           COUNT(DISTINCT o.session_id) AS session_count,
           MIN(o.observed_at) AS first_seen_at,
           MAX(o.observed_at) AS last_seen_at,
           MAX(CASE o.severity
             WHEN 'meaning_affecting' THEN 3
             WHEN 'high_value' THEN 2
             ELSE 1
           END) AS severity_rank
         FROM error_patterns p
         JOIN error_occurrences o
           ON o.target_language = p.target_language AND o.pattern_key = p.pattern_key
         WHERE p.target_language = ? ${scopeClause}
         GROUP BY p.target_language, p.pattern_key
         ORDER BY severity_rank DESC, occurrence_count DESC, last_seen_at DESC
         LIMIT ?`,
      )
      .all(...bindings)

    const patterns: ProgressPattern[] = rows.map((row) => ({
      ...this.#recurringFromRow(row),
      firstSeenAt: numberValue(row.first_seen_at),
      examples: input.includeExamples ? this.#examples(row.pattern_key, input.scopeId) : [],
    }))

    return {
      analyzedMessages: numberValue(analyzed?.count),
      findingsLast30Days: numberValue(recent?.count),
      patterns,
    }
  }

  #examples(patternKey: string, scopeId?: string): ProgressExample[] {
    const scopeClause = scopeId ? "AND scope_id = ?" : ""
    const bindings: Array<string | number> = [TARGET_LANGUAGE, patternKey]
    if (scopeId) bindings.push(scopeId)
    bindings.push(3)
    const rows = this.#connection()
      .query<ExampleRow, Array<string | number>>(
        `SELECT observed_at, scope_id, session_id, message_id, original_fragment, corrected_fragment
         FROM error_occurrences
         WHERE target_language = ? AND pattern_key = ? ${scopeClause}
           AND original_fragment IS NOT NULL AND corrected_fragment IS NOT NULL
         ORDER BY observed_at DESC, id DESC
         LIMIT ?`,
      )
      .all(...bindings)
    return rows.map((row) => ({
      observedAt: numberValue(row.observed_at),
      scopeId: row.scope_id,
      sessionId: row.session_id,
      messageId: row.message_id,
      originalFragment: row.original_fragment ?? undefined,
      correctedFragment: row.corrected_fragment ?? undefined,
    }))
  }

  #recurringFromRow(row: PatternRow): RecurringPattern {
    return {
      patternKey: row.pattern_key,
      category: row.category,
      label: row.label,
      rule: row.rule,
      occurrenceCount: numberValue(row.occurrence_count),
      sessionCount: numberValue(row.session_count),
      lastSeenAt: numberValue(row.last_seen_at),
      severity: severityFromRank(numberValue(row.severity_rank)),
    }
  }

  #connection(): Database {
    if (this.#database) return this.#database
    fs.mkdirSync(path.dirname(this.filename), { recursive: true })
    const database = new Database(this.filename, { create: true })
    database.exec("PRAGMA journal_mode = WAL")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec("PRAGMA busy_timeout = 5000")
    this.#migrate(database)
    this.#database = database
    return database
  }

  #migrate(database: Database): void {
    const row = database.query<{ user_version: number }, []>("PRAGMA user_version").get()
    const version = numberValue(row?.user_version)
    if (version >= 1) return
    const migrate = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS analyzed_messages (
          message_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          analyzed_at INTEGER NOT NULL,
          result TEXT NOT NULL CHECK(result IN ('findings', 'no_findings', 'skipped'))
        );

        CREATE TABLE IF NOT EXISTS error_patterns (
          target_language TEXT NOT NULL,
          pattern_key TEXT NOT NULL,
          category TEXT NOT NULL,
          label TEXT NOT NULL,
          rule TEXT NOT NULL,
          first_seen_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          occurrence_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (target_language, pattern_key)
        );

        CREATE TABLE IF NOT EXISTS error_occurrences (
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

        CREATE INDEX IF NOT EXISTS error_occurrences_pattern_time
          ON error_occurrences(target_language, pattern_key, observed_at DESC);
        CREATE INDEX IF NOT EXISTS error_occurrences_scope_time
          ON error_occurrences(scope_id, observed_at DESC);
        CREATE INDEX IF NOT EXISTS error_occurrences_session_message
          ON error_occurrences(session_id, message_id);

        PRAGMA user_version = 1;
      `)
    })
    migrate()
  }
}

let singleton: VibeLingoStore | undefined

export function defaultStore(): VibeLingoStore {
  singleton ??= new VibeLingoStore()
  return singleton
}

export function closeDefaultStore(): void {
  singleton?.close()
  singleton = undefined
}

export function deleteDefaultData(): void {
  if (singleton) {
    singleton.deleteData()
    singleton = undefined
    return
  }
  fs.rmSync(defaultDataDirectory(), { recursive: true, force: true })
}

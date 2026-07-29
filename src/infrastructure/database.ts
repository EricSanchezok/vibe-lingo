import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"
import { synergyRoot } from "@ericsanchezok/synergy-plugin/paths"

export const SCHEMA_VERSION = 6

const REQUIRED_COLUMNS = {
  learning_profiles: [
    "target_language",
    "native_language",
    "proficiency",
    "first_used_at",
    "last_used_at",
    "revision",
  ],
  analyzed_messages: [
    "target_language",
    "message_id",
    "scope_id",
    "session_id",
    "analyzed_at",
    "classification",
    "reason",
    "finding_count",
    "demonstration_count",
  ],
  learning_patterns: [
    "target_language",
    "pattern_key",
    "category",
    "severity",
    "label",
    "rule",
    "stage",
    "disposition",
    "first_seen_at",
    "last_seen_at",
    "due_at",
    "schedule_step",
    "lapse_count",
    "last_lapsed_at",
    "verified_at",
    "revision",
  ],
  pattern_aliases: ["target_language", "alias_key", "canonical_key"],
  pattern_presentations: [
    "target_language",
    "pattern_key",
    "native_language",
    "source_label",
    "source_rule",
    "display_label",
    "display_rule",
    "generated_at",
  ],
  pattern_evidence: [
    "id",
    "target_language",
    "pattern_key",
    "kind",
    "outcome",
    "severity",
    "confidence",
    "scope_id",
    "session_id",
    "message_id",
    "review_item_id",
    "observed_at",
    "original_fragment",
    "corrected_fragment",
  ],
  review_sessions: [
    "id",
    "target_language",
    "scope_id",
    "status",
    "current_index",
    "revision",
    "started_at",
    "updated_at",
    "completed_at",
  ],
  review_items: [
    "id",
    "review_id",
    "target_language",
    "pattern_key",
    "ordinal",
    "stage",
    "hint_level",
    "challenge",
    "hint_one",
    "hint_two",
    "explanation",
    "reference_answer",
    "transfer_challenge",
    "rubric",
    "initial_correct",
    "transfer_correct",
    "outcome",
    "created_at",
    "completed_at",
  ],
  review_attempts: [
    "id",
    "request_id",
    "review_id",
    "item_id",
    "phase",
    "answer",
    "verdict",
    "feedback",
    "natural_answer",
    "confidence",
    "hint_count",
    "created_at",
  ],
  review_commands: [
    "request_id",
    "review_id",
    "command",
    "revision_after",
    "state_json",
    "created_at",
  ],
  learning_events: [
    "id",
    "target_language",
    "event_type",
    "occurred_at",
    "scope_id",
    "session_id",
    "message_id",
    "pattern_key",
    "review_id",
    "review_item_id",
  ],
} as const satisfies Record<string, readonly string[]>

const REQUIRED_INDEXES = [
  "one_open_review_per_language",
  "analyzed_language_time",
  "analyzed_scope_time",
  "pattern_stage_due",
  "evidence_pattern_time",
  "evidence_scope_time",
  "events_language_time",
  "review_language_time",
] as const

export function defaultDataDirectory(): string {
  return path.join(synergyRoot(), "data", "plugins", "vibe-lingo")
}

export function defaultDatabasePath(): string {
  return path.join(defaultDataDirectory(), "vibe-lingo.sqlite")
}

export class VibeLingoDatabase {
  #database?: Database

  constructor(readonly filename: string = defaultDatabasePath()) {}

  connection(): Database {
    if (this.#database) return this.#database
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const database = new Database(this.filename, { create: true })
    database.exec("PRAGMA journal_mode = WAL")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec("PRAGMA busy_timeout = 5000")
    this.#ensureSchema(database)
    this.#database = database
    return database
  }

  initialize(): void {
    this.connection();
  }

  close(): void {
    this.#database?.close()
    this.#database = undefined
  }

  deleteData(): void {
    this.close();
    fs.rmSync(path.dirname(this.filename), { recursive: true, force: true });
  }

  #ensureSchema(database: Database): void {
    const current = Number(
      database.query<{ user_version: number }, []>("PRAGMA user_version").get()
        ?.user_version ?? 0,
    );
    if (current === SCHEMA_VERSION && this.#hasCurrentSchema(database)) return

    database.exec("PRAGMA foreign_keys = OFF")
    let transactionOpen = false
    try {
      database.exec("BEGIN EXCLUSIVE")
      transactionOpen = true
      const lockedVersion = Number(
        database
          .query<{ user_version: number }, []>("PRAGMA user_version")
          .get()?.user_version ?? 0,
      );
      if (
        lockedVersion === SCHEMA_VERSION &&
        this.#hasCurrentSchema(database)
      ) {
        database.exec("COMMIT")
        transactionOpen = false
        return
      }
      switch (this.#detectSchema(database)) {
        case "fresh":
          this.#createCurrentSchema(database)
          break
        case "v6_tables":
          this.#repairIndexes(database)
          break
        case "v5_tables":
          this.#upgradeV5ToV6(database)
          break
        case "v1":
          this.#migrateLegacy(database, "v1")
          break
        case "v2":
          this.#migrateLegacy(database, "v2")
          break
        case "malformed":
          throw new Error(
            "Schema migration blocked: the database contains unrecognized tables. " +
              "Preserving all existing data. Report this error to continue.",
          );
      }
      if (!this.#hasCurrentSchema(database)) {
        throw new Error(
          "Schema verification failed after migration. All changes have been rolled back.",
        );
      }
      database.exec("COMMIT")
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) database.exec("ROLLBACK")
      throw error
    } finally {
      database.exec("PRAGMA foreign_keys = ON")
    }
  }

  #detectSchema(
    database: Database,
  ): "fresh" | "v6_tables" | "v5_tables" | "v1" | "v2" | "malformed" {
    const tableRows = database
      .query<
        { name: string },
        []
      >("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all();
    if (tableRows.length === 0) return "fresh"

    const tableSet = new Set(tableRows.map((row) => row.name))
    const currentTableNames = Object.keys(REQUIRED_COLUMNS)

    if (currentTableNames.every((table) => tableSet.has(table))) {
      let hasAllCurrentColumns = true
      for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
        const presentColumns = new Set(
          database
            .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
            .all()
            .map((row) => row.name),
        );
        if (requiredColumns.some((column) => !presentColumns.has(column))) {
          hasAllCurrentColumns = false
          break
        }
      }
      if (hasAllCurrentColumns) return "v6_tables"

      const missingOnlyReason = Object.entries(REQUIRED_COLUMNS).every(
        ([table, requiredColumns]) => {
          const presentColumns = new Set(
            database
              .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
              .all()
              .map((row) => row.name),
          );
          const missing = requiredColumns.filter((column) => !presentColumns.has(column))
          return table === "analyzed_messages"
            ? missing.length === 1 && missing[0] === "reason"
            : missing.length === 0
        },
      )
      if (missingOnlyReason) return "v5_tables"
      return "malformed"
    }

    if (
      tableSet.has("error_patterns") &&
      tableSet.has("error_occurrences") &&
      tableSet.has("analyzed_messages")
    ) {
      const occurrenceCols = new Set(
        database
          .query<{ name: string }, []>("PRAGMA table_info('error_occurrences')")
          .all()
          .map((r) => r.name),
      );
      if (!occurrenceCols.has("severity")) return "malformed"
      const requiredLegacyOccurrenceCols = [
        "id",
        "message_id",
        "pattern_key",
        "target_language",
        "observed_at",
        "confidence",
      ]
      if (requiredLegacyOccurrenceCols.some((c) => !occurrenceCols.has(c)))
        return "malformed"

      const patternCols = new Set(
        database
          .query<{ name: string }, []>("PRAGMA table_info('error_patterns')")
          .all()
          .map((r) => r.name),
      );
      const requiredPatternCols = [
        "target_language",
        "pattern_key",
        "category",
        "label",
        "rule",
        "first_seen_at",
        "last_seen_at",
        "occurrence_count",
      ]
      if (requiredPatternCols.some((c) => !patternCols.has(c)))
        return "malformed"

      const analyzedCols = database
        .query<{ name: string }, []>("PRAGMA table_info('analyzed_messages')")
        .all()
        .map((r) => r.name);
      if (analyzedCols.includes("target_language")) return "v2"
      return "v1"
    }

    return "malformed"
  }

  #createCurrentSchema(database: Database): void {
    for (const { name } of database
      .query<
        { name: string },
        []
      >("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()) {
      database.exec(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`)
    }
    database.exec(`
        CREATE TABLE learning_profiles (
          target_language TEXT PRIMARY KEY,
          native_language TEXT NOT NULL,
          proficiency TEXT NOT NULL CHECK(proficiency IN ('beginner', 'intermediate', 'advanced')),
          first_used_at INTEGER NOT NULL,
          last_used_at INTEGER NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE analyzed_messages (
          target_language TEXT NOT NULL,
          message_id TEXT NOT NULL,
          scope_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          analyzed_at INTEGER NOT NULL,
          classification TEXT NOT NULL
            CHECK(classification IN ('target_attempt', 'not_target', 'skipped')),
          reason TEXT NOT NULL,
          finding_count INTEGER NOT NULL DEFAULT 0,
          demonstration_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (target_language, message_id)
        );

        CREATE TABLE learning_patterns (
          target_language TEXT NOT NULL,
          pattern_key TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL,
          label TEXT NOT NULL,
          rule TEXT NOT NULL,
          stage TEXT NOT NULL DEFAULT 'candidate'
            CHECK(stage IN ('candidate', 'practicing', 'verified')),
          disposition TEXT NOT NULL DEFAULT 'active'
            CHECK(disposition IN ('active', 'ignored', 'rejected')),
          first_seen_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          due_at INTEGER,
          schedule_step INTEGER NOT NULL DEFAULT 0,
          lapse_count INTEGER NOT NULL DEFAULT 0,
          last_lapsed_at INTEGER,
          verified_at INTEGER,
          revision INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (target_language, pattern_key)
        );

        CREATE TABLE pattern_aliases (
          target_language TEXT NOT NULL,
          alias_key TEXT NOT NULL,
          canonical_key TEXT NOT NULL,
          PRIMARY KEY (target_language, alias_key),
          FOREIGN KEY (target_language, canonical_key)
            REFERENCES learning_patterns(target_language, pattern_key)
            ON DELETE CASCADE
        );

        CREATE TABLE pattern_presentations (
          target_language TEXT NOT NULL,
          pattern_key TEXT NOT NULL,
          native_language TEXT NOT NULL,
          source_label TEXT NOT NULL,
          source_rule TEXT NOT NULL,
          display_label TEXT NOT NULL,
          display_rule TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          PRIMARY KEY (target_language, pattern_key, native_language),
          FOREIGN KEY (target_language, pattern_key)
            REFERENCES learning_patterns(target_language, pattern_key)
            ON DELETE CASCADE
        );

        CREATE TABLE pattern_evidence (
          id TEXT PRIMARY KEY,
          target_language TEXT NOT NULL,
          pattern_key TEXT NOT NULL,
          kind TEXT NOT NULL
            CHECK(kind IN ('error', 'natural_correct', 'review_recall', 'review_repair', 'review_transfer')),
          outcome TEXT NOT NULL
            CHECK(outcome IN ('incorrect', 'assisted', 'independent', 'correct')),
          severity TEXT,
          confidence REAL NOT NULL,
          scope_id TEXT,
          session_id TEXT,
          message_id TEXT,
          review_item_id TEXT,
          observed_at INTEGER NOT NULL,
          original_fragment TEXT,
          corrected_fragment TEXT,
          UNIQUE (target_language, pattern_key, kind, message_id),
          FOREIGN KEY (target_language, pattern_key)
            REFERENCES learning_patterns(target_language, pattern_key)
            ON DELETE CASCADE
        );

        CREATE TABLE review_sessions (
          id TEXT PRIMARY KEY,
          target_language TEXT NOT NULL,
          scope_id TEXT NOT NULL,
          status TEXT NOT NULL
            CHECK(status IN ('active', 'paused', 'completed', 'abandoned')),
          current_index INTEGER NOT NULL DEFAULT 0,
          revision INTEGER NOT NULL DEFAULT 0,
          started_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          completed_at INTEGER
        );

        CREATE UNIQUE INDEX one_open_review_per_language
          ON review_sessions(target_language)
          WHERE status IN ('active', 'paused');

        CREATE TABLE review_items (
          id TEXT PRIMARY KEY,
          review_id TEXT NOT NULL,
          target_language TEXT NOT NULL,
          pattern_key TEXT NOT NULL,
          ordinal INTEGER NOT NULL,
          stage TEXT NOT NULL
            CHECK(stage IN ('awaiting_response', 'awaiting_repair', 'awaiting_transfer', 'item_completed')),
          hint_level INTEGER NOT NULL DEFAULT 0,
          challenge TEXT,
          hint_one TEXT,
          hint_two TEXT,
          explanation TEXT,
          reference_answer TEXT,
          transfer_challenge TEXT,
          rubric TEXT,
          initial_correct INTEGER NOT NULL DEFAULT 0,
          transfer_correct INTEGER NOT NULL DEFAULT 0,
          outcome TEXT CHECK(outcome IN ('failed', 'assisted', 'independent', 'abandoned')),
          created_at INTEGER NOT NULL,
          completed_at INTEGER,
          UNIQUE (review_id, ordinal),
          FOREIGN KEY (review_id) REFERENCES review_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (target_language, pattern_key)
            REFERENCES learning_patterns(target_language, pattern_key)
            ON DELETE CASCADE
        );

        CREATE TABLE review_attempts (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          review_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          phase TEXT NOT NULL CHECK(phase IN ('recall', 'repair', 'transfer')),
          answer TEXT,
          verdict TEXT NOT NULL CHECK(verdict IN ('incorrect', 'partially_correct', 'correct')),
          feedback TEXT,
          natural_answer TEXT,
          confidence REAL NOT NULL,
          hint_count INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE (review_id, request_id),
          FOREIGN KEY (review_id) REFERENCES review_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES review_items(id) ON DELETE CASCADE
        );

        CREATE TABLE review_commands (
          request_id TEXT NOT NULL,
          review_id TEXT NOT NULL,
          command TEXT NOT NULL,
          revision_after INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (review_id, request_id),
          FOREIGN KEY (review_id) REFERENCES review_sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE learning_events (
          id TEXT PRIMARY KEY,
          target_language TEXT NOT NULL,
          event_type TEXT NOT NULL
            CHECK(event_type IN (
              'practice_started',
              'pattern_discovered',
              'pattern_reviewable',
              'review_item_completed',
              'review_completed',
              'pattern_verified',
              'pattern_lapsed'
            )),
          occurred_at INTEGER NOT NULL,
          scope_id TEXT,
          session_id TEXT,
          message_id TEXT,
          pattern_key TEXT,
          review_id TEXT,
          review_item_id TEXT,
          UNIQUE (target_language, event_type, message_id, pattern_key),
          UNIQUE (target_language, event_type, review_item_id),
          FOREIGN KEY (target_language, pattern_key)
            REFERENCES learning_patterns(target_language, pattern_key)
            ON DELETE CASCADE,
          FOREIGN KEY (review_item_id)
            REFERENCES review_items(id)
            ON DELETE CASCADE
        );

        CREATE INDEX analyzed_language_time
          ON analyzed_messages(target_language, analyzed_at DESC);
        CREATE INDEX analyzed_scope_time
          ON analyzed_messages(target_language, scope_id, analyzed_at DESC);
        CREATE INDEX pattern_stage_due
          ON learning_patterns(target_language, disposition, stage, due_at);
        CREATE INDEX evidence_pattern_time
          ON pattern_evidence(target_language, pattern_key, observed_at DESC);
        CREATE INDEX evidence_scope_time
          ON pattern_evidence(target_language, scope_id, observed_at DESC);
        CREATE INDEX events_language_time
          ON learning_events(target_language, occurred_at DESC, id DESC);
        CREATE INDEX review_language_time
          ON review_sessions(target_language, started_at DESC);

        PRAGMA user_version = 6
      `);
  }

  #repairIndexes(database: Database): void {
    const existingIndexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index'",
        )
        .all()
        .map((r) => r.name),
    );
    if (!existingIndexes.has("one_open_review_per_language")) {
      database.exec(`
        CREATE UNIQUE INDEX one_open_review_per_language
          ON review_sessions(target_language)
          WHERE status IN ('active', 'paused')
      `);
    }
    if (!existingIndexes.has("analyzed_language_time")) {
      database.exec(
        "CREATE INDEX analyzed_language_time ON analyzed_messages(target_language, analyzed_at DESC)",
      );
    }
    if (!existingIndexes.has("analyzed_scope_time")) {
      database.exec(
        "CREATE INDEX analyzed_scope_time ON analyzed_messages(target_language, scope_id, analyzed_at DESC)",
      );
    }
    if (!existingIndexes.has("pattern_stage_due")) {
      database.exec(
        "CREATE INDEX pattern_stage_due ON learning_patterns(target_language, disposition, stage, due_at)",
      );
    }
    if (!existingIndexes.has("evidence_pattern_time")) {
      database.exec(
        "CREATE INDEX evidence_pattern_time ON pattern_evidence(target_language, pattern_key, observed_at DESC)",
      );
    }
    if (!existingIndexes.has("evidence_scope_time")) {
      database.exec(
        "CREATE INDEX evidence_scope_time ON pattern_evidence(target_language, scope_id, observed_at DESC)",
      );
    }
    if (!existingIndexes.has("events_language_time")) {
      database.exec(
        "CREATE INDEX events_language_time ON learning_events(target_language, occurred_at DESC, id DESC)",
      );
    }
    if (!existingIndexes.has("review_language_time")) {
      database.exec(
        "CREATE INDEX review_language_time ON review_sessions(target_language, started_at DESC)",
      );
    }
    database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }

  #upgradeV5ToV6(database: Database): void {
    database.exec(
      "ALTER TABLE analyzed_messages ADD COLUMN reason TEXT NOT NULL DEFAULT 'historical_unknown'",
    );
    this.#repairIndexes(database)
  }

  #migrateLegacy(database: Database, kind: "v1" | "v2"): void {
    const defaultTL = "en"

    type LegacyMessage = {
      message_id: string
      scope_id: string
      session_id: string
      analyzed_at: number
      result: string
    }
    type LegacyMessageV2 = LegacyMessage & { target_language: string }
    type LegacyPattern = {
      target_language: string
      pattern_key: string
      category: string
      label: string
      rule: string
      first_seen_at: number
      last_seen_at: number
      occurrence_count: number
    }
    type LegacyOccurrence = {
      id: string
      message_id: string
      pattern_key: string
      target_language: string
      observed_at: number
      original_fragment: string | null
      corrected_fragment: string | null
      confidence: number
      severity: string
      scope_id: string | null
      session_id: string | null
    }

    const legacyMessages =
      kind === "v1"
        ? database
            .query<LegacyMessage, []>("SELECT * FROM analyzed_messages")
            .all()
        : database
            .query<LegacyMessageV2, []>("SELECT * FROM analyzed_messages")
            .all();
    const legacyPatterns = database
      .query<LegacyPattern, []>("SELECT * FROM error_patterns")
      .all();
    const legacyOccurrences = database
      .query<LegacyOccurrence, []>("SELECT * FROM error_occurrences")
      .all();

    const findingCount = new Map<string, number>()
    const sessionsByPattern = new Map<string, Set<string>>()
    const patternSeverities = new Map<string, number>()
    for (const occ of legacyOccurrences) {
      const tl = kind === "v1" ? defaultTL : occ.target_language
      findingCount.set(
        `${tl}:${occ.message_id}`,
        (findingCount.get(`${tl}:${occ.message_id}`) ?? 0) + 1,
      );
      const pk = `${tl}:${occ.pattern_key}`
      if (!sessionsByPattern.has(pk)) sessionsByPattern.set(pk, new Set())
      if (occ.session_id) sessionsByPattern.get(pk)!.add(occ.session_id)
      const sevRank =
        occ.severity === "meaning_affecting"
          ? 3
          : occ.severity === "high_value"
            ? 2
            : 1
      patternSeverities.set(
        pk,
        Math.max(patternSeverities.get(pk) ?? 0, sevRank),
      );
    }

    for (const { name } of database
      .query<
        { name: string },
        []
      >("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()) {
      database.exec(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`)
    }

    this.#createCurrentSchema(database)

    for (const msg of legacyMessages) {
      const tl =
        kind === "v1"
          ? defaultTL
          : ((msg as LegacyMessageV2).target_language ?? defaultTL);
      const classification =
        msg.result === "skipped" ? "skipped" : "target_attempt"
      const fc = findingCount.get(`${tl}:${msg.message_id}`) ?? 0
      database
        .query(
          `INSERT INTO analyzed_messages
           (target_language, message_id, scope_id, session_id, analyzed_at, classification, reason, finding_count, demonstration_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          tl,
          msg.message_id,
          msg.scope_id,
          msg.session_id,
          msg.analyzed_at,
          classification,
          classification === "target_attempt" ? "target_attempt" : "historical_unknown",
          fc,
        );
    }

    for (const pat of legacyPatterns) {
      const tl = kind === "v1" ? defaultTL : pat.target_language
      const sessionCount =
        sessionsByPattern.get(`${tl}:${pat.pattern_key}`)?.size ?? 0
      const isRecurring = pat.occurrence_count >= 3 && sessionCount >= 2
      const sevRank = patternSeverities.get(`${tl}:${pat.pattern_key}`) ?? 1
      const severity =
        sevRank >= 3
          ? "meaning_affecting"
          : sevRank >= 2
            ? "high_value"
            : "minor"
      database
        .query(
          `INSERT INTO learning_patterns
           (target_language, pattern_key, category, severity, label, rule, stage, disposition,
            first_seen_at, last_seen_at, due_at, schedule_step, lapse_count, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 0, 0, 0)`,
        )
        .run(
          tl,
          pat.pattern_key,
          pat.category,
          severity,
          pat.label,
          pat.rule,
          isRecurring ? "practicing" : "candidate",
          pat.first_seen_at,
          pat.last_seen_at,
          isRecurring ? 0 : null,
        );
    }

    for (const occ of legacyOccurrences) {
      const tl = kind === "v1" ? defaultTL : occ.target_language
      database
        .query(
          `INSERT OR IGNORE INTO pattern_evidence
           (id, target_language, pattern_key, kind, outcome, severity, confidence,
            scope_id, session_id, message_id, observed_at, original_fragment, corrected_fragment)
           VALUES (?, ?, ?, 'error', 'incorrect', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          occ.id,
          tl,
          occ.pattern_key,
          occ.severity,
          occ.confidence,
          occ.scope_id ?? null,
          occ.session_id ?? null,
          occ.message_id,
          occ.observed_at,
          occ.original_fragment ?? null,
          occ.corrected_fragment ?? null,
        );
    }

    database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }

  #hasCurrentSchema(database: Database): boolean {
    const tables = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table'",
        )
        .all()
        .map((row) => row.name),
    );
    for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      if (!tables.has(table)) return false
      const presentColumns = new Set(
        database
          .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
          .all()
          .map((row) => row.name),
      );
      if (requiredColumns.some((column) => !presentColumns.has(column)))
        return false
    }
    const indexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index'",
        )
        .all()
        .map((row) => row.name),
    );
    if (REQUIRED_INDEXES.some((index) => !indexes.has(index))) return false
    const eventTable = database
      .query<
        { sql: string | null },
        [string]
      >("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("learning_events");
    return Boolean(eventTable?.sql?.includes("review_item_completed"))
  }
}

let singleton: VibeLingoDatabase | undefined

export function defaultDatabase(): VibeLingoDatabase {
  singleton ??= new VibeLingoDatabase();
  return singleton
}

export function deleteDefaultData(): void {
  if (singleton) {
    singleton.deleteData();
    singleton = undefined
    return
  }
  fs.rmSync(defaultDataDirectory(), { recursive: true, force: true });
}
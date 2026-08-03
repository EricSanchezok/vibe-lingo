import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"
import { synergyRoot } from "@ericsanchezok/synergy-plugin/paths"

export const SCHEMA_VERSION = 10
const PREVIOUS_SCHEMA_VERSION = 9

const REQUIRED_TABLES = [
  "learning_profiles",
  "message_observations",
  "correction_batches",
  "correction_items",
  "learning_patterns",
  "pattern_aliases",
  "pattern_presentations",
  "pattern_evidence",
  "review_sessions",
  "review_items",
  "review_attempts",
  "review_commands",
  "learning_events",
  "translations",
  "translation_occurrences",
] as const

const REQUIRED_COLUMNS: Record<string, string[]> = {
  message_observations: [
    "target_language",
    "user_message_id",
    "classification",
    "usage_status",
    "usage_correlation_id",
    "usage_call_id",
  ],
  correction_batches: [
    "id",
    "target_language",
    "user_message_id",
    "assistant_message_id",
    "analysis_status",
    "correlation_id",
    "call_id",
    "queued_at",
    "analysis_failure_reason",
    "analysis_attempt_count",
    "input_digest",
  ],
  correction_items: [
    "id",
    "batch_id",
    "ordinal",
    "original_fragment",
    "corrected_fragment",
    "pattern_key",
    "accepted",
    "confidence",
  ],
  pattern_evidence: [
    "target_language",
    "pattern_key",
    "kind",
    "user_message_id",
    "correction_item_id",
  ],
  learning_events: [
    "target_language",
    "event_type",
    "correction_batch_id",
  ],
  translations: [
    "profile_target_language",
    "native_language",
    "destination_policy",
    "source_hash",
    "source_text",
    "translated_text",
  ],
}

const REQUIRED_INDEXES = [
  "one_open_review_per_language",
  "observations_language_time",
  "observations_scope_time",
  "corrections_language_time",
  "corrections_status_time",
  "pattern_stage_due",
  "evidence_pattern_time",
  "evidence_scope_time",
  "events_language_time",
  "review_language_time",
  "translations_language_time",
  "translation_occurrences_time",
] as const

export function defaultDataDirectory(): string {
  return path.join(synergyRoot(), "data", "plugins", "vibe-lingo")
}

export function defaultDatabasePath(): string {
  return path.join(defaultDataDirectory(), "vibe-lingo.sqlite")
}

function configure(database: Database): void {
  database.exec("PRAGMA journal_mode = WAL")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec("PRAGMA busy_timeout = 5000")
}

function tableNames(database: Database): Set<string> {
  return new Set(
    database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((row) => row.name),
  )
}

function hasStructure(
  database: Database,
  requiredColumns: Record<string, string[]> = REQUIRED_COLUMNS,
): boolean {
  const tables = tableNames(database)
  if (!REQUIRED_TABLES.every((table) => tables.has(table))) return false
  for (const [table, required] of Object.entries(requiredColumns)) {
    const columns = new Set(
      database
        .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => row.name),
    )
    if (!required.every((column) => columns.has(column))) return false
  }
  const indexes = new Set(
    database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      )
      .all()
      .map((row) => row.name),
  )
  return REQUIRED_INDEXES.every((index) => indexes.has(index))
}

const PREVIOUS_REQUIRED_COLUMNS: Record<string, string[]> = {
  ...REQUIRED_COLUMNS,
  correction_batches: REQUIRED_COLUMNS.correction_batches.filter(
    (column) => !["analysis_failure_reason", "analysis_attempt_count"].includes(column),
  ),
}

export class VibeLingoDatabase {
  #database?: Database

  constructor(readonly filename: string = defaultDatabasePath()) {}

  connection(): Database {
    if (this.#database) return this.#database
    fs.mkdirSync(path.dirname(this.filename), { recursive: true })
    let database = new Database(this.filename, { create: true })
    configure(database)
    let version =
      database.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version ?? 0
    const tables = tableNames(database)
    const fresh = version === 0 && tables.size === 0
    if (version === PREVIOUS_SCHEMA_VERSION && hasStructure(database, PREVIOUS_REQUIRED_COLUMNS)) {
      this.migrateFromPreviousSchema(database)
      version = SCHEMA_VERSION
    }
    const current = version === SCHEMA_VERSION && hasStructure(database)

    if (!fresh && !current) {
      database.close()
      this.removeDatabaseFiles()
      database = new Database(this.filename, { create: true })
      configure(database)
    }
    if (!current) this.createSchema(database)
    this.#database = database
    return database
  }

  initialize(): void {
    this.connection()
  }

  close(): void {
    this.#database?.close()
    this.#database = undefined
  }

  deleteData(): void {
    this.close()
    fs.rmSync(path.dirname(this.filename), { recursive: true, force: true })
  }

  private removeDatabaseFiles(): void {
    for (const filename of [this.filename, `${this.filename}-wal`, `${this.filename}-shm`]) {
      fs.rmSync(filename, { force: true })
    }
  }

  private createSchema(database: Database): void {
    database.exec(`
      BEGIN EXCLUSIVE;

      CREATE TABLE learning_profiles (
        target_language TEXT PRIMARY KEY,
        native_language TEXT NOT NULL,
        proficiency TEXT NOT NULL CHECK(proficiency IN ('beginner', 'intermediate', 'advanced')),
        first_used_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE message_observations (
        target_language TEXT NOT NULL,
        user_message_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        observed_at INTEGER NOT NULL,
        classification TEXT NOT NULL
          CHECK(classification IN ('target_attempt', 'not_target', 'skipped')),
        reason TEXT NOT NULL,
        usage_status TEXT NOT NULL DEFAULT 'not_applicable'
          CHECK(usage_status IN ('not_applicable', 'pending', 'queued', 'analyzed', 'failed')),
        usage_correlation_id TEXT,
        usage_call_id TEXT,
        demonstration_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (target_language, user_message_id),
        UNIQUE (usage_correlation_id)
      );

      CREATE TABLE correction_batches (
        id TEXT PRIMARY KEY,
        target_language TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        user_message_id TEXT NOT NULL,
        assistant_message_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        analysis_status TEXT NOT NULL
          CHECK(analysis_status IN ('pending', 'queued', 'analyzed', 'recorded_only', 'failed')),
        correlation_id TEXT NOT NULL UNIQUE,
        call_id TEXT,
        queued_at INTEGER,
        analysis_failure_reason TEXT
          CHECK(analysis_failure_reason IN (
            'timeout',
            'model_unavailable',
            'provider_error',
            'cancelled',
            'invalid_response',
            'unknown'
          )),
        analysis_attempt_count INTEGER NOT NULL DEFAULT 0,
        input_digest TEXT NOT NULL,
        UNIQUE (target_language, assistant_message_id)
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

      CREATE TABLE correction_items (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        original_fragment TEXT,
        corrected_fragment TEXT,
        pattern_key TEXT,
        accepted INTEGER,
        confidence REAL,
        UNIQUE (batch_id, ordinal),
        FOREIGN KEY (batch_id) REFERENCES correction_batches(id) ON DELETE CASCADE
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
        user_message_id TEXT,
        review_item_id TEXT,
        correction_item_id TEXT,
        observed_at INTEGER NOT NULL,
        original_fragment TEXT,
        corrected_fragment TEXT,
        UNIQUE (target_language, pattern_key, kind, user_message_id),
        FOREIGN KEY (target_language, pattern_key)
          REFERENCES learning_patterns(target_language, pattern_key)
          ON DELETE CASCADE,
        FOREIGN KEY (correction_item_id)
          REFERENCES correction_items(id)
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
            'correction_recorded',
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
        correction_batch_id TEXT,
        review_id TEXT,
        review_item_id TEXT,
        UNIQUE (target_language, event_type, message_id, pattern_key),
        UNIQUE (target_language, event_type, correction_batch_id),
        UNIQUE (target_language, event_type, review_item_id),
        FOREIGN KEY (target_language, pattern_key)
          REFERENCES learning_patterns(target_language, pattern_key)
          ON DELETE CASCADE,
        FOREIGN KEY (correction_batch_id)
          REFERENCES correction_batches(id)
          ON DELETE CASCADE,
        FOREIGN KEY (review_item_id)
          REFERENCES review_items(id)
          ON DELETE CASCADE
      );

      CREATE TABLE translations (
        id TEXT PRIMARY KEY,
        profile_target_language TEXT NOT NULL,
        native_language TEXT NOT NULL,
        destination_policy TEXT NOT NULL
          CHECK(destination_policy IN ('adaptive', 'native', 'target')),
        detected_source_language TEXT NOT NULL,
        destination_language TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        source_text TEXT NOT NULL,
        source_char_count INTEGER NOT NULL,
        translated_text TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE (
          profile_target_language,
          native_language,
          destination_policy,
          source_hash,
          contract_version
        )
      );

      CREATE TABLE translation_occurrences (
        id TEXT PRIMARY KEY,
        translation_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        session_id TEXT,
        used_at INTEGER NOT NULL,
        cache_hit INTEGER NOT NULL CHECK(cache_hit IN (0, 1)),
        FOREIGN KEY (translation_id) REFERENCES translations(id) ON DELETE CASCADE
      );

      CREATE INDEX observations_language_time
        ON message_observations(target_language, observed_at DESC);
      CREATE INDEX observations_scope_time
        ON message_observations(target_language, scope_id, observed_at DESC);
      CREATE INDEX corrections_language_time
        ON correction_batches(target_language, created_at DESC);
      CREATE INDEX corrections_status_time
        ON correction_batches(analysis_status, created_at);
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
      CREATE INDEX translations_language_time
        ON translations(profile_target_language, last_used_at DESC, id DESC);
      CREATE INDEX translation_occurrences_time
        ON translation_occurrences(translation_id, used_at DESC);

      PRAGMA user_version = 10;
      COMMIT;
    `)
  }

  private migrateFromPreviousSchema(database: Database): void {
    database.exec(`
      BEGIN EXCLUSIVE;
      ALTER TABLE correction_batches ADD COLUMN analysis_failure_reason TEXT
        CHECK(analysis_failure_reason IN (
          'timeout',
          'model_unavailable',
          'provider_error',
          'cancelled',
          'invalid_response',
          'unknown'
        ));
      ALTER TABLE correction_batches ADD COLUMN analysis_attempt_count INTEGER NOT NULL DEFAULT 0;
      UPDATE correction_batches
        SET analysis_attempt_count = 1
        WHERE analysis_status IN ('queued', 'analyzed', 'recorded_only', 'failed');
      PRAGMA user_version = 10;
      COMMIT;
    `)
  }
}

let singleton: VibeLingoDatabase | undefined

export function defaultDatabase(): VibeLingoDatabase {
  singleton ??= new VibeLingoDatabase()
  return singleton
}

export function deleteDefaultData(): void {
  if (singleton) {
    singleton.deleteData()
    singleton = undefined
    return
  }
  fs.rmSync(defaultDataDirectory(), { recursive: true, force: true })
}

import { Buffer } from "node:buffer"
import type { Database } from "bun:sqlite"
import { canonicalLanguageTag } from "../language"
import { truncateCodePoints } from "../domain/privacy"
import {
  MAX_TRANSLATION_CODEPOINTS,
  MAX_TRANSLATION_SOURCE_CODEPOINTS,
} from "../domain/translation"
import type { TranslationDestination } from "../domain/translation"
import type { VibeLingoDatabase } from "./database"

export type TranslationRow = {
  id: string
  profileTargetLanguage: string
  nativeLanguage: string
  destinationPolicy: TranslationDestination
  detectedSourceLanguage: string
  destinationLanguage: string
  sourceHash: string
  sourceText: string
  sourceCharCount: number
  translatedText: string
  contractVersion: number
  createdAt: number
  updatedAt: number
  lastUsedAt: number
  useCount: number
}

type StoredTranslationRow = {
  id: string
  profile_target_language: string
  native_language: string
  destination_policy: TranslationDestination
  detected_source_language: string
  destination_language: string
  source_hash: string
  source_text: string
  source_char_count: number
  translated_text: string
  contract_version: number
  created_at: number
  updated_at: number
  last_used_at: number
  use_count: number
}

type CacheIdentity = {
  profileTargetLanguage: string
  nativeLanguage: string
  destinationPolicy: TranslationDestination
  sourceHash: string
  contractVersion: number
}

function mapRow(row: StoredTranslationRow): TranslationRow {
  return {
    id: row.id,
    profileTargetLanguage: row.profile_target_language,
    nativeLanguage: row.native_language,
    destinationPolicy: row.destination_policy,
    detectedSourceLanguage: row.detected_source_language,
    destinationLanguage: row.destination_language,
    sourceHash: row.source_hash,
    sourceText: row.source_text,
    sourceCharCount: row.source_char_count,
    translatedText: row.translated_text,
    contractVersion: row.contract_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
  }
}

function validRow(row: TranslationRow) {
  return (
    Boolean(canonicalLanguageTag(row.profileTargetLanguage)) &&
    Boolean(canonicalLanguageTag(row.nativeLanguage)) &&
    Boolean(canonicalLanguageTag(row.detectedSourceLanguage)) &&
    Boolean(canonicalLanguageTag(row.destinationLanguage)) &&
    row.sourceText.trim().length > 0 &&
    [...row.sourceText].length <= MAX_TRANSLATION_SOURCE_CODEPOINTS &&
    row.sourceCharCount === [...row.sourceText].length &&
    row.translatedText.trim().length > 0 &&
    [...row.translatedText].length <= MAX_TRANSLATION_CODEPOINTS
  )
}

function encodeCursor(value: { lastUsedAt: number; id: string }) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeCursor(value?: string) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    return typeof parsed?.lastUsedAt === "number" &&
      typeof parsed?.id === "string"
      ? (parsed as { lastUsedAt: number; id: string })
      : undefined
  } catch {
    return undefined
  }
}

export class TranslationRepository {
  constructor(private readonly database: VibeLingoDatabase) {}

  private connection(): Database {
    return this.database.connection()
  }

  find(identity: CacheIdentity): TranslationRow | undefined {
    const stored = this.connection()
      .query<StoredTranslationRow, [string, string, string, string, number]>(
        `
      SELECT * FROM translations
      WHERE profile_target_language = ?
        AND native_language = ?
        AND destination_policy = ?
        AND source_hash = ?
        AND contract_version = ?
    `,
      )
      .get(
        identity.profileTargetLanguage,
        identity.nativeLanguage,
        identity.destinationPolicy,
        identity.sourceHash,
        identity.contractVersion,
      )
    if (!stored) return undefined
    const row = mapRow(stored)
    if (validRow(row)) return row
    this.delete(row.id)
    return undefined
  }

  save(input: {
    identity: CacheIdentity
    detectedSourceLanguage: string
    destinationLanguage: string
    sourceText: string
    sourceCharCount: number
    translatedText: string
    scopeId: string
    sessionId?: string
    now: number
  }): TranslationRow {
    const db = this.connection()
    const id = crypto.randomUUID()
    const occurrenceId = crypto.randomUUID()
    const transaction = db.transaction(() => {
      db.query(
        `
        INSERT INTO translations (
          id, profile_target_language, native_language, destination_policy,
          detected_source_language, destination_language, source_hash,
          source_text, source_char_count, translated_text, contract_version,
          created_at, updated_at, last_used_at, use_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT (
          profile_target_language, native_language, destination_policy,
          source_hash, contract_version
        ) DO UPDATE SET
          detected_source_language = excluded.detected_source_language,
          destination_language = excluded.destination_language,
          source_text = excluded.source_text,
          source_char_count = excluded.source_char_count,
          translated_text = excluded.translated_text,
          updated_at = excluded.updated_at,
          last_used_at = excluded.last_used_at,
          use_count = translations.use_count + 1
      `,
      ).run(
        id,
        input.identity.profileTargetLanguage,
        input.identity.nativeLanguage,
        input.identity.destinationPolicy,
        input.detectedSourceLanguage,
        input.destinationLanguage,
        input.identity.sourceHash,
        input.sourceText,
        input.sourceCharCount,
        truncateCodePoints(input.translatedText, MAX_TRANSLATION_CODEPOINTS),
        input.identity.contractVersion,
        input.now,
        input.now,
        input.now,
      )
      const row = this.find(input.identity)
      if (!row)
        throw new Error("Translation cache write could not be read back")
      db.query(
        `
        INSERT INTO translation_occurrences
          (id, translation_id, scope_id, session_id, used_at, cache_hit)
        VALUES (?, ?, ?, ?, ?, 0)
      `,
      ).run(
        occurrenceId,
        row.id,
        input.scopeId,
        input.sessionId ?? null,
        input.now,
      )
      return row
    })
    return transaction.immediate()
  }

  recordHit(
    id: string,
    input: { scopeId: string; sessionId?: string; now: number },
  ): void {
    const db = this.connection()
    db.transaction(() => {
      db.query(
        `
        UPDATE translations
        SET last_used_at = ?, use_count = use_count + 1
        WHERE id = ?
      `,
      ).run(input.now, id)
      db.query(
        `
        INSERT INTO translation_occurrences
          (id, translation_id, scope_id, session_id, used_at, cache_hit)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      ).run(
        crypto.randomUUID(),
        id,
        input.scopeId,
        input.sessionId ?? null,
        input.now,
      )
    }).immediate()
  }

  list(input: {
    profileTargetLanguage?: string
    destinationLanguage?: string
    query?: string
    cursor?: string
    limit: number
  }) {
    const clauses: string[] = []
    const values: Array<string | number> = []
    if (input.profileTargetLanguage) {
      clauses.push("profile_target_language = ?")
      values.push(input.profileTargetLanguage)
    }
    if (input.destinationLanguage) {
      clauses.push("destination_language = ?")
      values.push(input.destinationLanguage)
    }
    if (input.query?.trim()) {
      clauses.push(
        "(source_text LIKE ? ESCAPE '\\' OR translated_text LIKE ? ESCAPE '\\')",
      )
      const needle = `%${input.query.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
      values.push(needle, needle)
    }
    const cursor = decodeCursor(input.cursor)
    if (cursor) {
      clauses.push("(last_used_at < ? OR (last_used_at = ? AND id < ?))")
      values.push(cursor.lastUsedAt, cursor.lastUsedAt, cursor.id)
    }
    const rows = this.connection()
      .query<StoredTranslationRow, Array<string | number>>(
        `
      SELECT * FROM translations
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY last_used_at DESC, id DESC
      LIMIT ?
    `,
      )
      .all(...values, input.limit + 1)
      .flatMap((stored) => {
        const row = mapRow(stored)
        if (validRow(row)) return [row]
        this.delete(row.id)
        return []
      })
    const hasMore = rows.length > input.limit
    const items = rows.slice(0, input.limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ lastUsedAt: last.lastUsedAt, id: last.id })
          : undefined,
    }
  }

  summary(profileTargetLanguage?: string) {
    const row = this.connection()
      .query<
        {
          count: number
          uses: number
          last_used_at: number | null
        },
        [string | null, string | null]
      >(
        `
      SELECT COUNT(*) AS count, COALESCE(SUM(use_count), 0) AS uses,
             MAX(last_used_at) AS last_used_at
      FROM translations
      WHERE (? IS NULL OR profile_target_language = ?)
    `,
      )
      .get(profileTargetLanguage ?? null, profileTargetLanguage ?? null)
    return {
      translations: row?.count ?? 0,
      uses: row?.uses ?? 0,
      lastUsedAt: row?.last_used_at ?? undefined,
    }
  }

  delete(id: string): boolean {
    return (
      this.connection().query("DELETE FROM translations WHERE id = ?").run(id)
        .changes > 0
    )
  }

  clear(input: { scope: "target"; targetLanguage: string } | { scope: "all" }) {
    const db = this.connection()
    return db
      .transaction(() => {
        const count =
          input.scope === "all"
            ? (db
                .query<{ count: number }, []>(
                  "SELECT COUNT(*) AS count FROM translations",
                )
                .get()?.count ?? 0)
            : (db
                .query<{ count: number }, [string]>(
                  "SELECT COUNT(*) AS count FROM translations WHERE profile_target_language = ?",
                )
                .get(input.targetLanguage)?.count ?? 0)
        if (input.scope === "all") db.exec("DELETE FROM translations")
        else {
          db.query(
            "DELETE FROM translations WHERE profile_target_language = ?",
          ).run(input.targetLanguage)
        }
        return { deletedTranslations: count }
      })
      .immediate()
  }
}

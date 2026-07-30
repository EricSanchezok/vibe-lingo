import { createHash } from "node:crypto"
import type { Database } from "bun:sqlite"
import { containsSensitiveContent, sanitizeFragment } from "../domain/privacy"
import type { MessageIdentity } from "../domain/types"
import type { LearningProfile } from "../settings"
import { VibeLingoDatabase } from "./database"

export type CorrectionInput = {
  restatement: string
  corrections: Array<{
    originalFragment: string
    correctedFragment: string
  }>
}

export type CorrectionBatch = {
  id: string
  targetLanguage: string
  scopeId: string
  sessionId: string
  userMessageId: string
  assistantMessageId: string
  createdAt: number
  status: "pending" | "queued" | "analyzed" | "recorded_only" | "failed"
  correlationId: string
  callId?: string
  queuedAt?: number
  corrections: Array<{
    index: number
    originalFragment?: string
    correctedFragment?: string
    patternKey?: string
    accepted?: boolean
  }>
}

export class CorrectionRepository {
  constructor(readonly database: VibeLingoDatabase) {}

  create(input: {
    profile: LearningProfile
    identity: MessageIdentity
    assistantMessageId: string
    correction: CorrectionInput
  }): { kind: "created" | "existing" | "conflict"; batch?: CorrectionBatch } {
    const digest = createHash("sha256").update(JSON.stringify(input.correction)).digest("hex")
    const db = this.db()
    return db.transaction(() => {
      const existing = this.byAssistantMessage(
        input.profile.targetLanguage,
        input.assistantMessageId,
      )
      if (existing) {
        const row = db
          .query<{ input_digest: string }, [string]>(
            "SELECT input_digest FROM correction_batches WHERE id = ?",
          )
          .get(existing.id)
        return row?.input_digest === digest
          ? { kind: "existing" as const, batch: existing }
          : { kind: "conflict" as const, batch: existing }
      }

      const id = crypto.randomUUID()
      const correlationId = `correction:${id}`
      db.query(
        `INSERT INTO correction_batches
         (id, target_language, scope_id, session_id, user_message_id, assistant_message_id,
          created_at, analysis_status, correlation_id, input_digest)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      ).run(
        id,
        input.profile.targetLanguage,
        input.identity.scopeId,
        input.identity.sessionId,
        input.identity.messageId,
        input.assistantMessageId,
        input.identity.observedAt,
        correlationId,
        digest,
      )
      input.correction.corrections.forEach((correction, index) => {
        const sensitive =
          containsSensitiveContent(correction.originalFragment)
          || containsSensitiveContent(correction.correctedFragment)
        db.query(
          `INSERT INTO correction_items
           (id, batch_id, ordinal, original_fragment, corrected_fragment)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          id,
          index,
          sanitizeFragment(correction.originalFragment, sensitive) ?? null,
          sanitizeFragment(correction.correctedFragment, sensitive) ?? null,
        )
      })
      db.query(
        `INSERT OR IGNORE INTO learning_events
         (id, target_language, event_type, occurred_at, scope_id, session_id, message_id,
          correction_batch_id)
         VALUES (?, ?, 'correction_recorded', ?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        input.profile.targetLanguage,
        input.identity.observedAt,
        input.identity.scopeId,
        input.identity.sessionId,
        input.identity.messageId,
        id,
      )
      return { kind: "created" as const, batch: this.byId(id) }
    }).immediate()
  }

  byId(id: string): CorrectionBatch | undefined {
    const row = this.db()
      .query<Record<string, unknown>, [string]>(
        "SELECT * FROM correction_batches WHERE id = ?",
      )
      .get(id)
    return row ? this.toBatch(row) : undefined
  }

  byAssistantMessage(targetLanguage: string, assistantMessageId: string): CorrectionBatch | undefined {
    const row = this.db()
      .query<Record<string, unknown>, [string, string]>(
        `SELECT * FROM correction_batches
         WHERE target_language = ? AND assistant_message_id = ?`,
      )
      .get(targetLanguage, assistantMessageId)
    return row ? this.toBatch(row) : undefined
  }

  byCorrelation(correlationId: string): CorrectionBatch | undefined {
    const row = this.db()
      .query<Record<string, unknown>, [string]>(
        "SELECT * FROM correction_batches WHERE correlation_id = ?",
      )
      .get(correlationId)
    return row ? this.toBatch(row) : undefined
  }

  retryable(
    now = Date.now(),
    queuedGraceMs = 30_000,
    scopeId?: string,
  ): CorrectionBatch | undefined {
    const row = this.db()
      .query<Record<string, unknown>, Array<number | string>>(
        `SELECT * FROM correction_batches
         WHERE (
           analysis_status = 'pending'
           OR (
             analysis_status = 'queued'
             AND queued_at IS NOT NULL
             AND queued_at <= ?
           )
         )
         ${scopeId ? "AND scope_id = ?" : ""}
         ORDER BY created_at, id LIMIT 1`,
      )
      .get(now - queuedGraceMs, ...(scopeId ? [scopeId] : []))
    return row ? this.toBatch(row) : undefined
  }

  markQueued(id: string, callId: string, queuedAt = Date.now()): void {
    this.db()
      .query(
        `UPDATE correction_batches
         SET analysis_status = 'queued', call_id = ?, queued_at = ? WHERE id = ?`,
      )
      .run(callId, queuedAt, id)
  }

  markFailed(id: string): void {
    this.db()
      .query(
        `UPDATE correction_batches SET analysis_status = 'failed'
         WHERE id = ? AND analysis_status IN ('pending', 'queued')`,
      )
      .run(id)
  }

  markRecordedOnly(id: string): void {
    this.db()
      .query(
        `UPDATE correction_batches SET analysis_status = 'recorded_only'
         WHERE id = ? AND analysis_status IN ('pending', 'queued')`,
      )
      .run(id)
  }

  private toBatch(row: Record<string, unknown>): CorrectionBatch {
    const id = String(row.id)
    const corrections = this.db()
      .query<{
        ordinal: number
        original_fragment: string | null
        corrected_fragment: string | null
        pattern_key: string | null
        accepted: number | null
      }, [string]>(
        `SELECT ordinal, original_fragment, corrected_fragment, pattern_key, accepted
         FROM correction_items WHERE batch_id = ? ORDER BY ordinal`,
      )
      .all(id)
      .map((item) => ({
        index: Number(item.ordinal),
        ...(item.original_fragment ? { originalFragment: item.original_fragment } : {}),
        ...(item.corrected_fragment ? { correctedFragment: item.corrected_fragment } : {}),
        ...(item.pattern_key ? { patternKey: item.pattern_key } : {}),
        ...(item.accepted == null ? {} : { accepted: Boolean(item.accepted) }),
      }))
    return {
      id,
      targetLanguage: String(row.target_language),
      scopeId: String(row.scope_id),
      sessionId: String(row.session_id),
      userMessageId: String(row.user_message_id),
      assistantMessageId: String(row.assistant_message_id),
      createdAt: Number(row.created_at),
      status: String(row.analysis_status) as CorrectionBatch["status"],
      correlationId: String(row.correlation_id),
      ...(typeof row.call_id === "string" ? { callId: row.call_id } : {}),
      ...(typeof row.queued_at === "number" ? { queuedAt: row.queued_at } : {}),
      corrections,
    }
  }

  private db(): Database {
    return this.database.connection()
  }
}

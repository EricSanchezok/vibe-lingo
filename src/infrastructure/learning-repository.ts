import type { Database } from "bun:sqlite"
import { containsSensitiveContent, sanitizeFragment } from "../domain/privacy"
import {
  DAY_MS,
  ErrorCategorySchema,
  ErrorSeveritySchema,
  MAX_STORED_EXAMPLES,
  MIN_DEMONSTRATION_CONFIDENCE,
  MIN_FINDING_CONFIDENCE,
  type ClearLearningDataResult,
  type ErrorCategory,
  type EvidenceKind,
  type EvidenceOutcome,
  type KnownPattern,
  type LearningEventType,
  type LearningSummary,
  type MessageIdentity,
  type MessageReason,
  type PatternDisplayStatus,
  type PatternStage,
  type ProgressExample,
  type ProgressPattern,
  type ProgressSnapshot,
  type RecurringPattern,
  type ReviewQueueItem,
  type ReviewOutcome,
  type ReviewSessionStatus,
  type StoredDemonstration,
  type StoredFinding,
  type TrendPoint,
} from "../domain/types"
import { canonicalTimeZone, dateRange, localDate, shiftDate } from "../domain/time"
import { VibeLingoDatabase } from "./database"
import {
  count,
  cursorMatches,
  decodeCursor,
  encodeCursor,
  escapeLike,
  patternCursor,
  toProgress,
  toRecurring,
  type PatternRow,
} from "./query-support"

type ProfileInput = {
  nativeLanguage: string
  targetLanguage: string
  proficiency: "beginner" | "intermediate" | "advanced"
}

const PATTERN_KEY = /^[a-z][a-z0-9_]{2,63}$/

function validFinding(finding: StoredFinding): boolean {
  return PATTERN_KEY.test(finding.patternKey)
    && ErrorCategorySchema.safeParse(finding.category).success
    && ErrorSeveritySchema.safeParse(finding.severity).success
    && Array.from(finding.label).length > 0
    && Array.from(finding.label).length <= 80
    && Array.from(finding.rule).length > 0
    && Array.from(finding.rule).length <= 200
    && !containsSensitiveContent(finding.label)
    && !containsSensitiveContent(finding.rule)
}

export class LearningRepository {
  constructor(readonly database: VibeLingoDatabase) {}

  initialize(): void {
    this.database.initialize()
  }

  close(): void {
    this.database.close()
  }

  isAnalyzed(messageId: string, targetLanguage: string): boolean {
    const row = this.db()
      .query<{ present: number }, [string, string]>(
        "SELECT 1 AS present FROM analyzed_messages WHERE message_id = ? AND target_language = ?",
      )
      .get(messageId, targetLanguage)
    return Boolean(row)
  }

  rememberProfile(profile: ProfileInput, usedAt = Date.now()): void {
    const transaction = this.db().transaction(() => this.upsertProfile(profile, usedAt))
    transaction.immediate()
  }

  recordSkipped(
    identity: MessageIdentity,
    profile: ProfileInput,
    reason?: MessageReason,
  ): boolean {
    const db = this.db()
    const transaction = db.transaction(() => {
      this.upsertProfile(profile, identity.observedAt)
      const result = db
        .query(
          `INSERT OR IGNORE INTO analyzed_messages
           (target_language, message_id, scope_id, session_id, analyzed_at, classification, reason)
           VALUES (?, ?, ?, ?, ?, 'skipped', ?)`,
        )
        .run(profile.targetLanguage, identity.messageId, identity.scopeId, identity.sessionId, identity.observedAt, reason ?? "historical_unknown")
      return count(result.changes) > 0
    })
    return transaction.immediate()
  }

  recordAnalysis(
    identity: MessageIdentity,
    profile: ProfileInput,
    isTargetLanguageAttempt: boolean,
    findings: StoredFinding[],
    demonstrations: StoredDemonstration[],
    reason?: MessageReason,
  ): boolean {
    const db = this.db()
    const transaction = db.transaction(() => {
      this.upsertProfile(profile, identity.observedAt)
      const inserted = db
        .query(
          `INSERT OR IGNORE INTO analyzed_messages
           (target_language, message_id, scope_id, session_id, analyzed_at, classification,
            reason, finding_count, demonstration_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          profile.targetLanguage,
          identity.messageId,
          identity.scopeId,
          identity.sessionId,
          identity.observedAt,
          isTargetLanguageAttempt ? "target_attempt" : "not_target",
          reason ?? (isTargetLanguageAttempt ? "target_attempt" : "not_target_language"),
          0,
          0,
        )
      if (count(inserted.changes) === 0) return false

      if (isTargetLanguageAttempt) {
        this.insertEvent({
          targetLanguage: profile.targetLanguage,
          type: "practice_started",
          at: identity.observedAt,
          identity,
        })
      }

      const errored = new Set<string>()
      let storedFindingCount = 0
      let storedDemonstrationCount = 0
      for (const finding of (isTargetLanguageAttempt ? findings : [])
        .filter(
          (item) =>
            Number.isFinite(item.confidence)
            && item.confidence >= MIN_FINDING_CONFIDENCE
            && item.confidence <= 1
            && validFinding(item),
        )
        .slice(0, 2)) {
        const canonical = this.resolveCanonical(profile.targetLanguage, finding.patternKey)
        if (this.isRejected(profile.targetLanguage, canonical)) continue
        errored.add(canonical)
        const existing = this.pattern(profile.targetLanguage, canonical)
        db.query(
          `INSERT INTO learning_patterns
           (target_language, pattern_key, category, severity, label, rule, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(target_language, pattern_key) DO UPDATE SET
             category = excluded.category,
             severity = CASE
               WHEN learning_patterns.severity = 'meaning_affecting' THEN learning_patterns.severity
               WHEN excluded.severity = 'meaning_affecting' THEN excluded.severity
               WHEN learning_patterns.severity = 'high_value' THEN learning_patterns.severity
               ELSE excluded.severity
             END,
             label = excluded.label,
             rule = excluded.rule,
             last_seen_at = MAX(learning_patterns.last_seen_at, excluded.last_seen_at),
             revision = learning_patterns.revision + 1`,
        ).run(
          profile.targetLanguage,
          canonical,
          finding.category,
          finding.severity,
          finding.label,
          finding.rule,
          identity.observedAt,
          identity.observedAt,
        )
        if (!existing) {
          this.insertEvent({
            targetLanguage: profile.targetLanguage,
            type: "pattern_discovered",
            at: identity.observedAt,
            identity,
            patternKey: canonical,
          })
        }
        const originalFragment = finding.originalFragment
          ? sanitizeFragment(finding.originalFragment, finding.sensitive)
          : undefined
        const correctedFragment = finding.correctedFragment
          ? sanitizeFragment(finding.correctedFragment, finding.sensitive)
          : undefined
        const evidence = db.query(
          `INSERT OR IGNORE INTO pattern_evidence
           (id, target_language, pattern_key, kind, outcome, severity, confidence,
            scope_id, session_id, message_id, observed_at, original_fragment, corrected_fragment)
           VALUES (?, ?, ?, 'error', 'incorrect', ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          profile.targetLanguage,
          canonical,
          finding.severity,
          finding.confidence,
          identity.scopeId,
          identity.sessionId,
          identity.messageId,
          identity.observedAt,
          originalFragment ?? null,
          correctedFragment ?? null,
        )
        if (count(evidence.changes) === 0) continue
        storedFindingCount++

        const before = this.pattern(profile.targetLanguage, canonical)
        if (before?.disposition === "active" && before.stage === "verified") {
          db.query(
            `UPDATE learning_patterns
             SET stage = 'practicing', verified_at = NULL, schedule_step = 0,
                 due_at = ?, lapse_count = lapse_count + 1, last_lapsed_at = ?, revision = revision + 1
             WHERE target_language = ? AND pattern_key = ?`,
          ).run(identity.observedAt + DAY_MS, identity.observedAt, profile.targetLanguage, canonical)
          this.insertEvent({
            targetLanguage: profile.targetLanguage,
            type: "pattern_lapsed",
            at: identity.observedAt,
            identity,
            patternKey: canonical,
          })
        } else if (before?.disposition === "active") {
          this.promoteIfRecurring(profile.targetLanguage, canonical, identity)
        }
        // Ignored patterns retain evidence but keep their frozen lifecycle and schedule.
        this.trimEvidence(profile.targetLanguage, canonical)
      }

      for (const demonstration of (isTargetLanguageAttempt ? demonstrations : [])
        .filter(
          (item) =>
            PATTERN_KEY.test(item.patternKey)
            && Number.isFinite(item.confidence)
            && item.confidence >= MIN_DEMONSTRATION_CONFIDENCE
            && item.confidence <= 1,
        )
        .slice(0, 2)) {
        const canonical = this.resolveCanonical(profile.targetLanguage, demonstration.patternKey)
        if (errored.has(canonical)) continue
        const pattern = this.pattern(profile.targetLanguage, canonical)
        if (!pattern || pattern.disposition !== "active") continue
        const fragment = demonstration.fragment
          ? sanitizeFragment(demonstration.fragment, demonstration.sensitive)
          : undefined
        const evidence = db.query(
          `INSERT OR IGNORE INTO pattern_evidence
           (id, target_language, pattern_key, kind, outcome, confidence,
            scope_id, session_id, message_id, observed_at, corrected_fragment)
           VALUES (?, ?, ?, 'natural_correct', 'correct', ?, ?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          profile.targetLanguage,
          canonical,
          demonstration.confidence,
          identity.scopeId,
          identity.sessionId,
          identity.messageId,
          identity.observedAt,
          fragment ?? null,
        )
        if (count(evidence.changes) > 0) storedDemonstrationCount++
        this.recomputeVerified(profile.targetLanguage, canonical, identity.observedAt)
        this.trimEvidence(profile.targetLanguage, canonical)
      }

      db.query(
        `UPDATE analyzed_messages SET finding_count = ?, demonstration_count = ?
         WHERE target_language = ? AND message_id = ?`,
      ).run(storedFindingCount, storedDemonstrationCount, profile.targetLanguage, identity.messageId)
      this.bumpRevision(profile.targetLanguage)
      return true
    })
    return transaction.immediate()
  }

  knownPatterns(targetLanguage: string, limit = 40): KnownPattern[] {
    const canonical = this.db()
      .query<{
        pattern_key: string
        category: ErrorCategory
        label: string
        rule: string
        stage: PatternStage
      }, [string, number]>(
        `SELECT pattern_key, category, label, rule, stage
         FROM learning_patterns
         WHERE target_language = ? AND disposition != 'rejected'
         ORDER BY last_seen_at DESC LIMIT ?`,
      )
      .all(targetLanguage, limit)
      .map((row) => ({
        patternKey: row.pattern_key,
        canonicalKey: row.pattern_key,
        category: row.category,
        label: row.label,
        rule: row.rule,
        stage: row.stage,
      }))
    const aliases = this.db()
      .query<{ alias_key: string; canonical_key: string }, [string]>(
        "SELECT alias_key, canonical_key FROM pattern_aliases WHERE target_language = ?",
      )
      .all(targetLanguage)
    const aliasesByCanonical = new Map<string, string[]>()
    for (const alias of aliases) {
      const values = aliasesByCanonical.get(alias.canonical_key) ?? []
      values.push(alias.alias_key)
      aliasesByCanonical.set(alias.canonical_key, values)
    }
    return canonical
      .flatMap((pattern) => [
        pattern,
        ...(aliasesByCanonical.get(pattern.canonicalKey) ?? []).map((alias) => ({
          ...pattern,
          patternKey: alias,
        })),
      ])
      .slice(0, limit)
  }

  suppressedKeys(targetLanguage: string): string[] {
    return this.db()
      .query<{ pattern_key: string }, [string]>(
        `SELECT pattern_key FROM learning_patterns
         WHERE target_language = ? AND disposition = 'rejected'
         ORDER BY last_seen_at DESC LIMIT 100`,
      )
      .all(targetLanguage)
      .map((row) => row.pattern_key)
  }

  recurringPatterns(targetLanguage: string, limit = 3): RecurringPattern[] {
    return this.patternRows({
      targetLanguage,
      where: "p.disposition = 'active' AND p.stage = 'practicing'",
      order: `CASE p.severity WHEN 'meaning_affecting' THEN 3 WHEN 'high_value' THEN 2 ELSE 1 END DESC,
              occurrence_count DESC, p.last_seen_at DESC`,
      limit,
    }).map((row) => toRecurring(row))
  }

  profileList(): Array<{
    targetLanguage: string
    nativeLanguage: string
    proficiency: string
    firstUsedAt: number
    lastUsedAt: number
  }> {
    return this.db()
      .query<{
        target_language: string
        native_language: string
        proficiency: string
        first_used_at: number
        last_used_at: number
      }, []>(
        `SELECT target_language, native_language, proficiency, first_used_at, last_used_at
         FROM learning_profiles ORDER BY last_used_at DESC`,
      )
      .all()
      .map((row) => ({
        targetLanguage: row.target_language,
        nativeLanguage: row.native_language,
        proficiency: row.proficiency,
        firstUsedAt: count(row.first_used_at),
        lastUsedAt: count(row.last_used_at),
      }))
  }

  learningSummary(
    targetLanguage: string,
    input: { scopeId?: string; timeZone?: string; now?: number } = {},
  ): LearningSummary {
    const db = this.db()
    const now = input.now ?? Date.now()
    const timeZone = canonicalTimeZone(input.timeZone)
    const messageWhere = input.scopeId ? " AND scope_id = ?" : ""
    const messageBindings = input.scopeId ? [targetLanguage, input.scopeId] : [targetLanguage]
    const messages = db
      .query<{
        analyzed: number
        attempts: number
        sessions: number
        first_attempt: number | null
      }, string[]>(
        `SELECT COUNT(*) AS analyzed,
                SUM(classification = 'target_attempt') AS attempts,
                COUNT(DISTINCT CASE WHEN classification = 'target_attempt' THEN session_id END) AS sessions,
                MIN(CASE WHEN classification = 'target_attempt' THEN analyzed_at END) AS first_attempt
         FROM analyzed_messages WHERE target_language = ?${messageWhere}`,
      )
      .get(...messageBindings)
    const patternScopeClause = input.scopeId
      ? ` AND EXISTS (
          SELECT 1 FROM pattern_evidence scoped
          WHERE scoped.target_language = learning_patterns.target_language
            AND scoped.pattern_key = learning_patterns.pattern_key
            AND scoped.scope_id = ?
        )`
      : ""
    const patternCountBindings: Array<string | number> = [now, targetLanguage]
    if (input.scopeId) patternCountBindings.push(input.scopeId)
    const patternCounts = db
      .query<{
        total: number
        recurring: number
        candidate: number
        practicing: number
        due: number
        verified: number
      }, Array<string | number>>(
        `SELECT SUM(disposition = 'active') AS total,
                SUM(stage = 'practicing' AND disposition = 'active') AS recurring,
                SUM(stage = 'candidate' AND disposition = 'active') AS candidate,
                SUM(stage = 'practicing' AND disposition = 'active') AS practicing,
                SUM(
                  stage = 'practicing' AND disposition = 'active' AND due_at <= ?
                  AND NOT EXISTS (
                    SELECT 1 FROM review_items ri
                    JOIN review_sessions rs ON rs.id = ri.review_id
                    WHERE ri.target_language = learning_patterns.target_language
                      AND ri.pattern_key = learning_patterns.pattern_key
                      AND rs.status IN ('active', 'paused')
                  )
                ) AS due,
                SUM(stage = 'verified' AND disposition = 'active') AS verified
         FROM learning_patterns WHERE target_language = ?${patternScopeClause}`,
      )
      .get(...patternCountBindings)
    const evidenceWhere = input.scopeId ? " AND scope_id = ?" : ""
    const findingBindings: Array<string | number> = [targetLanguage, now - 30 * DAY_MS]
    if (input.scopeId) findingBindings.push(input.scopeId)
    const recentFindings = db
      .query<{ count: number }, Array<string | number>>(
        `SELECT COUNT(*) AS count FROM pattern_evidence
         WHERE target_language = ? AND kind = 'error' AND observed_at >= ?${evidenceWhere}`,
      )
      .get(...findingBindings)
    const reviewScopeClause = input.scopeId ? " AND scope_id = ?" : ""
    const reviewBindings = input.scopeId ? [targetLanguage, input.scopeId] : [targetLanguage]
    const reviews = db
      .query<{ count: number }, string[]>(
        `SELECT COUNT(*) AS count FROM review_sessions
         WHERE target_language = ? AND status = 'completed'${reviewScopeClause}`,
      )
      .get(...reviewBindings)
    const reviewEvidenceBindings: Array<string | number> = [
      targetLanguage,
      now - 30 * DAY_MS,
    ]
    if (input.scopeId) reviewEvidenceBindings.push(input.scopeId)
    const reviewEvidence = db
      .query<{
        recall_count: number
        independent_recall_count: number
        transfer_count: number
        transfer_sessions: number
      }, Array<string | number>>(
        `SELECT
           SUM(kind = 'review_recall') AS recall_count,
           SUM(kind = 'review_recall' AND outcome = 'independent') AS independent_recall_count,
           SUM(kind = 'review_transfer' AND outcome IN ('independent', 'assisted')) AS transfer_count,
           COUNT(DISTINCT CASE
             WHEN kind = 'review_transfer' AND outcome IN ('independent', 'assisted')
             THEN session_id
           END) AS transfer_sessions
         FROM pattern_evidence
         WHERE target_language = ? AND observed_at >= ?${evidenceWhere}`,
      )
      .get(...reviewEvidenceBindings)
    const awaitingBindings: Array<string | number> = [targetLanguage]
    if (input.scopeId) awaitingBindings.push(input.scopeId)
    const awaitingVerification = db
      .query<{ count: number }, Array<string | number>>(
        `SELECT COUNT(*) AS count FROM learning_patterns p
         WHERE p.target_language = ? AND p.disposition = 'active' AND p.stage = 'practicing'
           AND EXISTS (
             SELECT 1 FROM pattern_evidence e
             WHERE e.target_language = p.target_language
               AND e.pattern_key = p.pattern_key
               AND e.kind = 'review_transfer'
               AND e.outcome = 'independent'
               ${input.scopeId ? "AND e.scope_id = ?" : ""}
           )`,
      )
      .get(...awaitingBindings)
    const naturalBindings: Array<string | number> = [targetLanguage]
    if (input.scopeId) naturalBindings.push(input.scopeId)
    const recentNatural = db
      .query<{
        pattern_key: string
        label: string
        corrected_fragment: string
        observed_at: number
      }, Array<string | number>>(
        `SELECT e.pattern_key, p.label, e.corrected_fragment, e.observed_at
         FROM pattern_evidence e
         JOIN learning_patterns p
           ON p.target_language = e.target_language AND p.pattern_key = e.pattern_key
         WHERE e.target_language = ? AND e.kind = 'natural_correct'
           AND e.corrected_fragment IS NOT NULL
           ${input.scopeId ? "AND e.scope_id = ?" : ""}
         ORDER BY e.observed_at DESC, e.id DESC LIMIT 1`,
      )
      .get(...naturalBindings)
    let recentNaturalUse: LearningSummary["recentNaturalUse"]
    if (recentNatural) {
      const sessionsBindings: string[] = [targetLanguage, recentNatural.pattern_key]
      if (input.scopeId) sessionsBindings.push(input.scopeId)
      const naturalSessions = db
        .query<{ count: number }, string[]>(
          `SELECT COUNT(DISTINCT session_id) AS count FROM pattern_evidence
           WHERE target_language = ? AND pattern_key = ? AND kind = 'natural_correct'
             ${input.scopeId ? "AND scope_id = ?" : ""}`,
        )
        .get(...sessionsBindings)
      recentNaturalUse = {
        patternKey: recentNatural.pattern_key,
        label: recentNatural.label,
        fragment: recentNatural.corrected_fragment,
        sessionCount: count(naturalSessions?.count),
        observedAt: count(recentNatural.observed_at),
      }
    }

    const attemptRows = db
      .query<{ analyzed_at: number }, string[]>(
        `SELECT analyzed_at FROM analyzed_messages
         WHERE target_language = ? AND classification = 'target_attempt'${messageWhere}
         ORDER BY analyzed_at`,
      )
      .all(...messageBindings)
    const reviewRows = db
      .query<{ completed_at: number }, string[]>(
        `SELECT completed_at FROM review_sessions
         WHERE target_language = ? AND status = 'completed' AND completed_at IS NOT NULL${reviewScopeClause}`,
      )
      .all(...reviewBindings)
    const activeDates = new Set([
      ...attemptRows.map((row) => localDate(count(row.analyzed_at), timeZone)),
      ...reviewRows.map((row) => localDate(count(row.completed_at), timeZone)),
    ])
    let streak = 0
    const today = localDate(now, timeZone)
    const firstStreakOffset = activeDates.has(today)
      ? 0
      : activeDates.has(shiftDate(today, -1))
        ? 1
        : undefined
    for (let offset = firstStreakOffset ?? 0; firstStreakOffset != null && offset < 10_000; offset++) {
      if (!activeDates.has(shiftDate(today, -offset))) break
      streak++
    }

    const trends = {
      "7": this.trend(targetLanguage, 7, timeZone, now, input.scopeId),
      "30": this.trend(targetLanguage, 30, timeZone, now, input.scopeId),
      "90": this.trend(targetLanguage, 90, timeZone, now, input.scopeId),
    }
    const firstAttempt = messages?.first_attempt == null ? undefined : count(messages.first_attempt)
    return {
      analyzedMessages: count(messages?.analyzed),
      findingsLast30Days: count(recentFindings?.count),
      totalPatternCount: count(patternCounts?.total),
      recurringPatternCount: count(patternCounts?.recurring),
      candidatePatternCount: count(patternCounts?.candidate),
      practicingPatternCount: count(patternCounts?.practicing),
      targetAttempts: count(messages?.attempts),
      activeDays: activeDates.size,
      sessionCount: count(messages?.sessions),
      duePatternCount: count(patternCounts?.due),
      reviewCount: count(reviews?.count),
      reviewRecallCountLast30Days: count(reviewEvidence?.recall_count),
      independentRecallCountLast30Days: count(reviewEvidence?.independent_recall_count),
      successfulTransferCountLast30Days: count(reviewEvidence?.transfer_count),
      successfulTransferSessionCountLast30Days: count(reviewEvidence?.transfer_sessions),
      awaitingVerificationCount: count(awaitingVerification?.count),
      verifiedPatternCount: count(patternCounts?.verified),
      currentStreakDays: streak,
      learningWeek: firstAttempt
        ? Math.max(
            1,
            Math.floor(
              (Date.parse(today) - Date.parse(localDate(firstAttempt, timeZone)))
              / (7 * DAY_MS),
            ) + 1,
          )
        : 0,
      recentNaturalUse,
      trends,
    }
  }

  progress(input: {
    targetLanguage: string
    scopeId?: string
    limit: number
    includeExamples: boolean
    now?: number
    timeZone?: string
  }): ProgressSnapshot {
    const rows = this.patternRows({
      targetLanguage: input.targetLanguage,
      scopeId: input.scopeId,
      where: "p.disposition = 'active'",
      order: `CASE p.stage WHEN 'practicing' THEN 3 WHEN 'verified' THEN 2 ELSE 1 END DESC,
              occurrence_count DESC, p.last_seen_at DESC`,
      limit: input.limit,
    })
    return {
      targetLanguage: input.targetLanguage,
      summary: this.learningSummary(input.targetLanguage, input),
      patterns: rows.map((row) => ({
        ...toProgress(row, input.now ?? Date.now()),
        examples: input.includeExamples
          ? this.examples(input.targetLanguage, row.pattern_key, input.scopeId)
          : [],
      })),
    }
  }

  listPatterns(input: {
    targetLanguage: string
    scopeId?: string
    status?: PatternDisplayStatus | "ignored" | "rejected"
    query?: string
    sort?: "priority" | "recent" | "frequency" | "due"
    cursor?: string
    limit: number
    now?: number
  }): { items: ProgressPattern[]; nextCursor?: string } {
    const now = input.now ?? Date.now()
    let where = input.status && ["ignored", "rejected"].includes(input.status)
      ? "p.disposition = ?"
      : "p.disposition = 'active'"
    const bindings: Array<string | number> = []
    if (input.status && ["ignored", "rejected"].includes(input.status)) {
      bindings.push(input.status)
    }
    if (input.status === "focus") {
      where += " AND p.stage = 'practicing' AND p.disposition = 'active' AND p.due_at <= ?"
      bindings.push(now)
    } else if (input.status === "improving") {
      where += " AND p.stage = 'practicing' AND p.due_at > ?"
      bindings.push(now)
    } else if (input.status === "new") {
      where += " AND p.stage = 'candidate'"
    } else if (input.status === "verified") {
      where += " AND p.stage = 'verified'"
    }
    if (input.query?.trim()) {
      where += ` AND (
        LOWER(p.pattern_key) LIKE ? ESCAPE '\\'
        OR LOWER(p.label) LIKE ? ESCAPE '\\'
        OR LOWER(p.rule) LIKE ? ESCAPE '\\'
      )`
      const query = `%${escapeLike(input.query.trim().toLowerCase())}%`
      bindings.push(query, query, query)
    }
    const sort = input.sort ?? "priority"
    const order = sort === "frequency"
      ? "occurrence_count DESC, p.last_seen_at DESC, p.pattern_key"
      : sort === "due"
        ? "COALESCE(p.due_at, 9007199254740991) ASC, p.last_seen_at DESC, p.pattern_key"
        : sort === "recent"
          ? "p.last_seen_at DESC, p.pattern_key"
          : `stage_rank DESC, severity_rank DESC,
             occurrence_count DESC, p.last_seen_at DESC, p.pattern_key`
    const cursor = decodeCursor(input.cursor)
    const expectedCursor = sort === "recent"
      ? ["number", "string"] as const
      : sort === "priority"
        ? ["number", "number", "number", "number", "string"] as const
        : ["number", "number", "string"] as const
    if (input.cursor && !cursorMatches(cursor, [...expectedCursor])) {
      throw new Error("Invalid cursor")
    }
    let having: string | undefined
    const havingBindings: Array<string | number> = []
    if (cursor) {
      if (sort === "recent" && cursor.length === 2) {
        having = "(p.last_seen_at < ? OR (p.last_seen_at = ? AND p.pattern_key > ?))"
        havingBindings.push(cursor[0], cursor[0], cursor[1])
      } else if (sort === "frequency" && cursor.length === 3) {
        having = `(occurrence_count < ?
          OR (occurrence_count = ? AND p.last_seen_at < ?)
          OR (occurrence_count = ? AND p.last_seen_at = ? AND p.pattern_key > ?))`
        havingBindings.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
      } else if (sort === "due" && cursor.length === 3) {
        having = `(COALESCE(p.due_at, 9007199254740991) > ?
          OR (COALESCE(p.due_at, 9007199254740991) = ? AND p.last_seen_at < ?)
          OR (COALESCE(p.due_at, 9007199254740991) = ? AND p.last_seen_at = ? AND p.pattern_key > ?))`
        havingBindings.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
      } else if (sort === "priority" && cursor.length === 5) {
        having = `(stage_rank < ?
          OR (stage_rank = ? AND severity_rank < ?)
          OR (stage_rank = ? AND severity_rank = ? AND occurrence_count < ?)
          OR (stage_rank = ? AND severity_rank = ? AND occurrence_count = ? AND p.last_seen_at < ?)
          OR (stage_rank = ? AND severity_rank = ? AND occurrence_count = ? AND p.last_seen_at = ? AND p.pattern_key > ?))`
        havingBindings.push(
          cursor[0],
          cursor[0], cursor[1],
          cursor[0], cursor[1], cursor[2],
          cursor[0], cursor[1], cursor[2], cursor[3],
          cursor[0], cursor[1], cursor[2], cursor[3], cursor[4],
        )
      }
    }
    const rows = this.patternRows({
      targetLanguage: input.targetLanguage,
      scopeId: input.scopeId,
      where,
      order,
      limit: input.limit + 1,
      extraBindings: bindings,
      having,
      havingBindings,
    })
    const visible = rows.slice(0, input.limit)
    return {
      items: visible.map((row) => ({ ...toProgress(row, now), examples: [] })),
      nextCursor: rows.length > input.limit && visible.length
        ? patternCursor(visible.at(-1)!, sort)
        : undefined,
    }
  }

  patternDetail(targetLanguage: string, patternKey: string, scopeId?: string): ProgressPattern | undefined {
    const canonical = this.resolveCanonical(targetLanguage, patternKey)
    const row = this.patternRows({
      targetLanguage,
      scopeId,
      where: "p.pattern_key = ?",
      order: "p.last_seen_at DESC",
      limit: 1,
      extraBindings: [canonical],
    })[0]
    if (!row) return undefined
    return {
      ...toProgress(row),
      examples: this.examples(targetLanguage, canonical, scopeId),
    }
  }

  presentationSources(
    targetLanguage: string,
    patternKeys: string[],
  ): Array<{ patternKey: string; label: string; rule: string }> {
    const canonicalKeys = [...new Set(
      patternKeys
        .filter((key) => PATTERN_KEY.test(key))
        .map((key) => this.resolveCanonical(targetLanguage, key)),
    )]
    if (canonicalKeys.length === 0) return []
    const placeholders = canonicalKeys.map(() => "?").join(",")
    const rows = this.db().query<{
      pattern_key: string
      label: string
      rule: string
    }, string[]>(
      `SELECT pattern_key, label, rule
       FROM learning_patterns
       WHERE target_language = ? AND pattern_key IN (${placeholders})`,
    ).all(targetLanguage, ...canonicalKeys)
    const byKey = new Map(rows.map((row) => [row.pattern_key, row]))
    return canonicalKeys.flatMap((key) => {
      const row = byKey.get(key)
      return row
        ? [{ patternKey: row.pattern_key, label: row.label, rule: row.rule }]
        : []
    })
  }

  reviewQueue(targetLanguage: string, limit = 3, now = Date.now()): ReviewQueueItem[] {
    return this.queueRows(targetLanguage, limit, now, false)
  }

  upcomingReviewQueue(
    targetLanguage: string,
    limit = 10,
    now = Date.now(),
  ): ReviewQueueItem[] {
    return this.queueRows(targetLanguage, limit, now, true)
  }

  patternEvidence(
    targetLanguage: string,
    patternKey: string,
    input: { scopeId?: string; limit?: number } = {},
  ): Array<{
    id: string
    kind: EvidenceKind
    outcome: EvidenceOutcome
    confidence: number
    observedAt: number
    scopeId?: string
    sessionId?: string
    messageId?: string
    reviewItemId?: string
    originalFragment?: string
    correctedFragment?: string
  }> {
    const canonical = this.resolveCanonical(targetLanguage, patternKey)
    const scopeClause = input.scopeId ? " AND scope_id = ?" : ""
    const bindings: Array<string | number> = [targetLanguage, canonical]
    if (input.scopeId) bindings.push(input.scopeId)
    bindings.push(Math.max(1, Math.min(100, input.limit ?? 50)))
    return this.db().query<{
      id: string
      kind: EvidenceKind
      outcome: EvidenceOutcome
      confidence: number
      observed_at: number
      scope_id: string | null
      session_id: string | null
      message_id: string | null
      review_item_id: string | null
      original_fragment: string | null
      corrected_fragment: string | null
    }, Array<string | number>>(
      `SELECT id, kind, outcome, confidence, observed_at, scope_id, session_id,
              message_id, review_item_id, original_fragment, corrected_fragment
       FROM pattern_evidence
       WHERE target_language = ? AND pattern_key = ?${scopeClause}
       ORDER BY observed_at DESC, id DESC LIMIT ?`,
    ).all(...bindings).map((row) => ({
      id: row.id,
      kind: row.kind,
      outcome: row.outcome,
      confidence: Number(row.confidence),
      observedAt: count(row.observed_at),
      scopeId: row.scope_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      messageId: row.message_id ?? undefined,
      reviewItemId: row.review_item_id ?? undefined,
      originalFragment: row.original_fragment ?? undefined,
      correctedFragment: row.corrected_fragment ?? undefined,
    }))
  }

  patternReviewHistory(
    targetLanguage: string,
    patternKey: string,
    limit = 20,
    scopeId?: string,
  ): Array<{
    reviewId: string
    itemId: string
    status: ReviewSessionStatus
    outcome?: ReviewOutcome
    hintCount: number
    startedAt: number
    completedAt?: number
    challenge?: string
    referenceAnswer?: string
    transferChallenge?: string
    latestAnswer?: string
    latestFeedback?: string
  }> {
    const canonical = this.resolveCanonical(targetLanguage, patternKey)
    const scopeClause = scopeId ? " AND rs.scope_id = ?" : ""
    const bindings: Array<string | number> = [targetLanguage, canonical]
    if (scopeId) bindings.push(scopeId)
    bindings.push(Math.max(1, Math.min(100, limit)))
    return this.db().query<{
      review_id: string
      item_id: string
      status: ReviewSessionStatus
      outcome: ReviewOutcome | null
      hint_count: number
      started_at: number
      completed_at: number | null
      challenge: string | null
      reference_answer: string | null
      transfer_challenge: string | null
      latest_answer: string | null
      latest_feedback: string | null
    }, Array<string | number>>(
      `SELECT rs.id AS review_id, ri.id AS item_id, rs.status, ri.outcome,
              ri.hint_level AS hint_count, rs.started_at, ri.completed_at,
              ri.challenge, ri.reference_answer, ri.transfer_challenge,
              (
                SELECT ra.answer FROM review_attempts ra
                WHERE ra.item_id = ri.id
                ORDER BY ra.created_at DESC, ra.id DESC LIMIT 1
              ) AS latest_answer,
              (
                SELECT ra.feedback FROM review_attempts ra
                WHERE ra.item_id = ri.id
                ORDER BY ra.created_at DESC, ra.id DESC LIMIT 1
              ) AS latest_feedback
       FROM review_items ri
       JOIN review_sessions rs ON rs.id = ri.review_id
       WHERE ri.target_language = ? AND ri.pattern_key = ?${scopeClause}
       ORDER BY COALESCE(ri.completed_at, rs.updated_at) DESC, ri.id DESC
       LIMIT ?`,
    ).all(...bindings).map((row) => ({
      reviewId: row.review_id,
      itemId: row.item_id,
      status: row.status,
      outcome: row.outcome ?? undefined,
      hintCount: count(row.hint_count),
      startedAt: count(row.started_at),
      completedAt: row.completed_at == null ? undefined : count(row.completed_at),
      challenge: row.challenge ?? undefined,
      referenceAnswer: row.reference_answer ?? undefined,
      transferChallenge: row.transfer_challenge ?? undefined,
      latestAnswer: row.latest_answer ?? undefined,
      latestFeedback: row.latest_feedback ?? undefined,
    }))
  }

  patternTrend(
    targetLanguage: string,
    patternKey: string,
    input: { days?: number; timeZone?: string; now?: number; scopeId?: string } = {},
  ): Array<{ date: string; errors: number; naturalCorrectUses: number; independentReviews: number }> {
    const canonical = this.resolveCanonical(targetLanguage, patternKey)
    const days = Math.max(1, Math.min(365, input.days ?? 30))
    const now = input.now ?? Date.now()
    const timeZone = canonicalTimeZone(input.timeZone)
    const points = new Map(dateRange(days, now, timeZone).map((date) => [date, {
      date,
      errors: 0,
      naturalCorrectUses: 0,
      independentReviews: 0,
    }]))
    const scopeClause = input.scopeId ? " AND scope_id = ?" : ""
    const bindings: Array<string | number> = [
      targetLanguage,
      canonical,
      now - (days + 2) * DAY_MS,
    ]
    if (input.scopeId) bindings.push(input.scopeId)
    const evidence = this.db().query<{
      kind: string
      outcome: string
      observed_at: number
    }, Array<string | number>>(
      `SELECT kind, outcome, observed_at FROM pattern_evidence
       WHERE target_language = ? AND pattern_key = ? AND observed_at >= ?${scopeClause}
       ORDER BY observed_at`,
    ).all(...bindings)
    for (const row of evidence) {
      const point = points.get(localDate(count(row.observed_at), timeZone))
      if (!point) continue
      if (row.kind === "error") point.errors++
      if (row.kind === "natural_correct") point.naturalCorrectUses++
      if (row.kind === "review_transfer" && row.outcome === "independent") {
        point.independentReviews++
      }
    }
    return [...points.values()]
  }

  patternContexts(
    targetLanguage: string,
    patternKey: string,
    scopeId?: string,
  ): Array<{
    scopeId: string
    sessionCount: number
    evidenceCount: number
    errorCount: number
    naturalCorrectCount: number
    reviewCount: number
    lastSeenAt: number
  }> {
    const canonical = this.resolveCanonical(targetLanguage, patternKey)
    const scopeClause = scopeId ? " AND scope_id = ?" : ""
    const bindings = scopeId
      ? [targetLanguage, canonical, scopeId]
      : [targetLanguage, canonical]
    return this.db().query<{
      scope_id: string
      session_count: number
      evidence_count: number
      error_count: number
      natural_count: number
      review_count: number
      last_seen_at: number
    }, string[]>(
      `SELECT scope_id,
              COUNT(DISTINCT session_id) AS session_count,
              COUNT(*) AS evidence_count,
              SUM(kind = 'error') AS error_count,
              SUM(kind = 'natural_correct') AS natural_count,
              SUM(kind IN ('review_recall', 'review_repair', 'review_transfer')) AS review_count,
              MAX(observed_at) AS last_seen_at
       FROM pattern_evidence
       WHERE target_language = ? AND pattern_key = ? AND scope_id IS NOT NULL${scopeClause}
       GROUP BY scope_id
       ORDER BY evidence_count DESC, last_seen_at DESC, scope_id`,
    ).all(...bindings).map((row) => ({
      scopeId: row.scope_id,
      sessionCount: count(row.session_count),
      evidenceCount: count(row.evidence_count),
      errorCount: count(row.error_count),
      naturalCorrectCount: count(row.natural_count),
      reviewCount: count(row.review_count),
      lastSeenAt: count(row.last_seen_at),
    }))
  }

  private queueRows(
    targetLanguage: string,
    limit: number,
    now: number,
    upcoming: boolean,
  ): ReviewQueueItem[] {
    const dueClause = upcoming
      ? "p.due_at > ? AND p.due_at <= ?"
      : "p.due_at <= ?"
    const dueBindings = upcoming ? [now, now + 7 * DAY_MS] : [now]
    const rows = this.patternRows({
      targetLanguage,
      where: `p.disposition = 'active' AND p.stage = 'practicing' AND ${dueClause}
              AND NOT EXISTS (
                SELECT 1 FROM review_items ri
                JOIN review_sessions rs ON rs.id = ri.review_id
                WHERE ri.target_language = p.target_language AND ri.pattern_key = p.pattern_key
                  AND rs.status IN ('active', 'paused')
              )`,
      order: `CASE WHEN p.last_lapsed_at IS NULL THEN 0 ELSE 1 END DESC,
              CASE WHEN p.last_lapsed_at IS NULL THEN 0 ELSE p.last_lapsed_at END DESC,
              p.due_at ASC,
              CASE p.severity WHEN 'meaning_affecting' THEN 3 WHEN 'high_value' THEN 2 ELSE 1 END DESC,
              occurrence_count DESC, p.last_seen_at DESC, p.pattern_key`,
      limit,
      extraBindings: dueBindings,
    })
    return rows.map((row) => ({
      patternKey: row.pattern_key,
      label: row.label,
      rule: row.rule,
      severity: row.severity,
      dueAt: count(row.due_at),
      overdueDays: Math.max(0, Math.floor((now - count(row.due_at)) / DAY_MS)),
      occurrenceCount: count(row.occurrence_count),
      lapseCount: count(row.lapse_count),
    }))
  }

  journey(input: {
    targetLanguage: string
    scopeId?: string
    cursor?: string
    limit: number
    types?: LearningEventType[]
    from?: number
    to?: number
  }): {
    items: Array<{
      id: string
      type: string
      occurredAt: number
      scopeId?: string
      sessionId?: string
      messageId?: string
      patternKey?: string
      reviewId?: string
      reviewItemId?: string
    }>
    nextCursor?: string
  } {
    const cursor = decodeCursor(input.cursor)
    if (input.cursor && !cursorMatches(cursor, ["number", "string"])) {
      throw new Error("Invalid cursor")
    }
    const clauses = ["target_language = ?"]
    const bindings: Array<string | number> = [input.targetLanguage]
    if (input.scopeId) {
      clauses.push("scope_id = ?")
      bindings.push(input.scopeId)
    }
    if (input.types?.length) {
      clauses.push(`event_type IN (${input.types.map(() => "?").join(", ")})`)
      bindings.push(...input.types)
    }
    if (input.from != null) {
      clauses.push("occurred_at >= ?")
      bindings.push(input.from)
    }
    if (input.to != null) {
      clauses.push("occurred_at <= ?")
      bindings.push(input.to)
    }
    if (cursor && typeof cursor[0] === "number" && typeof cursor[1] === "string") {
      clauses.push("(occurred_at < ? OR (occurred_at = ? AND id < ?))")
      bindings.push(cursor[0], cursor[0], cursor[1])
    }
    bindings.push(input.limit + 1)
    const rows = this.db()
      .query<{
        id: string
        event_type: LearningEventType
        occurred_at: number
        scope_id: string | null
        session_id: string | null
        message_id: string | null
        pattern_key: string | null
        review_id: string | null
        review_item_id: string | null
      }, Array<string | number>>(
        `SELECT * FROM learning_events WHERE ${clauses.join(" AND ")}
         ORDER BY occurred_at DESC, id DESC LIMIT ?`,
      )
      .all(...bindings)
    const visible = rows.slice(0, input.limit)
    return {
      items: visible.map((row) => ({
        id: row.id,
        type: row.event_type,
        occurredAt: count(row.occurred_at),
        scopeId: row.scope_id ?? undefined,
        sessionId: row.session_id ?? undefined,
        messageId: row.message_id ?? undefined,
        patternKey: row.pattern_key ?? undefined,
        reviewId: row.review_id ?? undefined,
        reviewItemId: row.review_item_id ?? undefined,
      })),
      nextCursor: rows.length > input.limit && visible.length
        ? encodeCursor(count(visible.at(-1)!.occurred_at), visible.at(-1)!.id)
        : undefined,
    }
  }

  learningRecord(targetLanguage: string, eventId: string) {
    const row = this.db().query<{
      id: string
      event_type: LearningEventType
      occurred_at: number
      scope_id: string | null
      session_id: string | null
      message_id: string | null
      pattern_key: string | null
      review_id: string | null
      review_item_id: string | null
    }, [string, string]>(
      "SELECT * FROM learning_events WHERE target_language = ? AND id = ?",
    ).get(targetLanguage, eventId)
    if (!row) return undefined
    const event = {
      id: row.id,
      type: row.event_type,
      occurredAt: count(row.occurred_at),
      scopeId: row.scope_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      messageId: row.message_id ?? undefined,
      patternKey: row.pattern_key ?? undefined,
      reviewId: row.review_id ?? undefined,
      reviewItemId: row.review_item_id ?? undefined,
    }
    const sessionSummary = event.scopeId && event.sessionId
      ? this.sessionLearningSummary(targetLanguage, event.scopeId, event.sessionId)
      : undefined
    const evidence = this.recordEvidence(targetLanguage, event)
    const patternKeys = new Set(
      [event.patternKey, ...evidence.map((item) => item.patternKey)].filter(
        (key): key is string => Boolean(key),
      ),
    )
    return {
      event,
      pattern: event.patternKey
        ? this.patternDetail(targetLanguage, event.patternKey)
        : undefined,
      patterns: [...patternKeys]
        .map((patternKey) => this.patternDetail(targetLanguage, patternKey))
        .filter((pattern): pattern is ProgressPattern => Boolean(pattern)),
      evidence,
      sessionSummary,
    }
  }

  private sessionLearningSummary(
    targetLanguage: string,
    scopeId: string,
    sessionId: string,
  ): {
    analyzedMessages: number
    targetAttempts: number
    findings: number
    demonstrations: number
    discoveredPatterns: number
    activityStartedAt?: number
    activityLastSeenAt?: number
  } {
    const messages = this.db().query<{
      analyzed: number
      attempts: number
      findings: number
      demonstrations: number
      started_at: number | null
      last_seen_at: number | null
    }, [string, string, string]>(
      `SELECT COUNT(*) AS analyzed,
              SUM(classification = 'target_attempt') AS attempts,
              SUM(finding_count) AS findings,
              SUM(demonstration_count) AS demonstrations,
              MIN(analyzed_at) AS started_at,
              MAX(analyzed_at) AS last_seen_at
       FROM analyzed_messages
       WHERE target_language = ? AND scope_id = ? AND session_id = ?`,
    ).get(targetLanguage, scopeId, sessionId)
    const discovered = this.db().query<{ count: number }, [string, string, string]>(
      `SELECT COUNT(*) AS count FROM learning_events
       WHERE target_language = ? AND scope_id = ? AND session_id = ?
         AND event_type = 'pattern_discovered'`,
    ).get(targetLanguage, scopeId, sessionId)
    return {
      analyzedMessages: count(messages?.analyzed),
      targetAttempts: count(messages?.attempts),
      findings: count(messages?.findings),
      demonstrations: count(messages?.demonstrations),
      discoveredPatterns: count(discovered?.count),
      activityStartedAt:
        messages?.started_at == null ? undefined : count(messages.started_at),
      activityLastSeenAt:
        messages?.last_seen_at == null ? undefined : count(messages.last_seen_at),
    }
  }

  private recordEvidence(
    targetLanguage: string,
    event: {
      scopeId?: string
      sessionId?: string
      messageId?: string
      patternKey?: string
      reviewItemId?: string
      reviewId?: string
    },
  ): Array<{
    id: string
    patternKey: string
    label: string
    kind: EvidenceKind
    outcome: EvidenceOutcome
    confidence: number
    observedAt: number
    scopeId?: string
    sessionId?: string
    messageId?: string
    reviewItemId?: string
    originalFragment?: string
    correctedFragment?: string
  }> {
    const clauses = ["e.target_language = ?"]
    const bindings: Array<string | number> = [targetLanguage]
    if (event.reviewItemId) {
      clauses.push("e.review_item_id = ?")
      bindings.push(event.reviewItemId)
    } else if (event.reviewId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM review_items ri
        WHERE ri.id = e.review_item_id AND ri.review_id = ?
      )`)
      bindings.push(event.reviewId)
    } else if (event.messageId) {
      clauses.push("e.message_id = ?")
      bindings.push(event.messageId)
    } else if (event.scopeId && event.sessionId) {
      clauses.push("e.scope_id = ?", "e.session_id = ?")
      bindings.push(event.scopeId, event.sessionId)
    } else if (event.patternKey) {
      clauses.push("e.pattern_key = ?")
      bindings.push(event.patternKey)
    } else {
      return []
    }
    bindings.push(50)
    return this.db().query<{
      id: string
      pattern_key: string
      label: string
      kind: EvidenceKind
      outcome: EvidenceOutcome
      confidence: number
      observed_at: number
      scope_id: string | null
      session_id: string | null
      message_id: string | null
      review_item_id: string | null
      original_fragment: string | null
      corrected_fragment: string | null
    }, Array<string | number>>(
      `SELECT e.id, e.pattern_key, p.label, e.kind, e.outcome, e.confidence,
              e.observed_at, e.scope_id, e.session_id, e.message_id, e.review_item_id,
              e.original_fragment, e.corrected_fragment
       FROM pattern_evidence e
       JOIN learning_patterns p
         ON p.target_language = e.target_language AND p.pattern_key = e.pattern_key
       WHERE ${clauses.join(" AND ")}
       ORDER BY e.observed_at DESC, e.id DESC LIMIT ?`,
    ).all(...bindings).map((row) => ({
      id: row.id,
      patternKey: row.pattern_key,
      label: row.label,
      kind: row.kind,
      outcome: row.outcome,
      confidence: Number(row.confidence),
      observedAt: count(row.observed_at),
      scopeId: row.scope_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      messageId: row.message_id ?? undefined,
      reviewItemId: row.review_item_id ?? undefined,
      originalFragment: row.original_fragment ?? undefined,
      correctedFragment: row.corrected_fragment ?? undefined,
    }))
  }

  patternCommand(
    targetLanguage: string,
    command:
      | { action: "ignore" | "restore" | "not_error" | "delete"; patternKey: string }
      | { action: "merge"; sourceKey: string; targetKey: string },
  ): { revision: number; pattern?: ProgressPattern } | undefined {
    const db = this.db()
    const transaction = db.transaction(() => {
      if (command.action === "merge") {
        const source = this.resolveCanonical(targetLanguage, command.sourceKey)
        const target = this.resolveCanonical(targetLanguage, command.targetKey)
        const sourceRow = this.pattern(targetLanguage, source)
        if (source === target || !sourceRow || !this.pattern(targetLanguage, target)) return undefined
        // A merge can remove or renumber the item currently shown by an open review.
        // Preserve its history, but close it before rewriting item ownership.
        this.abandonOpenReviewsForPattern(targetLanguage, source)
        this.abandonOpenReviewsForPattern(targetLanguage, target)
        db.query(
          `INSERT OR IGNORE INTO pattern_aliases(target_language, alias_key, canonical_key)
           VALUES (?, ?, ?)`,
        ).run(targetLanguage, source, target)
        db.query(
          `UPDATE OR IGNORE pattern_evidence SET pattern_key = ?
           WHERE target_language = ? AND pattern_key = ?`,
        ).run(target, targetLanguage, source)
        db.query(
          `DELETE FROM pattern_evidence WHERE target_language = ? AND pattern_key = ?`,
        ).run(targetLanguage, source)
        db.query(
          `DELETE FROM review_items
           WHERE target_language = ? AND pattern_key = ?
             AND EXISTS (
               SELECT 1 FROM review_items target_item
               WHERE target_item.review_id = review_items.review_id
                 AND target_item.target_language = ? AND target_item.pattern_key = ?
             )`,
        ).run(targetLanguage, source, targetLanguage, target)
        db.query(
          `UPDATE review_items SET pattern_key = ?
           WHERE target_language = ? AND pattern_key = ?`,
        ).run(target, targetLanguage, source)
        db.query(
          `UPDATE OR IGNORE learning_events SET pattern_key = ?
           WHERE target_language = ? AND pattern_key = ?`,
        ).run(target, targetLanguage, source)
        db.query(
          `DELETE FROM learning_events WHERE target_language = ? AND pattern_key = ?`,
        ).run(targetLanguage, source)
        db.query(
          `UPDATE learning_patterns SET
             due_at = CASE
               WHEN due_at IS NULL THEN ?
               WHEN ? IS NULL THEN due_at
               ELSE MIN(due_at, ?)
             END,
             schedule_step = MIN(schedule_step, ?),
             lapse_count = lapse_count + ?,
             first_seen_at = MIN(first_seen_at, ?),
             last_seen_at = MAX(last_seen_at, ?),
             stage = 'practicing',
             verified_at = NULL,
             revision = revision + 1
           WHERE target_language = ? AND pattern_key = ?`,
        ).run(
          sourceRow.due_at,
          sourceRow.due_at,
          sourceRow.due_at,
          sourceRow.schedule_step,
          sourceRow.lapse_count,
          sourceRow.first_seen_at,
          sourceRow.last_seen_at,
          targetLanguage,
          target,
        )
        db.query(
          `UPDATE pattern_aliases SET canonical_key = ?
           WHERE target_language = ? AND canonical_key = ?`,
        ).run(target, targetLanguage, source)
        db.query(
          "DELETE FROM learning_patterns WHERE target_language = ? AND pattern_key = ?",
        ).run(targetLanguage, source)
        this.recomputeVerified(targetLanguage, target, Date.now())
        this.trimEvidence(targetLanguage, target)
      } else {
        const key = this.resolveCanonical(targetLanguage, command.patternKey)
        const existing = this.pattern(targetLanguage, key)
        if (!existing) return undefined
        if (command.action === "restore" && existing.disposition !== "ignored") return undefined
        if (command.action === "ignore" && existing.disposition === "rejected") return undefined
        if (command.action === "delete") {
          this.abandonOpenReviewsForPattern(targetLanguage, key)
          db.query(
            "DELETE FROM learning_patterns WHERE target_language = ? AND pattern_key = ?",
          ).run(targetLanguage, key)
          this.removeEmptyReviews()
        } else if (command.action === "not_error") {
          this.abandonOpenReviewsForPattern(targetLanguage, key)
          db.query(
            `DELETE FROM review_items WHERE target_language = ? AND pattern_key = ?`,
          ).run(targetLanguage, key)
          this.removeEmptyReviews()
          db.query(
            `DELETE FROM learning_events WHERE target_language = ? AND pattern_key = ?`,
          ).run(targetLanguage, key)
          db.query(
            `DELETE FROM pattern_evidence WHERE target_language = ? AND pattern_key = ?`,
          ).run(targetLanguage, key)
          db.query(
            `UPDATE learning_patterns SET disposition = 'rejected', stage = 'candidate',
             due_at = NULL, verified_at = NULL, revision = revision + 1
             WHERE target_language = ? AND pattern_key = ?`,
          ).run(targetLanguage, key)
        } else {
          if (command.action === "ignore") {
            this.abandonOpenReviewsForPattern(targetLanguage, key)
          }
          db.query(
            `UPDATE learning_patterns SET disposition = ?, revision = revision + 1
             WHERE target_language = ? AND pattern_key = ?`,
          ).run(command.action === "ignore" ? "ignored" : "active", targetLanguage, key)
        }
      }
      return this.bumpRevision(targetLanguage)
    })
    const revision = transaction.immediate()
    if (revision == null) return undefined
    const key = command.action === "merge" ? command.targetKey : command.patternKey
    return { revision, pattern: this.patternDetail(targetLanguage, key) }
  }

  clearLearningData(
    input: { scope: "target"; targetLanguage: string } | { scope: "all" },
  ): ClearLearningDataResult {
    const db = this.db()
    const where = input.scope === "target" ? " WHERE target_language = ?" : ""
    const bindings = input.scope === "target" ? [input.targetLanguage] : []
    const transaction = db.transaction(() => {
      const tableCount = (table: string) =>
        count(db.query<{ count: number }, string[]>(`SELECT COUNT(*) AS count FROM ${table}${where}`).get(...bindings)?.count)
      const result = {
        deletedMessages: tableCount("analyzed_messages"),
        deletedOccurrences: tableCount("pattern_evidence"),
        deletedPatterns: tableCount("learning_patterns"),
        deletedReviews: tableCount("review_sessions"),
        deletedEvents: tableCount("learning_events"),
      }
      for (const table of ["review_sessions", "pattern_presentations", "pattern_aliases", "pattern_evidence", "learning_events", "learning_patterns", "analyzed_messages", "learning_profiles"]) {
        db.query(`DELETE FROM ${table}${where}`).run(...bindings)
      }
      return result
    })
    return transaction.immediate()
  }

  revision(targetLanguage: string): number {
    return count(
      this.db()
        .query<{ revision: number }, [string]>(
          "SELECT revision FROM learning_profiles WHERE target_language = ?",
        )
        .get(targetLanguage)?.revision,
    )
  }

  advanceRevision(targetLanguage: string): number {
    return this.bumpRevision(targetLanguage)
  }

  recomputeVerified(targetLanguage: string, patternKey: string, now = Date.now()): boolean {
    const db = this.db()
    const pattern = this.pattern(targetLanguage, patternKey)
    if (!pattern || pattern.stage !== "practicing" || pattern.disposition !== "active") return false
    const rows = db
      .query<{
        kind: string
        outcome: string
        observed_at: number
        session_id: string | null
        review_id: string | null
      }, [string, string]>(
        `SELECT e.kind, e.outcome, e.observed_at, e.session_id, ri.review_id
         FROM pattern_evidence e
         LEFT JOIN review_items ri ON ri.id = e.review_item_id
         WHERE e.target_language = ? AND e.pattern_key = ?
           AND (
             (e.kind = 'review_transfer' AND e.outcome = 'independent')
             OR e.kind = 'natural_correct'
           )
         ORDER BY e.observed_at`,
      )
      .all(targetLanguage, patternKey)
    const reviews = rows.filter((row) => row.kind === "review_transfer" && row.outcome === "independent")
    if (new Set(reviews.map((row) => row.review_id).filter(Boolean)).size < 2) return false
    const firstReview = count(reviews[0].observed_at)
    const natural = rows.find((row) => row.kind === "natural_correct" && count(row.observed_at) > firstReview)
    if (!natural) return false
    const sessions = new Set(rows.map((row) => row.session_id).filter(Boolean))
    const first = Math.min(...rows.map((row) => count(row.observed_at)))
    const last = Math.max(...rows.map((row) => count(row.observed_at)))
    if (sessions.size < 2 || last - first < 7 * DAY_MS) return false
    db.query(
      `UPDATE learning_patterns SET stage = 'verified', verified_at = ?, due_at = NULL,
       revision = revision + 1 WHERE target_language = ? AND pattern_key = ?`,
    ).run(now, targetLanguage, patternKey)
    this.insertEvent({
      targetLanguage,
      type: "pattern_verified",
      at: now,
      patternKey,
    })
    return true
  }

  private trend(
    targetLanguage: string,
    days: number,
    timeZone: string,
    now: number,
    scopeId?: string,
  ): TrendPoint[] {
    const points = new Map(dateRange(days, now, timeZone).map((date) => [date, {
      date,
      targetAttempts: 0,
      findings: 0,
      naturalCorrectUses: 0,
      independentReviews: 0,
    }]))
    const since = now - (days + 2) * DAY_MS
    const scopeClause = scopeId ? " AND scope_id = ?" : ""
    const bindings: Array<string | number> = [targetLanguage, since]
    if (scopeId) bindings.push(scopeId)
    for (const row of this.db().query<{ analyzed_at: number }, Array<string | number>>(
      `SELECT analyzed_at FROM analyzed_messages
       WHERE target_language = ? AND analyzed_at >= ? AND classification = 'target_attempt'${scopeClause}`,
    ).all(...bindings)) {
      const point = points.get(localDate(count(row.analyzed_at), timeZone))
      if (point) point.targetAttempts++
    }
    for (const row of this.db().query<{ observed_at: number; kind: string; outcome: string }, Array<string | number>>(
      `SELECT observed_at, kind, outcome FROM pattern_evidence
       WHERE target_language = ? AND observed_at >= ?${scopeClause}`,
    ).all(...bindings)) {
      const point = points.get(localDate(count(row.observed_at), timeZone))
      if (!point) continue
      if (row.kind === "error") point.findings++
      if (row.kind === "natural_correct") point.naturalCorrectUses++
      if (row.kind === "review_transfer" && row.outcome === "independent") point.independentReviews++
    }
    return [...points.values()]
  }

  private patternRows(input: {
    targetLanguage: string
    scopeId?: string
    where: string
    order: string
    limit: number
    extraBindings?: Array<string | number>
    having?: string
    havingBindings?: Array<string | number>
  }): PatternRow[] {
    const scopeClause = input.scopeId ? " AND e.scope_id = ?" : ""
    const bindings: Array<string | number> = []
    if (input.scopeId) bindings.push(input.scopeId)
    bindings.push(input.targetLanguage)
    bindings.push(...(input.extraBindings ?? []), input.limit)
    if (input.havingBindings?.length) {
      bindings.splice(bindings.length - 1, 0, ...input.havingBindings)
    }
    return this.db()
      .query<PatternRow, Array<string | number>>(
        `SELECT p.*,
           SUM(CASE WHEN e.kind = 'error' THEN 1 ELSE 0 END) AS occurrence_count,
           COUNT(DISTINCT CASE WHEN e.kind = 'error' THEN e.session_id END) AS session_count,
           SUM(CASE WHEN e.kind = 'natural_correct' THEN 1 ELSE 0 END) AS natural_count,
           SUM(CASE WHEN e.kind = 'review_transfer' AND e.outcome = 'independent' THEN 1 ELSE 0 END) AS independent_count,
           CASE p.stage WHEN 'practicing' THEN 3 WHEN 'candidate' THEN 2 ELSE 1 END AS stage_rank,
           CASE p.severity WHEN 'meaning_affecting' THEN 3 WHEN 'high_value' THEN 2 ELSE 1 END AS severity_rank
         FROM learning_patterns p
         LEFT JOIN pattern_evidence e
           ON e.target_language = p.target_language AND e.pattern_key = p.pattern_key${scopeClause}
         WHERE p.target_language = ? AND ${input.where}
         GROUP BY p.target_language, p.pattern_key
         ${(input.scopeId || input.having)
           ? `HAVING ${[
               input.scopeId ? "COUNT(e.id) > 0" : "",
               input.having ? `(${input.having})` : "",
             ].filter(Boolean).join(" AND ")}`
           : ""}
         ORDER BY ${input.order}
         LIMIT ?`,
      )
      .all(...bindings)
  }

  private examples(targetLanguage: string, patternKey: string, scopeId?: string): ProgressExample[] {
    const scopeClause = scopeId ? " AND scope_id = ?" : ""
    const bindings: Array<string | number> = [targetLanguage, patternKey]
    if (scopeId) bindings.push(scopeId)
    bindings.push(3)
    return this.db()
      .query<{
        observed_at: number
        scope_id: string | null
        session_id: string | null
        message_id: string | null
        original_fragment: string | null
        corrected_fragment: string | null
      }, Array<string | number>>(
        `SELECT observed_at, scope_id, session_id, message_id, original_fragment, corrected_fragment
         FROM pattern_evidence
         WHERE target_language = ? AND pattern_key = ?${scopeClause}
           AND (original_fragment IS NOT NULL OR corrected_fragment IS NOT NULL)
         ORDER BY observed_at DESC, id DESC LIMIT ?`,
      )
      .all(...bindings)
      .map((row) => ({
        observedAt: count(row.observed_at),
        scopeId: row.scope_id ?? "",
        sessionId: row.session_id ?? "",
        messageId: row.message_id ?? undefined,
        originalFragment: row.original_fragment ?? undefined,
        correctedFragment: row.corrected_fragment ?? undefined,
      }))
  }

  private pattern(targetLanguage: string, patternKey: string): PatternRow | undefined {
    return this.db()
      .query<PatternRow, [string, string]>(
        `SELECT p.*, 0 AS occurrence_count, 0 AS session_count, 0 AS natural_count,
         0 AS independent_count, 0 AS stage_rank, 0 AS severity_rank
         FROM learning_patterns p WHERE target_language = ? AND pattern_key = ?`,
      )
      .get(targetLanguage, patternKey) ?? undefined
  }

  private resolveCanonical(targetLanguage: string, patternKey: string): string {
    return this.db()
      .query<{ canonical_key: string }, [string, string]>(
        `SELECT canonical_key FROM pattern_aliases
         WHERE target_language = ? AND alias_key = ?`,
      )
      .get(targetLanguage, patternKey)?.canonical_key ?? patternKey
  }

  private isRejected(targetLanguage: string, patternKey: string): boolean {
    return this.db()
      .query<{ disposition: string }, [string, string]>(
        `SELECT disposition FROM learning_patterns
         WHERE target_language = ? AND pattern_key = ?`,
      )
      .get(targetLanguage, patternKey)?.disposition === "rejected"
  }

  private promoteIfRecurring(targetLanguage: string, patternKey: string, identity: MessageIdentity): void {
    const aggregate = this.db()
      .query<{ errors: number; sessions: number }, [string, string]>(
        `SELECT COUNT(*) AS errors, COUNT(DISTINCT session_id) AS sessions
         FROM pattern_evidence
         WHERE target_language = ? AND pattern_key = ? AND kind = 'error'`,
      )
      .get(targetLanguage, patternKey)
    if (count(aggregate?.errors) < 3 || count(aggregate?.sessions) < 2) return
    const changed = this.db().query(
      `UPDATE learning_patterns SET stage = 'practicing', due_at = ?, revision = revision + 1
       WHERE target_language = ? AND pattern_key = ? AND stage = 'candidate'`,
    ).run(identity.observedAt, targetLanguage, patternKey)
    if (count(changed.changes) > 0) {
      this.insertEvent({
        targetLanguage,
        type: "pattern_reviewable",
        at: identity.observedAt,
        identity,
        patternKey,
      })
    }
  }

  private upsertProfile(profile: ProfileInput, now: number): void {
    this.db().query(
      `INSERT INTO learning_profiles
       (target_language, native_language, proficiency, first_used_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(target_language) DO UPDATE SET
         native_language = excluded.native_language,
         proficiency = excluded.proficiency,
         last_used_at = MAX(learning_profiles.last_used_at, excluded.last_used_at)`,
    ).run(profile.targetLanguage, profile.nativeLanguage, profile.proficiency, now, now)
  }

  private bumpRevision(targetLanguage: string): number {
    this.db().query(
      `UPDATE learning_profiles SET revision = revision + 1 WHERE target_language = ?`,
    ).run(targetLanguage)
    return this.revision(targetLanguage)
  }

  private trimEvidence(targetLanguage: string, patternKey: string): void {
    this.db().query(
      `UPDATE pattern_evidence
       SET original_fragment = NULL, corrected_fragment = NULL
       WHERE id IN (
         SELECT id FROM pattern_evidence
         WHERE target_language = ? AND pattern_key = ?
           AND (original_fragment IS NOT NULL OR corrected_fragment IS NOT NULL)
         ORDER BY observed_at DESC, id DESC LIMIT -1 OFFSET ?
       )`,
    ).run(targetLanguage, patternKey, MAX_STORED_EXAMPLES)
  }

  private removeEmptyReviews(): void {
    this.db().query(
      `DELETE FROM review_sessions
       WHERE NOT EXISTS (SELECT 1 FROM review_items WHERE review_id = review_sessions.id)`,
    ).run()
  }

  private abandonOpenReviewsForPattern(targetLanguage: string, patternKey: string): void {
    const now = Date.now()
    this.db().query(
      `UPDATE review_sessions SET status = 'abandoned', completed_at = COALESCE(completed_at, ?),
       updated_at = ?, revision = revision + 1
       WHERE status IN ('active', 'paused') AND id IN (
         SELECT review_id FROM review_items
         WHERE target_language = ? AND pattern_key = ?
       )`,
    ).run(now, now, targetLanguage, patternKey)
  }

  private insertEvent(input: {
    targetLanguage: string
    type: LearningEventType
    at: number
    identity?: MessageIdentity
    patternKey?: string
    reviewId?: string
  }): void {
    if (input.type === "practice_started" && input.identity) {
      const present = this.db().query<{ present: number }, [string, string, string]>(
        `SELECT 1 AS present FROM learning_events
         WHERE target_language = ? AND event_type = 'practice_started'
           AND scope_id = ? AND session_id = ? LIMIT 1`,
      ).get(
        input.targetLanguage,
        input.identity.scopeId,
        input.identity.sessionId,
      )
      if (present) return
    }
    this.db().query(
      `INSERT OR IGNORE INTO learning_events
       (id, target_language, event_type, occurred_at, scope_id, session_id, message_id,
        pattern_key, review_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      input.targetLanguage,
      input.type,
      input.at,
      input.identity?.scopeId ?? null,
      input.identity?.sessionId ?? null,
      input.identity?.messageId ?? null,
      input.patternKey ?? null,
      input.reviewId ?? null,
    )
  }

  private db(): Database {
    return this.database.connection()
  }
}

import type { Database } from "bun:sqlite"
import { MAX_STORED_EXAMPLES, type ReviewAttemptPhase, type ReviewContent, type ReviewEvaluation, type ReviewOutcome, type ReviewSessionStatus, type ReviewState } from "../domain/types"
import { sanitizeReviewText } from "../domain/privacy"
import { scheduleAfterReview } from "../domain/schedule"
import { VibeLingoDatabase } from "./database"
import { LearningRepository } from "./learning-repository"

type ReviewRow = {
  id: string
  target_language: string
  scope_id: string
  status: ReviewSessionStatus
  current_index: number
  revision: number
  started_at: number
  updated_at: number
  completed_at: number | null
}

type ItemRow = {
  id: string
  review_id: string
  target_language: string
  pattern_key: string
  label: string
  ordinal: number
  stage: "awaiting_response" | "awaiting_repair" | "awaiting_transfer" | "item_completed"
  hint_level: number
  challenge: string | null
  hint_one: string | null
  hint_two: string | null
  explanation: string | null
  reference_answer: string | null
  transfer_challenge: string | null
  rubric: string | null
  initial_correct: number
  transfer_correct: number
  outcome: ReviewOutcome | null
  created_at: number
  completed_at: number | null
  due_at: number | null
  schedule_step: number
}

function numberValue(value: unknown): number {
  return Number(value ?? 0)
}

function safeReviewContent(content: ReviewContent): ReviewContent | undefined {
  const sanitized = {
    challenge: sanitizeReviewText(content.challenge, 500),
    hintOne: sanitizeReviewText(content.hintOne, 160),
    hintTwo: sanitizeReviewText(content.hintTwo, 160),
    explanation: sanitizeReviewText(content.explanation, 300),
    referenceAnswer: sanitizeReviewText(content.referenceAnswer, 160),
    transferChallenge: sanitizeReviewText(content.transferChallenge, 500),
    rubric: sanitizeReviewText(content.rubric, 300),
  }
  return Object.values(sanitized).every((value) => Boolean(value?.trim()))
    ? sanitized as ReviewContent
    : undefined
}

export class ReviewRepository {
  constructor(
    readonly database: VibeLingoDatabase,
    readonly learning: LearningRepository,
  ) {}

  openReview(targetLanguage: string): ReviewState | undefined {
    const row = this.db()
      .query<ReviewRow, [string]>(
        `SELECT * FROM review_sessions
         WHERE target_language = ? AND status IN ('active', 'paused')
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(targetLanguage)
    return row ? this.stateFromRow(row) : undefined
  }

  state(reviewId: string): ReviewState | undefined {
    const row = this.db()
      .query<ReviewRow, [string]>("SELECT * FROM review_sessions WHERE id = ?")
      .get(reviewId)
    return row ? this.stateFromRow(row) : undefined
  }

  patternForCurrent(reviewId: string): {
    review: ReviewState
    patternKey: string
    label: string
    rule: string
    category: string
    challenge?: string
    rubric?: string
  } | undefined {
    const state = this.state(reviewId)
    if (!state?.currentItem) return undefined
    const row = this.db()
      .query<{ rule: string; category: string }, [string, string]>(
        `SELECT rule, category FROM learning_patterns
         WHERE target_language = ? AND pattern_key = ?`,
      )
      .get(state.targetLanguage, state.currentItem.patternKey)
    if (!row) return undefined
    return {
      review: state,
      patternKey: state.currentItem.patternKey,
      label: state.currentItem.label,
      rule: row.rule,
      category: row.category,
      challenge: state.currentItem.challenge,
      rubric: this.currentItem(reviewId)?.rubric ?? undefined,
    }
  }

  create(
    input: {
      targetLanguage: string
      scopeId: string
      patternKeys: string[]
      firstContent: ReviewContent
      now?: number
    },
  ): ReviewState {
    const existing = this.openReview(input.targetLanguage)
    if (existing) return existing
    const patternKeys = [...new Set(input.patternKeys)].slice(0, 10)
    if (patternKeys.length === 0) throw new Error("A review needs at least one pattern.")
    const firstContent = safeReviewContent(input.firstContent)
    if (!firstContent) throw new Error("Review content failed privacy validation.")
    const now = input.now ?? Date.now()
    const id = crypto.randomUUID()
    const db = this.db()
    const transaction = db.transaction(() => {
      db.query(
        `INSERT INTO review_sessions
         (id, target_language, scope_id, status, started_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      ).run(id, input.targetLanguage, input.scopeId, now, now)
      patternKeys.forEach((patternKey, ordinal) => {
        const content = ordinal === 0 ? firstContent : undefined
        db.query(
          `INSERT INTO review_items
           (id, review_id, target_language, pattern_key, ordinal, stage,
            challenge, hint_one, hint_two, explanation, reference_answer,
            transfer_challenge, rubric, created_at)
           VALUES (?, ?, ?, ?, ?, 'awaiting_response', ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          id,
          input.targetLanguage,
          patternKey,
          ordinal,
          content?.challenge ?? null,
          content?.hintOne ?? null,
          content?.hintTwo ?? null,
          content?.explanation ?? null,
          content?.referenceAnswer ?? null,
          content?.transferChallenge ?? null,
          content?.rubric ?? null,
          now,
        )
      })
      return this.state(id)!
    })
    return transaction.immediate()
  }

  commandSeen(reviewId: string, requestId: string): boolean {
    return Boolean(this.commandResult(reviewId, requestId))
  }

  commandResult(reviewId: string, requestId: string): ReviewState | undefined {
    const receipt = this.db()
      .query<{ state_json: string; created_at: number }, [string, string]>(
        `SELECT state_json, created_at FROM review_commands
         WHERE review_id = ? AND request_id = ?`,
      )
      .get(reviewId, requestId)
    if (!receipt) return undefined
    try {
      const snapshot = JSON.parse(receipt.state_json) as ReviewState & {
        currentItem?: ReviewState["currentItem"] & { latestAttemptId?: string }
      }
      const current = snapshot.currentItem
      if (!current) return snapshot
      const item = this.db().query<ItemRow, [string]>(
        `SELECT ri.*, p.label, p.due_at, p.schedule_step FROM review_items ri
         JOIN learning_patterns p
           ON p.target_language = ri.target_language AND p.pattern_key = ri.pattern_key
         WHERE ri.id = ?`,
      ).get(current.id)
      if (!item) return snapshot
      const latestAttempt = current.latestAttemptId
        ? this.db().query<{
            phase: ReviewAttemptPhase
            answer: string | null
            feedback: string | null
            natural_answer: string | null
          }, [string]>(
          "SELECT phase, answer, feedback, natural_answer FROM review_attempts WHERE id = ?",
        ).get(current.latestAttemptId)
        : this.db().query<{
        phase: ReviewAttemptPhase
        answer: string | null
        feedback: string | null
        natural_answer: string | null
      }, [string, number]>(
        `SELECT phase, answer, feedback, natural_answer FROM review_attempts
         WHERE item_id = ? AND created_at <= ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
      ).get(current.id, receipt.created_at)
      const canReveal = current.stage === "awaiting_repair"
        || current.stage === "awaiting_transfer"
        || current.stage === "item_completed"
      return {
        ...snapshot,
        currentItem: {
          ...current,
          challenge: item.challenge ?? undefined,
          visibleHints: [item.hint_one, item.hint_two]
            .slice(0, current.hintLevel)
            .filter((value): value is string => Boolean(value)),
          explanation: canReveal ? item.explanation ?? undefined : undefined,
          referenceAnswer: canReveal ? item.reference_answer ?? undefined : undefined,
          transferChallenge:
            current.stage === "awaiting_transfer" || current.stage === "item_completed"
              ? item.transfer_challenge ?? undefined
              : undefined,
          latestAnswer: latestAttempt?.answer ?? undefined,
          latestFeedback: latestAttempt?.feedback ?? undefined,
          latestNaturalAnswer: latestAttempt?.natural_answer ?? undefined,
          latestAttemptPhase: latestAttempt?.phase,
        },
      }
    } catch {
      return undefined
    }
  }

  requestHint(
    reviewId: string,
    requestId: string,
    expectedRevision: number,
    now = Date.now(),
  ): ReviewState | "conflict" | "invalid" | undefined {
    return this.simpleCommand(reviewId, requestId, expectedRevision, "request_hint", now, (review, item) => {
      if (
        review.status !== "active"
        || !["awaiting_response", "awaiting_transfer"].includes(item.stage)
        || item.hint_level >= 2
      ) return false
      this.db().query(
        "UPDATE review_items SET hint_level = MIN(2, hint_level + 1) WHERE id = ?",
      ).run(item.id)
      return true
    })
  }

  setStatus(
    reviewId: string,
    requestId: string,
    expectedRevision: number,
    action: "pause" | "resume" | "abandon",
    now = Date.now(),
  ): ReviewState | "conflict" | "invalid" | undefined {
    return this.simpleCommand(reviewId, requestId, expectedRevision, action, now, (review) => {
      if (action === "pause" && review.status === "active") {
        this.db().query("UPDATE review_sessions SET status = 'paused' WHERE id = ?").run(reviewId)
        return true
      }
      if (action === "resume" && review.status === "paused") {
        this.db().query("UPDATE review_sessions SET status = 'active' WHERE id = ?").run(reviewId)
        return true
      }
      if (action === "abandon" && ["active", "paused"].includes(review.status)) {
        this.db().query(
          "UPDATE review_sessions SET status = 'abandoned', completed_at = ? WHERE id = ?",
        ).run(now, reviewId)
        for (const item of this.items(reviewId).filter((candidate) => candidate.stage !== "item_completed")) {
          this.finishPatternSchedule(item.target_language, item.pattern_key, "abandoned", now)
          this.db().query(
            `UPDATE review_items SET stage = 'item_completed', outcome = 'abandoned', completed_at = ?
             WHERE id = ?`,
          ).run(now, item.id)
        }
        this.learning.advanceRevision(review.target_language)
        return true
      }
      return false
    })
  }

  submitEvaluation(input: {
    reviewId: string
    requestId: string
    expectedRevision: number
    answer?: string
    evaluation: ReviewEvaluation
    now?: number
    scopeId?: string
    sessionId?: string
  }): ReviewState | "conflict" | "invalid" | undefined {
    if (
      !Number.isFinite(input.evaluation.confidence)
      || input.evaluation.confidence < 0.85
      || input.evaluation.confidence > 1
    ) return "invalid"
    const storedAnswer = input.answer
      ? sanitizeReviewText(input.answer, 300)
      : undefined
    const storedFeedback = sanitizeReviewText(
      input.evaluation.feedback,
      300,
      input.evaluation.sensitive,
    )
    const storedNaturalAnswer = sanitizeReviewText(
      input.evaluation.naturalAnswer,
      160,
      input.evaluation.sensitive,
    )
    const evidenceInput = {
      evaluation: {
        ...input.evaluation,
        feedback: storedFeedback ?? "",
        naturalAnswer: storedNaturalAnswer ?? "",
      },
      scopeId: input.scopeId,
      sessionId: input.sessionId,
    }
    const now = input.now ?? Date.now()
    const db = this.db()
    const transaction = db.transaction(() => {
      if (this.commandSeen(input.reviewId, input.requestId)) {
        return this.commandResult(input.reviewId, input.requestId)
      }
      const review = this.reviewRow(input.reviewId)
      if (!review) return undefined
      if (numberValue(review.revision) !== input.expectedRevision) return "conflict" as const
      if (review.status !== "active") return "invalid" as const
      const item = this.currentItem(input.reviewId)
      if (!item || item.stage === "item_completed") return "invalid" as const
      const phase = item.stage === "awaiting_response"
        ? "recall"
        : item.stage === "awaiting_repair"
          ? "repair"
          : "transfer"
      db.query(
        `INSERT INTO review_attempts
         (id, request_id, review_id, item_id, phase, answer, verdict, feedback,
          natural_answer, confidence, hint_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        input.requestId,
        input.reviewId,
        item.id,
        phase,
        storedAnswer ?? null,
        input.evaluation.verdict,
        storedFeedback || null,
        storedNaturalAnswer || null,
        input.evaluation.confidence,
        item.hint_level,
        now,
      )

      const correct = input.evaluation.verdict === "correct" && input.evaluation.confidence >= 0.85
      const phaseAttemptCount = this.reviewAttemptCount(item.id, phase)
      if (phase === "recall") {
        if (correct) {
          db.query(
            `UPDATE review_items SET stage = 'awaiting_transfer', initial_correct = 1 WHERE id = ?`,
          ).run(item.id)
        } else {
          db.query("UPDATE review_items SET stage = 'awaiting_repair' WHERE id = ?").run(item.id)
        }
        this.insertReviewEvidence(
          item,
          "review_recall",
          correct ? (item.hint_level === 0 ? "independent" : "assisted") : "incorrect",
          evidenceInput,
          now,
        )
      } else if (phase === "repair") {
        if (correct) {
          db.query("UPDATE review_items SET stage = 'awaiting_transfer' WHERE id = ?").run(item.id)
        }
        this.insertReviewEvidence(
          item,
          "review_repair",
          correct ? "correct" : "incorrect",
          evidenceInput,
          now,
        )
        if (!correct && phaseAttemptCount >= 2) {
          this.finishReviewItem(item, "failed", false, input, now)
        }
      } else {
        const independent = correct
          && Boolean(item.initial_correct)
          && item.hint_level === 0
          && phaseAttemptCount === 1
        const outcome: ReviewOutcome = independent
          ? "independent"
          : correct
            ? "assisted"
            : "failed"
        this.insertReviewEvidence(
          item,
          "review_transfer",
          independent ? "independent" : correct ? "assisted" : "incorrect",
          evidenceInput,
          now,
        )
        if (correct || phaseAttemptCount >= 2) {
          this.finishReviewItem(item, outcome, correct, input, now)
        }
      }
      const nextRevision = numberValue(review.revision) + 1
      db.query(
        "UPDATE review_sessions SET revision = ?, updated_at = ? WHERE id = ?",
      ).run(nextRevision, now, input.reviewId)
      this.recordCommand(input.requestId, input.reviewId, "submit_answer", nextRevision, now)
      this.trimReviewContent(item.target_language, item.pattern_key)
      this.learning.advanceRevision(item.target_language)
      return this.state(input.reviewId)!
    })
    return transaction.immediate()
  }

  nextItem(
    reviewId: string,
    requestId: string,
    expectedRevision: number,
    now = Date.now(),
    content?: ReviewContent,
  ): ReviewState | "needs_content" | "conflict" | "invalid" | undefined {
    const safeContent = content ? safeReviewContent(content) : undefined
    if (content && !safeContent) return "invalid"
    const db = this.db()
    const transaction = db.transaction(() => {
      if (this.commandSeen(reviewId, requestId)) return this.commandResult(reviewId, requestId)
      const review = this.reviewRow(reviewId)
      if (!review) return undefined
      if (numberValue(review.revision) !== expectedRevision) return "conflict" as const
      if (review.status !== "active") return "invalid" as const
      const current = this.currentItem(reviewId)
      if (!current || current.stage !== "item_completed") return "invalid" as const
      const next = this.items(reviewId).find((item) => item.ordinal === numberValue(review.current_index) + 1)
      if (next && !next.challenge && !safeContent) return "needs_content" as const
      const nextRevision = numberValue(review.revision) + 1
      if (next) {
        if (!next.challenge && safeContent) {
          db.query(
            `UPDATE review_items SET challenge = ?, hint_one = ?, hint_two = ?, explanation = ?,
             reference_answer = ?, transfer_challenge = ?, rubric = ?
             WHERE id = ? AND challenge IS NULL`,
          ).run(
            safeContent.challenge,
            safeContent.hintOne,
            safeContent.hintTwo,
            safeContent.explanation,
            safeContent.referenceAnswer,
            safeContent.transferChallenge,
            safeContent.rubric,
            next.id,
          )
        }
        db.query(
          `UPDATE review_sessions SET current_index = current_index + 1,
           revision = ?, updated_at = ? WHERE id = ?`,
        ).run(nextRevision, now, reviewId)
      } else {
        db.query(
          `UPDATE review_sessions SET status = 'completed', completed_at = ?,
           revision = ?, updated_at = ? WHERE id = ?`,
        ).run(now, nextRevision, now, reviewId)
        db.query(
          `INSERT OR IGNORE INTO learning_events
           (id, target_language, event_type, occurred_at, scope_id, review_id)
           VALUES (?, ?, 'review_completed', ?, ?, ?)`,
        ).run(crypto.randomUUID(), review.target_language, now, review.scope_id, reviewId)
        this.learning.advanceRevision(review.target_language)
      }
      this.recordCommand(requestId, reviewId, "next_item", nextRevision, now)
      return this.state(reviewId)!
    })
    return transaction.immediate()
  }

  nextPattern(reviewId: string): { patternKey: string; label: string; rule: string; category: string } | undefined {
    const review = this.reviewRow(reviewId)
    if (!review) return undefined
    const nextOrdinal = numberValue(review.current_index) + 1
    const row = this.db().query<{
      pattern_key: string
      label: string
      rule: string
      category: string
    }, [string, number]>(
      `SELECT ri.pattern_key, p.label, p.rule, p.category
       FROM review_items ri JOIN learning_patterns p
         ON p.target_language = ri.target_language AND p.pattern_key = ri.pattern_key
       WHERE ri.review_id = ? AND ri.ordinal = ?`,
    ).get(reviewId, nextOrdinal)
    return row ? {
      patternKey: row.pattern_key,
      label: row.label,
      rule: row.rule,
      category: row.category,
    } : undefined
  }

  private simpleCommand(
    reviewId: string,
    requestId: string,
    expectedRevision: number,
    command: string,
    now: number,
    mutate: (review: ReviewRow, item: ItemRow) => boolean,
  ): ReviewState | "conflict" | "invalid" | undefined {
    const db = this.db()
    const transaction = db.transaction(() => {
      if (this.commandSeen(reviewId, requestId)) return this.commandResult(reviewId, requestId)
      const review = this.reviewRow(reviewId)
      if (!review) return undefined
      if (numberValue(review.revision) !== expectedRevision) return "conflict" as const
      const item = this.currentItem(reviewId)
      if (!item) return undefined
      const changed = mutate(review, item)
      if (!changed) return "invalid" as const
      const revision = changed ? numberValue(review.revision) + 1 : numberValue(review.revision)
      if (changed) {
        db.query(
          "UPDATE review_sessions SET revision = ?, updated_at = ? WHERE id = ?",
        ).run(revision, now, reviewId)
      }
      this.recordCommand(requestId, reviewId, command, revision, now)
      return this.state(reviewId)!
    })
    return transaction.immediate()
  }

  private reviewAttemptCount(itemId: string, phase: ReviewAttemptPhase): number {
    const row = this.db().query<{ count: number }, [string, ReviewAttemptPhase]>(
      "SELECT COUNT(*) AS count FROM review_attempts WHERE item_id = ? AND phase = ?",
    ).get(itemId, phase)
    return numberValue(row?.count)
  }

  private finishReviewItem(
    item: ItemRow,
    outcome: ReviewOutcome,
    transferCorrect: boolean,
    input: { reviewId: string; scopeId?: string; sessionId?: string },
    now: number,
  ): void {
    this.db().query(
      `UPDATE review_items SET stage = 'item_completed', transfer_correct = ?,
       outcome = ?, completed_at = ? WHERE id = ?`,
    ).run(transferCorrect ? 1 : 0, outcome, now, item.id)
    this.finishPatternSchedule(item.target_language, item.pattern_key, outcome, now)
    this.db().query(
      `INSERT OR IGNORE INTO learning_events
       (id, target_language, event_type, occurred_at, scope_id, session_id,
        pattern_key, review_id, review_item_id)
       VALUES (?, ?, 'review_item_completed', ?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      item.target_language,
      now,
      input.scopeId ?? null,
      input.sessionId ?? null,
      item.pattern_key,
      input.reviewId,
      item.id,
    )
    this.learning.recomputeVerified(item.target_language, item.pattern_key, now)
  }

  private finishPatternSchedule(
    targetLanguage: string,
    patternKey: string,
    outcome: ReviewOutcome,
    now: number,
  ): void {
    const pattern = this.db().query<{ schedule_step: number }, [string, string]>(
      `SELECT schedule_step FROM learning_patterns
       WHERE target_language = ? AND pattern_key = ?`,
    ).get(targetLanguage, patternKey)
    if (!pattern) return
    const schedule = scheduleAfterReview({ step: numberValue(pattern.schedule_step) }, outcome, now)
    this.db().query(
      `UPDATE learning_patterns SET schedule_step = ?, due_at = ?, revision = revision + 1
       WHERE target_language = ? AND pattern_key = ?`,
    ).run(schedule.step, schedule.dueAt ?? null, targetLanguage, patternKey)
  }

  private insertReviewEvidence(
    item: ItemRow,
    kind: "review_recall" | "review_repair" | "review_transfer",
    outcome: "incorrect" | "assisted" | "independent" | "correct",
    input: {
      evaluation: ReviewEvaluation
      scopeId?: string
      sessionId?: string
    },
    now: number,
  ): void {
    this.db().query(
      `INSERT INTO pattern_evidence
       (id, target_language, pattern_key, kind, outcome, confidence, scope_id,
        session_id, review_item_id, observed_at, corrected_fragment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      item.target_language,
      item.pattern_key,
      kind,
      outcome,
      input.evaluation.confidence,
      input.scopeId ?? null,
      input.sessionId ?? item.review_id,
      item.id,
      now,
      input.evaluation.naturalAnswer || null,
    )
  }

  private stateFromRow(row: ReviewRow): ReviewState {
    const items = this.items(row.id)
    const current = items.find((item) => item.ordinal === numberValue(row.current_index))
    const latestAttempt = current
      ? this.db().query<{
          phase: ReviewAttemptPhase
          answer: string | null
          feedback: string | null
          natural_answer: string | null
        }, [string]>(
          `SELECT phase, answer, feedback, natural_answer FROM review_attempts
           WHERE item_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
        ).get(current.id)
      : undefined
    const visibleHints = current
      ? [current.hint_one, current.hint_two].slice(0, numberValue(current.hint_level)).filter((value): value is string => Boolean(value))
      : []
    const canReveal = current?.stage === "awaiting_repair"
      || current?.stage === "awaiting_transfer"
      || current?.stage === "item_completed"
    const completedItems = items
      .filter(
        (item): item is ItemRow & { outcome: ReviewOutcome; completed_at: number } =>
          item.stage === "item_completed"
          && item.outcome != null
          && item.completed_at != null,
      )
      .map((item) => ({
        id: item.id,
        patternKey: item.pattern_key,
        label: item.label,
        outcome: item.outcome,
        hintCount: numberValue(item.hint_level),
        dueAt: item.due_at == null ? undefined : numberValue(item.due_at),
        scheduleStep: numberValue(item.schedule_step),
        completedAt: numberValue(item.completed_at),
      }))
    const completionEventId = row.status === "completed"
      ? this.db().query<{ id: string }, [string]>(
          `SELECT id FROM learning_events
           WHERE review_id = ? AND event_type = 'review_completed'
           ORDER BY occurred_at DESC, id DESC LIMIT 1`,
        ).get(row.id)?.id
      : undefined
    return {
      id: row.id,
      targetLanguage: row.target_language,
      status: row.status,
      revision: numberValue(row.revision),
      currentIndex: numberValue(row.current_index),
      totalItems: items.length,
      currentItem: current ? {
        id: current.id,
        patternKey: current.pattern_key,
        label: current.label,
        stage: current.stage,
        hintLevel: numberValue(current.hint_level),
        challenge: current.challenge ?? undefined,
        visibleHints,
        explanation: canReveal ? current.explanation ?? undefined : undefined,
        referenceAnswer: canReveal ? current.reference_answer ?? undefined : undefined,
        transferChallenge:
          current.stage === "awaiting_transfer" || current.stage === "item_completed"
            ? current.transfer_challenge ?? undefined
            : undefined,
        latestAnswer: latestAttempt?.answer ?? undefined,
        latestFeedback: latestAttempt?.feedback ?? undefined,
        latestNaturalAnswer: latestAttempt?.natural_answer ?? undefined,
        latestAttemptPhase: latestAttempt?.phase,
        outcome: current.outcome ?? undefined,
      } : undefined,
      completedItems,
      summary: {
        completedPatternCount: completedItems.length,
        independentRecallCount: items.filter(
          (item) => Boolean(item.initial_correct) && numberValue(item.hint_level) === 0,
        ).length,
        assistedPatternCount: completedItems.filter(
          (item) => item.hintCount > 0 || item.outcome === "assisted",
        ).length,
        successfulTransferCount: items.filter((item) => Boolean(item.transfer_correct)).length,
      },
      startedAt: numberValue(row.started_at),
      updatedAt: numberValue(row.updated_at),
      completedAt: row.completed_at == null ? undefined : numberValue(row.completed_at),
      completionEventId,
    }
  }

  private items(reviewId: string): ItemRow[] {
    return this.db().query<ItemRow, [string]>(
      `SELECT ri.*, p.label, p.due_at, p.schedule_step FROM review_items ri
       JOIN learning_patterns p
         ON p.target_language = ri.target_language AND p.pattern_key = ri.pattern_key
       WHERE ri.review_id = ? ORDER BY ri.ordinal`,
    ).all(reviewId)
  }

  private currentItem(reviewId: string): ItemRow | undefined {
    return this.db().query<ItemRow, [string]>(
      `SELECT ri.*, p.label, p.due_at, p.schedule_step FROM review_items ri
       JOIN review_sessions rs ON rs.id = ri.review_id
       JOIN learning_patterns p
         ON p.target_language = ri.target_language AND p.pattern_key = ri.pattern_key
       WHERE ri.review_id = ? AND ri.ordinal = rs.current_index`,
    ).get(reviewId) ?? undefined
  }

  private reviewRow(reviewId: string): ReviewRow | undefined {
    return this.db().query<ReviewRow, [string]>(
      "SELECT * FROM review_sessions WHERE id = ?",
    ).get(reviewId) ?? undefined
  }

  private recordCommand(
    requestId: string,
    reviewId: string,
    command: string,
    revision: number,
    now: number,
  ): void {
    const state = this.state(reviewId)
    if (!state) return
    const latestAttemptId = state.currentItem
      ? this.db().query<{ id: string }, [string]>(
        `SELECT id FROM review_attempts
         WHERE item_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      ).get(state.currentItem.id)?.id
      : undefined
    const currentItem = state.currentItem
      ? {
          id: state.currentItem.id,
          patternKey: state.currentItem.patternKey,
          label: state.currentItem.label,
          stage: state.currentItem.stage,
          hintLevel: state.currentItem.hintLevel,
          visibleHints: [],
          outcome: state.currentItem.outcome,
          latestAttemptPhase: state.currentItem.latestAttemptPhase,
          latestAttemptId,
        }
      : undefined
    this.db().query(
      `INSERT OR IGNORE INTO review_commands
       (request_id, review_id, command, revision_after, state_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      requestId,
      reviewId,
      command,
      revision,
      JSON.stringify({ ...state, currentItem }),
      now,
    )
  }

  private trimReviewContent(targetLanguage: string, patternKey: string): void {
    this.db().query(
      `UPDATE review_attempts SET answer = NULL, feedback = NULL, natural_answer = NULL
       WHERE item_id IN (
         SELECT ri.id FROM review_items ri
         WHERE ri.target_language = ? AND ri.pattern_key = ?
         ORDER BY ri.completed_at DESC, ri.id DESC LIMIT -1 OFFSET ?
       )`,
    ).run(targetLanguage, patternKey, MAX_STORED_EXAMPLES)
    this.db().query(
      `UPDATE review_items SET challenge = NULL, hint_one = NULL, hint_two = NULL,
       explanation = NULL, reference_answer = NULL, transfer_challenge = NULL, rubric = NULL
       WHERE id IN (
         SELECT id FROM review_items
         WHERE target_language = ? AND pattern_key = ? AND stage = 'item_completed'
         ORDER BY completed_at DESC, id DESC LIMIT -1 OFFSET ?
       )`,
    ).run(targetLanguage, patternKey, MAX_STORED_EXAMPLES)
  }

  private db(): Database {
    return this.database.connection()
  }
}

import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { containsSensitiveContent, sanitizeReviewText } from "../domain/privacy"
import type {
  CommandErrorCode,
  CommandResult,
  ReviewContent,
  ReviewEvaluation,
  ReviewState,
} from "../domain/types"
import type { LearningProfile } from "../settings"
import { LearningRepository } from "../infrastructure/learning-repository"
import { ReviewRepository } from "../infrastructure/review-repository"
import {
  REVIEW_BUILDER_AGENT_NAME,
  REVIEW_EVALUATOR_AGENT_NAME,
  parseReviewContent,
  parseReviewEvaluation,
} from "./review-contracts"

type ReviewPatternInput = {
  patternKey: string
  label: string
  rule: string
  category: string
  examples: Array<{ originalFragment?: string; correctedFragment?: string }>
}

function failure<T>(
  code: CommandErrorCode,
  message: string,
  retryable = false,
): CommandResult<T> {
  return { ok: false, error: { code, retryable, message } }
}

export class ReviewService {
  constructor(
    readonly learning: LearningRepository,
    readonly reviews: ReviewRepository,
  ) {}

  async start(
    input: {
      profile: LearningProfile
      scopeId: string
      patternKeys?: string[]
      limit?: number
      now?: number
    },
    context: PluginInvocationContext,
  ): Promise<CommandResult<ReviewState>> {
    const existing = this.reviews.openReview(input.profile.targetLanguage)
    if (existing) return { ok: true, revision: existing.revision, data: existing }
    const limit = Math.max(1, Math.min(10, Math.trunc(input.limit ?? 3)))
    const due = this.learning.reviewQueue(input.profile.targetLanguage, 10, input.now)
    const selected = input.patternKeys?.length
      ? [...new Set(input.patternKeys)]
          .map((key) => due.find((item) => item.patternKey === key))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .slice(0, limit)
      : due.slice(0, limit)
    if (selected.length === 0) return failure("NOT_FOUND", "No due learning patterns are available.")
    const first = this.learning.patternDetail(input.profile.targetLanguage, selected[0].patternKey)
    if (!first) return failure("NOT_FOUND", "The selected learning pattern no longer exists.")
    const content = await this.buildContent(input.profile, first, context)
    if (!content.ok) return content
    try {
      const state = this.reviews.create({
        targetLanguage: input.profile.targetLanguage,
        scopeId: input.scopeId,
        patternKeys: selected.map((item) => item.patternKey),
        firstContent: content.data,
        now: input.now,
      })
      return { ok: true, revision: state.revision, data: state }
    } catch (error) {
      const concurrent = this.reviews.openReview(input.profile.targetLanguage)
      if (concurrent) return { ok: true, revision: concurrent.revision, data: concurrent }
      return failure("GENERATION_FAILED", error instanceof Error ? error.message : String(error), true)
    }
  }

  async command(
    input:
      | {
          action: "submit_answer"
          reviewId: string
          requestId: string
          expectedRevision: number
          answer: string
        }
      | {
          action: "request_hint" | "next_item" | "pause" | "resume" | "abandon"
          reviewId: string
          requestId: string
          expectedRevision: number
        },
    profile: LearningProfile,
    context: PluginInvocationContext,
  ): Promise<CommandResult<ReviewState>> {
    const current = this.reviews.state(input.reviewId)
    if (!current || current.targetLanguage !== profile.targetLanguage) {
      return failure("NOT_FOUND", "Review session not found.")
    }
    const previousResult = this.reviews.commandResult(input.reviewId, input.requestId)
    if (previousResult) {
      return { ok: true, revision: previousResult.revision, data: previousResult }
    }
    if (input.action === "submit_answer") {
      if (
        current.status !== "active"
        || !current.currentItem?.challenge
        || !["awaiting_response", "awaiting_repair", "awaiting_transfer"].includes(
          current.currentItem.stage,
        )
      ) {
        return failure("INVALID_INPUT", "The current review item cannot accept an answer.")
      }
      const trimmedAnswer = input.answer.trim()
      if (!trimmedAnswer) return failure("INVALID_INPUT", "Enter an answer before submitting.")
      const answerForAgent = Array.from(trimmedAnswer).slice(0, 300).join("")
      const evaluation = await this.evaluate(
        profile,
        current.currentItem.stage === "awaiting_transfer"
          ? current.currentItem.transferChallenge ?? current.currentItem.challenge
          : current.currentItem.challenge,
        this.reviews.patternForCurrent(input.reviewId)?.rubric ?? "",
        answerForAgent,
        current.currentItem.stage,
        context,
      )
      if (!evaluation.ok) return evaluation
      const storedAnswer = sanitizeReviewText(trimmedAnswer, 300)
      const result = this.reviews.submitEvaluation({
        ...input,
        answer: storedAnswer,
        evaluation: evaluation.data,
        scopeId: context.scopeId,
        sessionId: context.sessionId,
      })
      return this.result(result)
    }
    if (input.action === "request_hint") {
      return this.result(
        this.reviews.requestHint(input.reviewId, input.requestId, input.expectedRevision),
      )
    }
    if (input.action === "pause" || input.action === "resume" || input.action === "abandon") {
      return this.result(
        this.reviews.setStatus(
          input.reviewId,
          input.requestId,
          input.expectedRevision,
          input.action,
        ),
      )
    }

    let nextContent: ReviewContent | undefined
    if (current.currentItem?.stage !== "item_completed") {
      return failure("INVALID_INPUT", "Complete the current review item before continuing.")
    }
    const next = this.reviews.nextPattern(input.reviewId)
    if (next) {
      const content = await this.buildContent(
        profile,
        {
          patternKey: next.patternKey,
          label: next.label,
          rule: next.rule,
          category: next.category,
          examples: [],
        },
        context,
      )
      if (!content.ok) return content
      nextContent = content.data
    }
    return this.result(
      this.reviews.nextItem(
        input.reviewId,
        input.requestId,
        input.expectedRevision,
        undefined,
        nextContent,
      ),
    )
  }

  private async buildContent(
    profile: LearningProfile,
    pattern: ReviewPatternInput,
    context: PluginInvocationContext,
  ): Promise<CommandResult<ReviewContent>> {
    if (!context.agent?.call) return failure("AGENT_UNAVAILABLE", "The review model is unavailable.", true)
    const request = JSON.stringify({
      supportLanguage: profile.nativeLanguage,
      targetLanguage: profile.targetLanguage,
      proficiency: profile.proficiency,
      pattern: {
        key: pattern.patternKey,
        category: pattern.category,
        label: pattern.label,
        rule: pattern.rule,
      },
      examples: pattern.examples.slice(0, 3).map((example) => ({
        original: example.originalFragment,
        corrected: example.correctedFragment,
      })),
    })
    try {
      const response = await context.agent.call({
        agent: REVIEW_BUILDER_AGENT_NAME,
        text: `Create the review item from this JSON:\n${request}`,
        timeoutMs: 15_000,
        maxOutputChars: 5_000,
      })
      const content = parseReviewContent(response.text)
      if (Object.values(content).some((value) => containsSensitiveContent(value))) {
        return failure("GENERATION_FAILED", "Generated review content contained private material.", true)
      }
      return { ok: true, revision: 0, data: content }
    } catch {
      return failure("GENERATION_FAILED", "Could not generate the review item.", true)
    }
  }

  private async evaluate(
    profile: LearningProfile,
    challenge: string,
    rubric: string,
    answer: string,
    phase: string,
    context: PluginInvocationContext,
  ): Promise<CommandResult<ReviewEvaluation>> {
    if (!context.agent?.call) return failure("AGENT_UNAVAILABLE", "The review model is unavailable.", true)
    try {
      const response = await context.agent.call({
        agent: REVIEW_EVALUATOR_AGENT_NAME,
        text: `Evaluate this JSON:\n${JSON.stringify({
          supportLanguage: profile.nativeLanguage,
          targetLanguage: profile.targetLanguage,
          proficiency: profile.proficiency,
          phase,
          challenge,
          rubric,
          response: answer,
        })}`,
        timeoutMs: 15_000,
        maxOutputChars: 3_000,
      })
      const evaluation = parseReviewEvaluation(response.text)
      if (evaluation.confidence < 0.85) {
        return failure(
          "EVALUATION_FAILED",
          "The review model was not confident enough to update learning state.",
          true,
        )
      }
      if (
        evaluation.sensitive
        || containsSensitiveContent(evaluation.feedback)
        || containsSensitiveContent(evaluation.naturalAnswer)
      ) {
        return {
          ok: true,
          revision: 0,
          data: { ...evaluation, feedback: "", naturalAnswer: "" },
        }
      }
      return { ok: true, revision: 0, data: evaluation }
    } catch {
      return failure("EVALUATION_FAILED", "Could not evaluate the review answer.", true)
    }
  }

  private result(
    value: ReviewState | "needs_content" | "conflict" | "invalid" | undefined,
  ): CommandResult<ReviewState> {
    if (value === "conflict") return failure("CONFLICT", "The review changed. Reload the latest state.", true)
    if (value === "invalid") {
      return failure("INVALID_INPUT", "That action is not available in the current review state.")
    }
    if (value === "needs_content") return failure("GENERATION_FAILED", "The next review item is not ready.", true)
    if (!value) return failure("NOT_FOUND", "Review session not found.")
    return { ok: true, revision: value.revision, data: value }
  }
}

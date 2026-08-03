import { copy, type UiLocale } from "./i18n"

export type ReviewActivity =
  | "preparing_first"
  | "evaluating_response"
  | "preparing_next"
  | "saving_progress"
  | "resuming_review"
  | "preparing_hint"
  | "finishing_review"

export type ReviewCommandAction =
  | "submit_answer"
  | "request_hint"
  | "next_item"
  | "pause"
  | "resume"
  | "abandon"

const ACTIVITY_COPY = {
  preparing_first: "preparingFirstReview",
  evaluating_response: "evaluatingReviewResponse",
  preparing_next: "preparingNextReview",
  saving_progress: "savingReviewProgress",
  resuming_review: "resumingReview",
  preparing_hint: "preparingReviewHint",
  finishing_review: "finishingReview",
} as const

export function reviewActivityLabel(locale: UiLocale, activity: ReviewActivity): string {
  return copy(locale, ACTIVITY_COPY[activity])
}

export function reviewActivityForCommand(
  action: ReviewCommandAction,
  hasNextItem: boolean,
): ReviewActivity {
  if (action === "submit_answer") return "evaluating_response"
  if (action === "request_hint") return "preparing_hint"
  if (action === "next_item") return hasNextItem ? "preparing_next" : "finishing_review"
  if (action === "pause") return "saving_progress"
  if (action === "resume") return "resuming_review"
  return "finishing_review"
}

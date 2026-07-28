import { DAY_MS, type ReviewOutcome } from "./types"

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const

export type ScheduleState = {
  step: number
  dueAt?: number
}

export function scheduleAfterReview(
  current: ScheduleState,
  outcome: ReviewOutcome,
  now = Date.now(),
): ScheduleState {
  if (outcome === "independent") {
    const step = Math.min(REVIEW_INTERVAL_DAYS.length - 1, Math.max(1, current.step + 1))
    return { step, dueAt: now + REVIEW_INTERVAL_DAYS[step] * DAY_MS }
  }
  return { step: 0, dueAt: now + REVIEW_INTERVAL_DAYS[0] * DAY_MS }
}

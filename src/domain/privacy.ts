import {
  MAX_FRAGMENT_CODEPOINTS,
  MAX_REVIEW_ANSWER_CODEPOINTS,
} from "./types"

export function truncateCodePoints(text: string, maximum: number): string {
  return Array.from(text).slice(0, maximum).join("")
}

export function containsSensitiveContent(text: string): boolean {
  return [
    /https?:\/\//i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /(?:^|\s)(?:\/(?:Users|home|private|etc|var|opt)\/|[A-Za-z]:[\\/])/,
    /\b(?:api[_-]?key|access[_-]?token|password|passwd|secret|credential)\s*[:=]/i,
    /[A-Za-z0-9_./+=-]{32,}/,
    /```/,
  ].some((pattern) => pattern.test(text))
}

export function sanitizeFragment(text: string, sensitive = false): string | undefined {
  const value = truncateCodePoints(text, MAX_FRAGMENT_CODEPOINTS)
  return sensitive || containsSensitiveContent(value) ? undefined : value
}

export function sanitizeReviewText(
  text: string,
  maximum = MAX_REVIEW_ANSWER_CODEPOINTS,
  sensitive = false,
): string | undefined {
  const value = truncateCodePoints(text, maximum)
  return sensitive || containsSensitiveContent(value) ? undefined : value
}


import type {
  ErrorCategory,
  ErrorSeverity,
  PatternDisposition,
  PatternStage,
  ProgressPattern,
  RecurringPattern,
} from "../domain/types"

export type PatternRow = {
  pattern_key: string
  category: ErrorCategory
  severity: ErrorSeverity
  label: string
  rule: string
  stage: PatternStage
  disposition: PatternDisposition
  first_seen_at: number
  last_seen_at: number
  due_at: number | null
  schedule_step: number
  lapse_count: number
  last_lapsed_at: number | null
  occurrence_count: number
  session_count: number
  natural_count: number
  independent_count: number
  stage_rank: number
  severity_rank: number
}

export function count(value: unknown): number {
  return Number(value ?? 0)
}

export function encodeCursor(...values: Array<string | number>): string {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url")
}

export function decodeCursor(cursor?: string): Array<string | number> | undefined {
  if (!cursor) return undefined
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (!Array.isArray(value) || value.some((item) => !["string", "number"].includes(typeof item))) {
      throw new Error("Invalid cursor")
    }
    return value
  } catch {
    throw new Error("Invalid cursor")
  }
}

export function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")
}

export function cursorMatches(
  cursor: Array<string | number> | undefined,
  kinds: Array<"string" | "number">,
): cursor is Array<string | number> {
  return Boolean(
    cursor
    && cursor.length === kinds.length
    && cursor.every((value, index) => typeof value === kinds[index]),
  )
}

export function toRecurring(row: PatternRow): RecurringPattern {
  return {
    patternKey: row.pattern_key,
    category: row.category,
    label: row.label,
    rule: row.rule,
    occurrenceCount: count(row.occurrence_count),
    sessionCount: count(row.session_count),
    lastSeenAt: count(row.last_seen_at),
    severity: row.severity,
  }
}

export function toProgress(
  row: PatternRow,
  now = Date.now(),
): Omit<ProgressPattern, "examples"> {
  const dueAt = row.due_at == null ? undefined : count(row.due_at)
  const displayStatus = row.stage === "verified"
    ? "verified"
    : row.stage === "candidate"
      ? "new"
      : dueAt != null && dueAt <= now
        ? "focus"
        : "improving"
  return {
    ...toRecurring(row),
    stage: row.stage,
    disposition: row.disposition,
    displayStatus,
    dueAt,
    scheduleStep: count(row.schedule_step),
    lapseCount: count(row.lapse_count),
    lastLapsedAt: row.last_lapsed_at == null ? undefined : count(row.last_lapsed_at),
    naturalCorrectCount: count(row.natural_count),
    independentReviewCount: count(row.independent_count),
    firstSeenAt: count(row.first_seen_at),
  }
}

export function patternCursor(
  row: PatternRow,
  sort: "priority" | "recent" | "frequency" | "due",
): string {
  if (sort === "recent") return encodeCursor(count(row.last_seen_at), row.pattern_key)
  if (sort === "frequency") {
    return encodeCursor(count(row.occurrence_count), count(row.last_seen_at), row.pattern_key)
  }
  if (sort === "due") {
    return encodeCursor(
      row.due_at == null ? Number.MAX_SAFE_INTEGER : count(row.due_at),
      count(row.last_seen_at),
      row.pattern_key,
    )
  }
  return encodeCursor(
    count(row.stage_rank),
    count(row.severity_rank),
    count(row.occurrence_count),
    count(row.last_seen_at),
    row.pattern_key,
  )
}

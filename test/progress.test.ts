import { describe, expect, test } from "bun:test"
import { renderProgress } from "../src/progress"

describe("progress output", () => {
  test("renders evidence-backed counts and optional provenance without proficiency claims", () => {
    const output = renderProgress(
      {
        analyzedMessages: 12,
        findingsLast30Days: 4,
        patterns: [
          {
            patternKey: "missing_article",
            category: "grammar",
            label: "Missing article",
            rule: "Use a or the for one countable thing.",
            occurrenceCount: 4,
            sessionCount: 2,
            firstSeenAt: Date.UTC(2026, 0, 1),
            lastSeenAt: Date.UTC(2026, 0, 3),
            severity: "high_value",
            examples: [
              {
                observedAt: Date.UTC(2026, 0, 3),
                scopeId: "scope-a",
                sessionId: "session-a",
                messageId: "message-a",
                originalFragment: "add button",
                correctedFragment: "add a button",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("Analyzed messages: 12")
    expect(output).toContain("4 occurrence(s) across 2 session(s)")
    expect(output).toContain("`add button` → `add a button`")
    expect(output).toContain("session `session-a`")
    expect(output).not.toContain("proficiency")
    expect(output).not.toContain("mastered")
  })

  test("keeps stored fragments inside a single safe Markdown line", () => {
    const output = renderProgress(
      {
        analyzedMessages: 1,
        findingsLast30Days: 1,
        patterns: [
          {
            patternKey: "word_choice",
            category: "word_choice",
            label: "Word choice",
            rule: "Prefer the more precise word.",
            occurrenceCount: 1,
            sessionCount: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            severity: "minor",
            examples: [
              {
                observedAt: 1,
                scopeId: "scope",
                sessionId: "session",
                messageId: "message",
                originalFragment: "one\n`two`",
                correctedFragment: "one two",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("`one ˋtwoˋ` → `one two`")
  })
})

import { describe, expect, test } from "bun:test"
import type { PluginSystemTransformInput } from "@ericsanchezok/synergy-plugin"
import {
  COACHING_MARKER,
  buildCoachingContract,
  stripCoachingContract,
  transformSystemPrompt,
  type PromptDependencies,
} from "../src/prompt"
import { isUserFacingRootSession } from "../src/session"
import type { RecurringPattern } from "../src/types"
import { invocationContext } from "./helpers"

const input: PluginSystemTransformInput = {
  phase: "budget",
  sessionID: "session-test",
  agent: "synergy",
  model: { providerID: "provider-test", modelID: "model-test" },
  system: ["Base system"],
}

const recurring: RecurringPattern = {
  patternKey: "missing_article",
  category: "grammar",
  label: "Missing article",
  rule: "Use a or the when referring to one countable thing.",
  occurrenceCount: 4,
  sessionCount: 2,
  lastSeenAt: 100,
  severity: "high_value",
}

function dependencies(
  overrides: Partial<PromptDependencies> = {},
): PromptDependencies {
  return {
    async readSettings() {
      return {
        correctionMode: "focused",
        trackingEnabled: true,
        recurringFocusEnabled: true,
      }
    },
    async hasEligibleSession() {
      return true
    },
    recurringPatterns() {
      return [recurring]
    },
    ...overrides,
  }
}

describe("coaching contract", () => {
  test("encodes focused, strict, ambiguity, escape, and recurring behavior", () => {
    const focused = buildCoachingContract("focused", [recurring])
    const strict = buildCoachingContract("strict", [])
    expect(focused).toContain(COACHING_MARKER)
    expect(focused).toContain("ignore isolated minor slips")
    expect(focused).toContain("offer 2–3 correctly phrased interpretations")
    expect(focused).toContain('"just do it"')
    expect(focused).toContain("missing_article")
    expect(strict).toContain("every certain, genuine English error")
    expect(strict).toContain("no more than two")
  })

  test("removes every prior contract entry", () => {
    expect(stripCoachingContract(["one", `${COACHING_MARKER}\nold`, "two"])).toEqual(["one", "two"])
  })

  test("stays idempotent across repeated transform phases", async () => {
    const first = await transformSystemPrompt(input, invocationContext(), dependencies())
    const second = await transformSystemPrompt(
      { ...input, phase: "final", system: first.system },
      invocationContext(),
      dependencies(),
    )
    expect(second.system.filter((part) => part.includes(COACHING_MARKER))).toHaveLength(1)
    expect(second.system[0]).toBe("Base system")
  })

  test("removes coaching from small, ineligible, and disabled calls", async () => {
    const existing = ["Base", `${COACHING_MARKER}\nold`]
    const small = await transformSystemPrompt(
      { ...input, small: true, system: existing },
      invocationContext(),
      dependencies(),
    )
    const child = await transformSystemPrompt(
      { ...input, system: existing },
      invocationContext(),
      dependencies({ hasEligibleSession: async () => false }),
    )
    const off = await transformSystemPrompt(
      { ...input, system: existing },
      invocationContext(),
      dependencies({
        readSettings: async () => ({
          correctionMode: "off",
          trackingEnabled: true,
          recurringFocusEnabled: true,
        }),
      }),
    )
    expect(small.system).toEqual(["Base"])
    expect(child.system).toEqual(["Base"])
    expect(off.system).toEqual(["Base"])
  })

  test("preserves original input when a host read fails", async () => {
    const original = ["Base", `${COACHING_MARKER}\nprevious phase`]
    const result = await transformSystemPrompt(
      { ...input, system: original },
      invocationContext(),
      dependencies({
        readSettings: async () => {
          throw new Error("settings unavailable")
        },
      }),
    )
    expect(result.system).toEqual(original)
  })
})

describe("root Session eligibility", () => {
  test("accepts user-facing roots", () => {
    expect(isUserFacingRootSession({ id: "one", category: "project" })).toBe(true)
    expect(isUserFacingRootSession({ id: "two", category: "channel" })).toBe(true)
  })

  test("rejects child and background workflow variants", () => {
    expect(isUserFacingRootSession({ parentID: "parent" })).toBe(false)
    expect(isUserFacingRootSession({ category: "background" })).toBe(false)
    expect(isUserFacingRootSession({ agenda: { itemID: "agenda" } })).toBe(false)
    expect(isUserFacingRootSession({ cortex: {} })).toBe(false)
    expect(isUserFacingRootSession({ workflow: {} })).toBe(false)
    expect(isUserFacingRootSession({ blueprint: {} })).toBe(false)
  })
})

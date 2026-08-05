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
import type { RecurringPattern } from "../src/domain/types"
import { DEFAULT_SETTINGS } from "../src/settings"
import { invocationContext } from "./helpers"

const profile = {
  nativeLanguage: "zh-Hans",
  targetLanguage: "en",
  proficiency: "intermediate" as const,
}

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
        ...DEFAULT_SETTINGS,
        ...profile,
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
    const focused = buildCoachingContract("focused", profile, [recurring])
    const strict = buildCoachingContract("strict", profile, [])
    expect(focused).toContain(COACHING_MARKER)
    expect(focused).toContain("You are operating in focused correction mode")
    expect(focused).toContain("Ignore isolated minor slips")
    expect(focused).toContain("Submit every issue that meets this threshold")
    expect(focused).toContain("at most eight correction items")
    expect(focused).toContain("offer 2–3 correctly phrased target-language interpretations")
    expect(focused).toContain('"just do it"')
    expect(focused).toContain("missing_article")
    expect(strict).toContain("You are operating in strict correction mode")
    expect(strict).toContain("every certain, genuine target-language issue")
    expect(strict).toContain("Submit every certain issue")
    expect(strict).toContain("at most eight correction items")
    expect(focused).toContain("Chinese")
    expect(focused).toContain("English (en)")
    expect(focused).toContain("intermediate")
    expect(focused).toContain("your first user-visible action")
    expect(focused).toContain("plugin__vibe-lingo__record-correction")
    expect(focused).toContain("one-sentence natural target-language restatement")
    expect(focused).toContain("minimal original/corrected fragment pairs")
    expect(focused).toContain('kind "correction"')
    expect(focused).toContain('kind "naturalness"')
    expect(focused).toContain("Never postpone correction until the task is complete")
    expect(focused).toContain("Do not invent or submit pattern keys")
    expect(focused).not.toContain("After completing the main task")
    expect(focused).not.toContain("optionally add")
    expect(focused).toContain("plugin__vibe-lingo__suggest-expression")
    expect(focused).toContain(
      "Your first user-visible action must be a call to plugin__vibe-lingo__suggest-expression",
    )
    expect(focused).toContain(
      "Do not call it for code, commands, paths, identifiers, pasted text, quotations, short acknowledgements",
    )
    expect(focused).toContain("Escape phrases")
  })

  test("makes contextual naturalness optional without weakening objective correction", () => {
    const enabled = buildCoachingContract("focused", profile, [], true)
    const disabled = buildCoachingContract("focused", profile, [recurring], false)

    expect(enabled).toContain("Grammar correctness alone is not sufficient")
    expect(enabled).toContain("conventional phrasing, collocation, politeness formula, register, or pragmatic relationship")
    expect(enabled).toContain("Do not rewrite wording merely because another version is also possible")
    expect(enabled).toContain("one short explanation in the support language")
    expect(disabled).toContain("Do not submit a naturalness item")
    expect(disabled).toContain("Continue correcting objective issues")
    expect(disabled).toContain("Recurring focus never overrides this setting")
  })

  test("defines mixed-language attempts without overfitting to one language pair", () => {
    const focused = buildCoachingContract("focused", profile, [])
    const strict = buildCoachingContract("strict", profile, [])

    for (const contract of [focused, strict]) {
      expect(contract).toContain("the target language provides the main structure")
      expect(contract).toContain("a clear, natural replacement exists in the target language")
      expect(contract).toContain("intentional bilingual phrasing")
      expect(contract).toContain("a proper name, quoted material, code, a command, a path, an identifier")
      expect(contract).toContain("isolated target-language technical terms")
      expect(contract).not.toContain("what's there")
      expect(contract).not.toContain("功能")
      expect(contract).not.toContain("noticeably interrupts")
    }

    expect(strict).toContain("where a non-target-language word or phrase fills a normal place")
  })

  test("omits the suggestion instruction and keeps a plain-text fallback when disabled", () => {
    const disabled = buildCoachingContract("focused", profile, [], true, false)
    const enabled = buildCoachingContract("focused", profile, [])

    expect(enabled).toContain("must be a call to plugin__vibe-lingo__suggest-expression")
    expect(disabled).not.toContain("must be a call to plugin__vibe-lingo__suggest-expression")
    expect(disabled).toContain("do not call plugin__vibe-lingo__suggest-expression")
    expect(disabled).toContain("answer directly with a short example in ordinary text")
  })

  test("removes only the current V4 contract entry", () => {
    expect(
      stripCoachingContract([
        "one",
        `${COACHING_MARKER}\nold`,
        "two",
      ]),
    ).toEqual(["one", "two"])
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
          ...DEFAULT_SETTINGS,
          ...profile,
          correctionMode: "off",
        }),
      }),
    )
    expect(small.system).toEqual(["Base"])
    expect(child.system).toEqual(["Base"])
    expect(off.system).toEqual(["Base"])
  })

  test("does not coach until the language profile is complete", async () => {
    const result = await transformSystemPrompt(
      input,
      invocationContext(),
      dependencies({
        readSettings: async () => ({
          ...DEFAULT_SETTINGS,
          ...profile,
          nativeLanguage: "",
        }),
      }),
    )
    expect(result.system).toEqual(["Base system"])
  })

  test("adapts the contract to proficiency and target language", () => {
    const beginner = buildCoachingContract(
      "focused",
      { nativeLanguage: "en", targetLanguage: "es", proficiency: "beginner" },
      [],
    )
    const advanced = buildCoachingContract(
      "strict",
      { nativeLanguage: "zh-Hans", targetLanguage: "ja", proficiency: "advanced" },
      [],
    )
    expect(beginner).toContain("Spanish (es)")
    expect(beginner).toContain("simple, usable target-language phrasing")
    expect(advanced).toContain("Japanese (ja)")
    expect(advanced).toContain("nuance, collocation, register")
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

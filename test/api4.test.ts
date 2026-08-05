import { describe, expect, test } from "bun:test"
import type { HookContribution, PluginHookPointInputs } from "@ericsanchezok/synergy-plugin"
import { schemaToJsonSchema } from "@ericsanchezok/synergy-plugin"
import plugin from "../src"
import { COACHING_MARKER } from "../src/prompt"
import { DEFAULT_SETTINGS } from "../src/settings"
import { invocationContext } from "./helpers"

function contribution<Kind extends string>(kind: Kind, id: string) {
  const found = plugin.contributions.find((candidate) => candidate.kind === kind && candidate.id === id)
  expect(found).toBeDefined()
  return found!
}

describe("VibeLingo Plugin API 4 descriptor", () => {
  test("declares the intended capabilities and contributions", () => {
    expect(plugin).toMatchObject({
      id: "vibe-lingo",
      name: "VibeLingo",
      version: "0.8.0",
      compatibility: { synergy: ">=3.0.11" },
      repository: "https://github.com/EricSanchezok/vibe-lingo",
      capabilities: [
        { id: "session.read" },
        { id: "settings.read" },
        { id: "settings.write" },
        { id: "ui.hostActions" },
        { id: "selection.read" },
        {
          id: "agent.call",
          constraints: {
            maxRuntimeMs: 120_000,
            maxInputChars: 8_000,
            maxOutputChars: 8_000,
            modelRoles: ["nano", "mini", "mid", "thinking", "long", "creative"],
          },
        },
      ],
    })
    expect(plugin.contributions.map(({ kind, id }) => `${kind}:${id}`)).toEqual([
      "event:learning.changed",
      "event:review.changed",
      "event:translation.changed",
      "operation:learning-profiles",
      "operation:learning-summary",
      "operation:correction-status",
      "operation:correction-retry",
      "operation:learning-journey",
      "operation:learning-record",
      "operation:learning-patterns",
      "operation:learning-pattern-detail",
      "operation:pattern-presentations",
      "operation:review-queue",
      "operation:review-state",
      "operation:review-start",
      "operation:review-command",
      "operation:pattern-command",
      "operation:clear-learning-data",
      "operation:translate-selection",
      "operation:translations-list",
      "operation:translation-summary",
      "operation:translation-command",
      "ui.navigationItem:learning",
      "ui.textAction:translate-selection",
      "agent:translator",
      "agent:language-classifier",
      "agent:usage-analyzer",
      "agent:correction-analyzer",
      "agent:review-builder",
      "agent:review-evaluator",
      "agent:pattern-presenter",
      "hook:coach-system",
      "hook:analyze-user-message",
      "hook:complete-teaching-analysis",
      "tool:record-correction",
      "ui.messageRenderer:correction-card",
      "tool:suggest-expression",
      "ui.messageRenderer:expression-card",
      "tool:progress",
      "ui.messageRenderer:progress-card",
      "tool:translation-history",
      "ui.settings:settings",
      "lifecycle.uninstall:cleanup-data",
    ])
    expect(plugin.handlerIds).toEqual([
      "operation:learning-profiles",
      "operation:learning-summary",
      "operation:correction-status",
      "operation:correction-retry",
      "operation:learning-journey",
      "operation:learning-record",
      "operation:learning-patterns",
      "operation:learning-pattern-detail",
      "operation:pattern-presentations",
      "operation:review-queue",
      "operation:review-state",
      "operation:review-start",
      "operation:review-command",
      "operation:pattern-command",
      "operation:clear-learning-data",
      "operation:translate-selection",
      "operation:translations-list",
      "operation:translation-summary",
      "operation:translation-command",
      "hook:coach-system",
      "hook:analyze-user-message",
      "hook:complete-teaching-analysis",
      "tool:record-correction",
      "tool:suggest-expression",
      "tool:progress",
      "tool:translation-history",
      "lifecycle.uninstall:cleanup-data",
    ])
  })

  test("keeps every runtime validation schema representable as JSON Schema", () => {
    for (const candidate of plugin.contributions) {
      if (candidate.kind === "operation") {
        expect(() => schemaToJsonSchema(candidate.input)).not.toThrow()
        expect(() => schemaToJsonSchema(candidate.output)).not.toThrow()
      } else if (candidate.kind === "event") {
        expect(() => schemaToJsonSchema(candidate.payload)).not.toThrow()
      } else if (candidate.kind === "tool") {
        expect(() => schemaToJsonSchema(candidate.input)).not.toThrow()
      }
    }
  })

  test("ships trusted settings UI with a declarative fallback and UI-only operations", () => {
    expect(contribution("ui.settings", "settings")).toMatchObject({
      component: { source: "./src/ui/settings.tsx" },
      formSchema: {
        properties: {
          nativeLanguage: { default: "" },
          targetLanguage: { default: "" },
          proficiency: { default: "intermediate" },
          naturalnessSuggestionsEnabled: { default: true },
          expressionSuggestionsEnabled: { default: true },
          languageDetectionModelRole: { default: "nano" },
          learningAnalysisModelRole: { default: "mini" },
          translationModelRole: { default: "mini" },
          reviewModelRole: { default: "mini" },
          translationHistoryEnabled: { default: true },
        },
      },
    })
    expect(contribution("operation", "learning-summary")).toMatchObject({
      type: "query",
      expose: ["ui"],
    })
    expect(contribution("operation", "clear-learning-data")).toMatchObject({
      type: "command",
      expose: ["ui"],
    })
    expect(contribution("ui.navigationItem", "learning")).toMatchObject({
      label: "VibeLingo",
      icon: "languages",
      placement: "sidebar",
      component: { source: "./src/ui/app.tsx" },
    })
    expect(contribution("operation", "pattern-presentations")).toMatchObject({
      type: "command",
      expose: ["ui"],
    })
    expect(contribution("ui.textAction", "translate-selection")).toMatchObject({
      label: "Translate",
      operation: "translate-selection",
      when: {
        minChars: 1,
        maxChars: 4_000,
        sources: ["document", "code", "terminal"],
      },
      presentation: {
        kind: "popover",
        width: "md",
        component: { source: "./src/ui/translation-popover.tsx" },
      },
    })
  })

  test("keeps all teaching agents private and bounds the visible tool surfaces", () => {
    expect(contribution("agent", "translator")).toMatchObject({
      agent: {
        name: "vibe-lingo-translator",
        modelRole: "mini",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "language-classifier")).toMatchObject({
      agent: {
        name: "vibe-lingo-language-classifier",
        mode: "subagent",
        modelRole: "nano",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "usage-analyzer")).toMatchObject({
      agent: {
        name: "vibe-lingo-usage-analyzer",
        modelRole: "mini",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "correction-analyzer")).toMatchObject({
      agent: {
        name: "vibe-lingo-correction-analyzer",
        modelRole: "mini",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "review-builder")).toMatchObject({
      agent: {
        name: "vibe-lingo-review-builder",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "review-evaluator")).toMatchObject({
      agent: {
        name: "vibe-lingo-review-evaluator",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("agent", "pattern-presenter")).toMatchObject({
      agent: {
        name: "vibe-lingo-pattern-presenter",
        hidden: true,
        permission: { "*": "deny" },
      },
    })
    expect(contribution("tool", "progress")).toMatchObject({
      exposure: {
        mode: "search",
        title: "VibeLingo progress",
      },
    })
    expect(contribution("tool", "record-correction")).toMatchObject({
      exposure: { mode: "resident" },
      display: { toolCard: "visible" },
      requires: ["settings.read", "agent.call"],
      input: {
        properties: {
          corrections: {
            minItems: 1,
            maxItems: 8,
            items: {
              properties: {
                kind: { enum: ["correction", "naturalness"] },
                explanation: { maxLength: 200 },
              },
            },
          },
        },
      },
    })
    expect(contribution("ui.messageRenderer", "correction-card")).toMatchObject({
      messageType: "tool",
      tool: "plugin__vibe-lingo__record-correction",
      component: { source: "./src/ui/correction-card.tsx" },
    })
    expect(contribution("ui.messageRenderer", "progress-card")).toMatchObject({
      messageType: "tool",
      tool: "plugin__vibe-lingo__progress",
      component: { source: "./src/ui/progress-card.tsx" },
    })
    expect(contribution("operation", "correction-status")).toMatchObject({
      type: "query",
      expose: ["ui"],
      requires: ["settings.read", "agent.call"],
    })
    expect(contribution("operation", "correction-retry")).toMatchObject({
      type: "command",
      expose: ["ui"],
      requires: ["settings.read", "agent.call"],
    })
    expect(contribution("operation", "review-start")).toMatchObject({
      type: "command",
      expose: ["ui"],
      requires: ["settings.read", "agent.call"],
    })
    expect(contribution("operation", "review-command")).toMatchObject({
      type: "command",
      expose: ["ui"],
      requires: ["settings.read", "agent.call"],
    })
    expect(contribution("tool", "translation-history")).toMatchObject({
      exposure: {
        mode: "search",
        title: "VibeLingo translation history",
      },
    })
  })

  test("the packaged hook contract remains idempotent across budget and final phases", async () => {
    const transform = contribution("hook", "coach-system") as HookContribution<"chat.system.transform">
    const base: PluginHookPointInputs["chat.system.transform"] = {
      phase: "budget",
      sessionID: "session-test",
      agent: "synergy",
      model: { providerID: "test", modelID: "test-model" },
      system: ["Base system"],
    }
    const context = invocationContext({
      session: {
        async get() {
          return { id: "session-test", category: "project" }
        },
      },
      settings: {
        async get() {
          return {
            ...DEFAULT_SETTINGS,
            nativeLanguage: "zh-Hans",
            targetLanguage: "en",
            recurringFocusEnabled: false,
          }
        },
      },
    })
    const budget = await transform.handler(base, context)
    const final = await transform.handler({ ...base, phase: "final", system: budget.system }, context)
    expect(final.system[0]).toBe("Base system")
    expect(final.system.filter((part) => part.includes(COACHING_MARKER))).toHaveLength(1)
  })
})

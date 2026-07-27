import { describe, expect, test } from "bun:test"
import type { HookContribution, PluginHookPointInputs } from "@ericsanchezok/synergy-plugin"
import plugin from "../src"
import { COACHING_MARKER } from "../src/prompt"
import { invocationContext } from "./helpers"

function contribution<Kind extends string>(kind: Kind, id: string) {
  const found = plugin.contributions.find((candidate) => candidate.kind === kind && candidate.id === id)
  expect(found).toBeDefined()
  return found!
}

describe("VibeLingo Plugin API 3 descriptor", () => {
  test("declares the intended capabilities and contributions", () => {
    expect(plugin).toMatchObject({
      id: "vibe-lingo",
      name: "VibeLingo",
      version: "0.2.0",
      capabilities: [
        { id: "session.read" },
        { id: "settings.read" },
        { id: "settings.write" },
        { id: "ui.hostActions" },
        {
          id: "agent.call",
          constraints: {
            maxRuntimeMs: 12_000,
            maxInputChars: 6_000,
            maxOutputChars: 3_000,
          },
        },
      ],
    })
    expect(plugin.contributions.map(({ kind, id }) => `${kind}:${id}`)).toEqual([
      "operation:learning-summary",
      "operation:clear-learning-data",
      "agent:language-analyzer",
      "hook:coach-system",
      "hook:analyze-user-message",
      "tool:progress",
      "ui.settings:settings",
      "lifecycle.uninstall:cleanup-data",
    ])
    expect(plugin.handlerIds).toEqual([
      "operation:learning-summary",
      "operation:clear-learning-data",
      "hook:coach-system",
      "hook:analyze-user-message",
      "tool:progress",
      "lifecycle.uninstall:cleanup-data",
    ])
  })

  test("ships trusted settings UI with a declarative fallback and UI-only operations", () => {
    expect(contribution("ui.settings", "settings")).toMatchObject({
      component: { source: "./src/ui/settings.tsx" },
      formSchema: {
        properties: {
          nativeLanguage: { default: "" },
          targetLanguage: { default: "" },
          proficiency: { default: "intermediate" },
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
  })

  test("keeps the analyzer private and bounds the progress tool surface", () => {
    expect(contribution("agent", "language-analyzer")).toMatchObject({
      agent: {
        name: "vibe-lingo-analyzer",
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
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
  })

  test("the packaged hook contract remains idempotent across budget and final phases", async () => {
    const transform = contribution(
      "hook",
      "coach-system",
    ) as HookContribution<"experimental.chat.system.transform">
    const base: PluginHookPointInputs["experimental.chat.system.transform"] = {
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
            nativeLanguage: "zh-Hans",
            targetLanguage: "en",
            proficiency: "intermediate",
            correctionMode: "focused",
            trackingEnabled: true,
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

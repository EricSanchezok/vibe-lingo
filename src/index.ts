import {
  agent,
  capability,
  definePlugin,
  hook,
  lifecycleUninstall,
  settings,
  tool,
} from "@ericsanchezok/synergy-plugin"
import { ANALYZER_AGENT_NAME, ANALYZER_PROMPT, processUserMessage } from "./analyzer"
import { defaultPromptDependencies, transformSystemPrompt } from "./prompt"
import { progressTool } from "./progress"
import type { ProgressInput } from "./progress"
import { closeDefaultStore, defaultStore, deleteDefaultData } from "./storage"

const ProgressInputJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["all", "current"],
      description: "Use all enabled Scopes or only the current Scope.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      description: "Maximum number of patterns to return.",
    },
    includeExamples: {
      type: "boolean",
      description: "Include up to three sanitized fragments and their provenance.",
    },
  },
  additionalProperties: false,
}

export default definePlugin({
  id: "vibe-lingo",
  name: "VibeLingo",
  version: "0.1.0",
  description: "Work-first English coaching and private recurring-pattern tracking for Synergy sessions",
  capabilities: [
    capability("session.read"),
    capability("settings.read"),
    capability("agent.call", {
      maxRuntimeMs: 12_000,
      maxInputChars: 6_000,
      maxOutputChars: 3_000,
    }),
  ],
  contributions: [
    agent({
      id: "language-analyzer",
      agent: {
        name: ANALYZER_AGENT_NAME,
        description: "Private structured English-learning signal classifier for VibeLingo",
        prompt: ANALYZER_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    hook<"experimental.chat.system.transform">({
      id: "coach-system",
      point: "experimental.chat.system.transform",
      requires: ["session.read", "settings.read"],
      async handler(input, context) {
        return transformSystemPrompt(
          input,
          context,
          defaultPromptDependencies((limit) => defaultStore().recurringPatterns(limit)),
        )
      },
    }),
    hook<"session.user-message.after">({
      id: "analyze-user-message",
      point: "session.user-message.after",
      requires: ["session.read", "settings.read", "agent.call"],
      async handler(input, context) {
        await processUserMessage(input, context)
      },
    }),
    tool<ProgressInput>({
      id: "progress",
      description:
        "Show the user's stored VibeLingo English error patterns and provenance. Use only when the user explicitly asks about language progress, recurring mistakes, or historical examples.",
      exposure: {
        mode: "search",
        title: "VibeLingo progress",
        keywords: ["English", "language learning", "mistakes", "corrections", "progress"],
      },
      input: ProgressInputJsonSchema,
      async handler(input, context) {
        return progressTool(input, context)
      },
    }),
    settings({
      id: "settings",
      label: "VibeLingo",
      group: "plugins",
      formSchema: {
        type: "object",
        properties: {
          correctionMode: {
            type: "string",
            enum: ["focused", "strict", "off"],
            default: "focused",
            title: "Correction mode",
            description: "Focused corrects only high-value issues; strict corrects every certain error.",
          },
          trackingEnabled: {
            type: "boolean",
            default: true,
            title: "Track recurring patterns",
            description: "Analyze eligible messages asynchronously and store minimal local learning signals.",
          },
          recurringFocusEnabled: {
            type: "boolean",
            default: true,
            title: "Use recurring focus",
            description: "Prioritize established recurring patterns in future coaching.",
          },
        },
        additionalProperties: false,
      },
    }),
    lifecycleUninstall({
      id: "cleanup-data",
      async handler() {
        deleteDefaultData()
      },
    }),
  ],
  async deactivate() {
    closeDefaultStore()
  },
})

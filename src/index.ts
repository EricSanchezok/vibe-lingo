import {
  agent,
  capability,
  definePlugin,
  event,
  hook,
  lifecycleUninstall,
  settings,
  tool,
  navigationItem,
  messageRenderer,
  textAction,
} from "@ericsanchezok/synergy-plugin"
import {
  CORRECTION_ANALYZER_AGENT_NAME,
  CORRECTION_ANALYZER_PROMPT,
  handleAgentCallAfter,
  LANGUAGE_CLASSIFIER_AGENT_NAME,
  LANGUAGE_CLASSIFIER_PROMPT,
  processUserMessage,
  USAGE_ANALYZER_AGENT_NAME,
  USAGE_ANALYZER_PROMPT,
} from "./analysis"
import { dashboardOperations } from "./operations"
import { defaultPromptDependencies, transformSystemPrompt } from "./prompt"
import { progressTool } from "./progress"
import type { ProgressInput } from "./progress"
import { closeDefaultServices, defaultServices } from "./application/services"
import {
  REVIEW_BUILDER_AGENT_NAME,
  REVIEW_BUILDER_PROMPT,
  REVIEW_EVALUATOR_AGENT_NAME,
  REVIEW_EVALUATOR_PROMPT,
} from "./application/review-contracts"
import {
  PATTERN_PRESENTER_AGENT_NAME,
  PATTERN_PRESENTER_PROMPT,
} from "./application/presentation-contracts"
import { deleteDefaultData } from "./infrastructure/database"
import { recordCorrectionTool, type RecordCorrectionInput } from "./correction"
import { suggestExpressionTool, type SuggestExpressionInput } from "./suggest-expression"
import {
  TRANSLATOR_AGENT_NAME,
  TRANSLATOR_PROMPT,
} from "./application/translation-service"
import { translationOperations } from "./translation-operations"
import {
  translationHistoryTool,
  type TranslationHistoryInput,
} from "./translation-history"
import { AGENT_CALL_TIMEOUT_MS } from "./agent-runtime"

const ProgressInputJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["all", "current"],
      description: "Use all enabled Scopes or only the current Scope.",
    },
    language: {
      type: "string",
      minLength: 2,
      maxLength: 64,
      description: "BCP-47 target language tag. Defaults to the configured target language.",
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
  version: "0.8.0",
  description: "Work-first multilingual coaching, evidence tracking, and private review scheduling for Synergy",
  compatibility: { synergy: ">=3.0.11" },
  author: "Eric Sanchez",
  homepage: "https://github.com/EricSanchezok/vibe-lingo",
  repository: "https://github.com/EricSanchezok/vibe-lingo",
  keywords: ["language-learning", "translation", "coaching", "review"],
  capabilities: [
    capability("session.read"),
    capability("settings.read"),
    capability("settings.write"),
    capability("ui.hostActions"),
    capability("selection.read"),
    capability("agent.call", {
      maxRuntimeMs: AGENT_CALL_TIMEOUT_MS,
      maxInputChars: 8_000,
      maxOutputChars: 8_000,
      modelRoles: ["nano", "mini", "mid", "thinking", "long", "creative"],
    }),
  ],
  contributions: [
    event({
      id: "learning.changed",
      payload: {
        type: "object",
        properties: {
          targetLanguage: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          reason: { type: "string" },
        },
        required: ["targetLanguage", "revision", "reason"],
        additionalProperties: false,
      },
    }),
    event({
      id: "review.changed",
      payload: {
        type: "object",
        properties: {
          targetLanguage: { type: "string" },
          reviewId: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          reason: { type: "string" },
        },
        required: ["targetLanguage", "reviewId", "revision", "reason"],
        additionalProperties: false,
      },
    }),
    event({
      id: "translation.changed",
      payload: {
        type: "object",
        properties: {
          targetLanguage: { type: "string" },
          reason: { type: "string" },
        },
        required: ["targetLanguage", "reason"],
        additionalProperties: false,
      },
    }),
    ...dashboardOperations,
    ...translationOperations,
    navigationItem({
      id: "learning",
      label: "VibeLingo",
      icon: "languages",
      placement: "sidebar",
      order: 45,
      component: { source: "./src/ui/app.tsx" },
    }),
    textAction({
      id: "translate-selection",
      label: "Translate",
      icon: "languages",
      operation: "translate-selection",
      order: 100,
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
    }),
    agent({
      id: "translator",
      agent: {
        name: TRANSLATOR_AGENT_NAME,
        description: "Private bounded selection translator for VibeLingo",
        prompt: TRANSLATOR_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "language-classifier",
      agent: {
        name: LANGUAGE_CLASSIFIER_AGENT_NAME,
        description: "Private target-language attempt classifier for VibeLingo",
        prompt: LANGUAGE_CLASSIFIER_PROMPT,
        mode: "subagent",
        modelRole: "nano",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "usage-analyzer",
      agent: {
        name: USAGE_ANALYZER_AGENT_NAME,
        description: "Private known-pattern natural-use analyzer for VibeLingo",
        prompt: USAGE_ANALYZER_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "correction-analyzer",
      agent: {
        name: CORRECTION_ANALYZER_AGENT_NAME,
        description: "Private correction metadata analyzer for VibeLingo",
        prompt: CORRECTION_ANALYZER_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "review-builder",
      agent: {
        name: REVIEW_BUILDER_AGENT_NAME,
        description: "Private work-oriented retrieval-practice generator for VibeLingo",
        prompt: REVIEW_BUILDER_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0.2,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "review-evaluator",
      agent: {
        name: REVIEW_EVALUATOR_AGENT_NAME,
        description: "Private structured evaluator for VibeLingo review responses",
        prompt: REVIEW_EVALUATOR_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    agent({
      id: "pattern-presenter",
      agent: {
        name: PATTERN_PRESENTER_AGENT_NAME,
        description: "Private localized presentation generator for VibeLingo learning patterns",
        prompt: PATTERN_PRESENTER_PROMPT,
        mode: "subagent",
        modelRole: "mini",
        temperature: 0,
        steps: 1,
        hidden: true,
        permission: { "*": "deny" },
      },
    }),
    hook<"chat.system.transform">({
      id: "coach-system",
      point: "chat.system.transform",
      requires: ["session.read", "settings.read"],
      async handler(input, context) {
        return transformSystemPrompt(
          input,
          context,
          defaultPromptDependencies((targetLanguage, limit) =>
            defaultServices().learning.recurringPatterns(targetLanguage, limit),
          ),
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
    hook<"agent.call.after">({
      id: "complete-teaching-analysis",
      point: "agent.call.after",
      requires: ["settings.read", "agent.call"],
      async handler(input, context) {
        await handleAgentCallAfter(input, context)
      },
    }),
    tool<RecordCorrectionInput>({
      id: "record-correction",
      description:
        "Display and record the exact objective corrections and contextual naturalness suggestions selected by the main Agent. Call this as the first visible action only when the VibeLingo coaching contract requires language feedback.",
      requires: ["settings.read", "agent.call"],
      exposure: { mode: "resident" },
      display: { toolCard: "visible" },
      input: {
        type: "object",
        properties: {
          restatement: { type: "string", minLength: 1, maxLength: 500 },
          corrections: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: ["correction", "naturalness"],
                },
                originalFragment: { type: "string", minLength: 1, maxLength: 160 },
                correctedFragment: { type: "string", minLength: 1, maxLength: 160 },
                explanation: { type: "string", minLength: 1, maxLength: 200 },
              },
              required: ["kind", "originalFragment", "correctedFragment"],
              additionalProperties: false,
            },
          },
        },
        required: ["restatement", "corrections"],
        additionalProperties: false,
      },
      async handler(input, context) {
        return recordCorrectionTool(input, context)
      },
    }),
    messageRenderer({
      id: "correction-card",
      label: "VibeLingo correction",
      messageType: "tool",
      tool: "plugin__vibe-lingo__record-correction",
      component: { source: "./src/ui/correction-card.tsx" },
    }),
    tool<SuggestExpressionInput>({
      id: "suggest-expression",
      description:
        "Display how the user's message would naturally be expressed in the configured target language when the user did not write the message in the target language. Call this as the first visible action only when the VibeLingo coaching contract calls for a target-language example. Do not use it for target-language attempts (use plugin__vibe-lingo__record-correction instead), for code, commands, paths, identifiers, pasted text, quotations, or trivial acknowledgements.",
      requires: ["settings.read"],
      exposure: { mode: "resident" },
      display: { toolCard: "visible" },
      input: {
        type: "object",
        properties: {
          sourceExpression: { type: "string", minLength: 1, maxLength: 500 },
          targetExpression: { type: "string", minLength: 1, maxLength: 500 },
          notes: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["sourceExpression", "targetExpression"],
        additionalProperties: false,
      },
      async handler(input, context) {
        return suggestExpressionTool(input, context)
      },
    }),
    messageRenderer({
      id: "expression-card",
      label: "VibeLingo target-language example",
      messageType: "tool",
      tool: "plugin__vibe-lingo__suggest-expression",
      component: { source: "./src/ui/suggest-expression-card.tsx" },
    }),
    tool<ProgressInput>({
      id: "progress",
      description:
        "Show the user's evidence-backed VibeLingo learning progress, review status, recurring patterns, and provenance. Use only when the user explicitly asks about language progress, recurring mistakes, reviews, or historical examples.",
      exposure: {
        mode: "search",
        title: "VibeLingo progress",
        keywords: ["language learning", "mistakes", "corrections", "progress"],
      },
      input: ProgressInputJsonSchema,
      async handler(input, context) {
        return progressTool(input, context)
      },
    }),
    messageRenderer({
      id: "progress-card",
      label: "VibeLingo learning progress",
      messageType: "tool",
      tool: "plugin__vibe-lingo__progress",
      component: { source: "./src/ui/progress-card.tsx" },
    }),
    tool<TranslationHistoryInput>({
      id: "translation-history",
      description:
        "Show saved VibeLingo translation history. Use only when the user explicitly asks about previous translations or translation history.",
      exposure: {
        mode: "search",
        title: "VibeLingo translation history",
        keywords: [
          "translation history",
          "previous translations",
          "saved translations",
        ],
      },
      input: {
        type: "object",
        properties: {
          language: { type: "string", minLength: 1, maxLength: 64 },
          query: { type: "string", maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        additionalProperties: false,
      },
      async handler(input, context) {
        return translationHistoryTool(input, context)
      },
    }),
    settings({
      id: "settings",
      label: "VibeLingo",
      group: "plugins",
      component: { source: "./src/ui/settings.tsx" },
      formSchema: {
        type: "object",
        description: "Set your language pair before VibeLingo starts coaching or tracking.",
        properties: {
          nativeLanguage: {
            type: "string",
            default: "",
            maxLength: 64,
            title: "Support language",
            description: "The language VibeLingo should use when an explanation is helpful.",
          },
          targetLanguage: {
            type: "string",
            default: "",
            maxLength: 64,
            title: "Target language",
            description: "The language you want to practice while using Synergy.",
          },
          proficiency: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
            default: "intermediate",
            title: "Current level",
            description: "Adjusts which language issues are most useful to surface.",
          },
          correctionMode: {
            type: "string",
            enum: ["focused", "strict", "off"],
            default: "focused",
            title: "Correction mode",
            description: "Focused surfaces high-value issues; strict surfaces every certain target-language issue.",
          },
          naturalnessSuggestionsEnabled: {
            type: "boolean",
            default: true,
            title: "Suggest more natural phrasing",
            description:
              "Suggest clearly more conventional wording in context, even when the original is grammatical.",
          },
          expressionSuggestionsEnabled: {
            type: "boolean",
            default: true,
            title: "Show how to say it in the target language",
            description:
              "Suggest a target-language version when you write a message in the support language.",
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
          languageDetectionModelRole: {
            type: "string",
            enum: ["nano", "mini", "mid", "thinking", "long", "creative"],
            default: "nano",
            title: "Language detection",
            description: "Model role used to identify target-language practice.",
          },
          learningAnalysisModelRole: {
            type: "string",
            enum: ["nano", "mini", "mid", "thinking", "long", "creative"],
            default: "mini",
            title: "Learning analysis",
            description: "Model role used to organize corrections and natural-use evidence.",
          },
          translationModelRole: {
            type: "string",
            enum: ["nano", "mini", "mid", "thinking", "long", "creative"],
            default: "mini",
            title: "Translation",
            description: "Model role used for selection translation.",
          },
          reviewModelRole: {
            type: "string",
            enum: ["nano", "mini", "mid", "thinking", "long", "creative"],
            default: "mini",
            title: "Review and presentation",
            description: "Model role used for reviews and localized learning-pattern presentation.",
          },
          translationHistoryEnabled: {
            type: "boolean",
            default: true,
            title: "Save translation history",
            description:
              "Save selected source text and translations locally for cache reuse and history. Existing cache remains reusable when off.",
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
    closeDefaultServices()
  },
})

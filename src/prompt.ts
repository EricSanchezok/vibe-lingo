import type {
  PluginInvocationContext,
  PluginSystemTransformInput,
} from "@ericsanchezok/synergy-plugin"
import type { VibeLingoSettings } from "./settings"
import { readSettings } from "./settings"
import { hasUserFacingRootSession } from "./session"
import type { RecurringPattern } from "./types"

export const COACHING_MARKER = "[VIBE_LINGO_CONTRACT_V1]"

export type PromptDependencies = {
  readSettings(context: PluginInvocationContext): Promise<VibeLingoSettings>
  hasEligibleSession(sessionId: string | undefined, context: PluginInvocationContext): Promise<boolean>
  recurringPatterns(limit: number): RecurringPattern[]
}

export function stripCoachingContract(system: string[]): string[] {
  return system.filter((entry) => !entry.includes(COACHING_MARKER))
}

function modeRule(mode: VibeLingoSettings["correctionMode"]): string {
  if (mode === "strict") {
    return "In strict mode, correct every certain, genuine English error, but show no more than two compact correction lines."
  }
  return "In focused mode, ignore isolated minor slips. Correct only meaning-affecting, clearly unnatural, or recurring issues, and show no more than one compact correction line."
}

function recurringSection(patterns: RecurringPattern[]): string {
  if (patterns.length === 0) return ""
  const entries = patterns.map((pattern) => `- ${pattern.patternKey}: ${pattern.label} — ${pattern.rule}`).join("\n")
  return `\nRecurring focus supplied by VibeLingo:\n${entries}\nPrioritize one of these only if it appears again in the current user message. Do not reveal tracking details or say the user "often" makes it.`
}

export function buildCoachingContract(
  mode: Exclude<VibeLingoSettings["correctionMode"], "off">,
  recurring: RecurringPattern[],
): string {
  return `${COACHING_MARKER}

Your primary duty is to complete the user's real task. English coaching is secondary and must never delay clear work.

Apply coaching only when the user is attempting English or explicitly asks for English help. Do not correct ordinary Chinese task instructions, code, paths, identifiers, quotations, or pasted material unless asked.

When intent is clear:
- Execute immediately. Never require the user to rewrite a request merely to improve English.
- If there is a high-value English issue, begin the user-visible response with: Got it: "<one-sentence natural English restatement>"
- Preserve every requirement, constraint, scope boundary, modality, and degree of certainty from the original.
- After completing the main task, optionally add: 💡 "<original fragment>" → "<natural fragment>"
- Do not comment on good English.

When different interpretations would materially change the work:
- Do not guess.
- Explain what is ambiguous, offer 2–3 correctly phrased interpretations, and wait for clarification.

If the user says "just do it", "skip the lesson", "直接做", or "跳过纠正", perform the task without coaching for that message.

${modeRule(mode)}

Use casual language and no grammar jargon. Do not repeat a correction during tool-loop updates. Never claim that something is recurring unless it appears in the recurring-focus list below.${recurringSection(recurring)}`
}

export async function transformSystemPrompt(
  input: PluginSystemTransformInput,
  context: PluginInvocationContext,
  dependencies: PromptDependencies,
): Promise<{ system: string[] }> {
  const base = stripCoachingContract(input.system)
  if (input.small === true) return { system: base }

  try {
    if (!(await dependencies.hasEligibleSession(input.sessionID, context))) return { system: base }
    const settings = await dependencies.readSettings(context)
    if (settings.correctionMode === "off") return { system: base }
    const recurring = settings.recurringFocusEnabled ? dependencies.recurringPatterns(3) : []
    return { system: [...base, buildCoachingContract(settings.correctionMode, recurring)] }
  } catch {
    return { system: input.system }
  }
}

export function defaultPromptDependencies(recurringPatterns: (limit: number) => RecurringPattern[]): PromptDependencies {
  return {
    readSettings,
    hasEligibleSession: hasUserFacingRootSession,
    recurringPatterns,
  }
}

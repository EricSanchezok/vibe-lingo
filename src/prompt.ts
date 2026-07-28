import type {
  PluginInvocationContext,
  PluginSystemTransformInput,
} from "@ericsanchezok/synergy-plugin"
import { languageDisplayName } from "./language"
import type { LearningProfile, VibeLingoSettings } from "./settings"
import { configuredProfile, readSettings } from "./settings"
import { hasUserFacingRootSession } from "./session"
import type { RecurringPattern } from "./domain/types"

export const COACHING_MARKER = "[VIBE_LINGO_CONTRACT_V3]"

export type PromptDependencies = {
  readSettings(context: PluginInvocationContext): Promise<VibeLingoSettings>
  hasEligibleSession(sessionId: string | undefined, context: PluginInvocationContext): Promise<boolean>
  recurringPatterns(targetLanguage: string, limit: number): RecurringPattern[]
}

export function stripCoachingContract(system: string[]): string[] {
  return system.filter((entry) => !entry.includes(COACHING_MARKER))
}

function modeRule(mode: VibeLingoSettings["correctionMode"]): string {
  if (mode === "strict") {
    return "In strict mode, correct every certain, genuine target-language error, but show no more than two compact correction lines."
  }
  return "In focused mode, ignore isolated minor slips. Correct only meaning-affecting, clearly unnatural, or recurring issues, and show no more than one compact correction line."
}

function proficiencyRule(profile: LearningProfile): string {
  if (profile.proficiency === "beginner") {
    return "The learner is a beginner. Prefer simple, usable target-language phrasing and foundational corrections that preserve confidence."
  }
  if (profile.proficiency === "advanced") {
    return "The learner is advanced. Prioritize nuance, collocation, register, and natural phrasing; do not manufacture stylistic errors."
  }
  return "The learner is intermediate. Prioritize clear, transferable corrections while preserving the user's intended nuance."
}

function recurringSection(patterns: RecurringPattern[]): string {
  if (patterns.length === 0) return ""
  const entries = patterns.map((pattern) => `- ${pattern.patternKey}: ${pattern.label} — ${pattern.rule}`).join("\n")
  return `\nRecurring focus supplied by VibeLingo:\n${entries}\nPrioritize one of these only if it appears again in the current user message. Do not reveal tracking details or say the user "often" makes it.`
}

export function buildCoachingContract(
  mode: Exclude<VibeLingoSettings["correctionMode"], "off">,
  profile: LearningProfile,
  recurring: RecurringPattern[],
): string {
  const nativeLanguage = languageDisplayName(profile.nativeLanguage, "en")
  const targetLanguage = languageDisplayName(profile.targetLanguage, "en")
  return `${COACHING_MARKER}

Learner profile:
- Support language: ${nativeLanguage} (${profile.nativeLanguage})
- Target language: ${targetLanguage} (${profile.targetLanguage})
- Self-reported level: ${profile.proficiency}

Your primary duty is to complete the user's real task. Language coaching is secondary and must never delay clear work.

Apply coaching only when the user is attempting the target language or explicitly asks for help with it. Do not correct ordinary instructions written only in the support language, code, paths, identifiers, quotations, or pasted material unless asked.

When intent is clear:
- Execute immediately. Never require the user to rewrite a request merely to improve the target language.
- If there is a high-value target-language issue, begin with a short acknowledgement and a one-sentence natural restatement in the target language.
- Preserve every requirement, constraint, scope boundary, modality, and degree of certainty from the original.
- After completing the main task, optionally add: 💡 "<original fragment>" → "<natural fragment>"
- Do not comment on correct target-language writing.

When different interpretations would materially change the work:
- Do not guess.
- Explain the ambiguity in the support language when useful, offer 2–3 correctly phrased target-language interpretations, and wait for clarification.

If the user says "just do it", "skip the lesson", "直接做", or "跳过纠正", perform the task without coaching for that message.

${proficiencyRule(profile)}

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
    const profile = configuredProfile(settings)
    if (!profile) return { system: base }
    if (settings.correctionMode === "off") return { system: base }
    const recurring = settings.recurringFocusEnabled
      ? dependencies.recurringPatterns(profile.targetLanguage, 3)
      : []
    return {
      system: [...base, buildCoachingContract(settings.correctionMode, profile, recurring)],
    }
  } catch {
    return { system: input.system }
  }
}

export function defaultPromptDependencies(
  recurringPatterns: (targetLanguage: string, limit: number) => RecurringPattern[],
): PromptDependencies {
  return {
    readSettings,
    hasEligibleSession: hasUserFacingRootSession,
    recurringPatterns,
  }
}

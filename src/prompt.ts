import type {
  PluginInvocationContext,
  PluginSystemTransformInput,
} from "@ericsanchezok/synergy-plugin"
import { languageDisplayName } from "./language"
import type { LearningProfile, VibeLingoSettings } from "./settings"
import { configuredProfile, readSettings } from "./settings"
import { hasUserFacingRootSession } from "./session"
import type { RecurringPattern } from "./domain/types"

export const COACHING_MARKER = "[VIBE_LINGO_CONTRACT_V4]"

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
    return `You are operating in strict correction mode.

Correct every certain, genuine target-language issue, including a clear case where a non-target-language word or phrase fills a normal place in an otherwise target-language expression.

Do not correct intentional bilingual phrasing or any excluded content listed above. Submit one or two correction pairs, selecting the most important issues when more than two are present.`
  }
  return `You are operating in focused correction mode.

Ignore isolated minor slips. Correct only issues that affect meaning, are clearly unnatural, or match a recurring focus.

For mixed-language expressions, correct a non-target-language fragment only when it noticeably interrupts the target-language expression or matches a recurring focus.

When correction is warranted, submit exactly one correction pair.`
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

Apply coaching when the user is attempting the target language or explicitly asks for help with it.

Treat a message as a target-language attempt when the target language provides the main structure of the user's expression, even if it includes words or short phrases from another language.

When a non-target-language word or phrase fills a normal place in an otherwise target-language expression, treat it as a target-language issue if a clear, natural replacement exists in the target language.

Do not treat all mixed-language writing as an error. Leave it unchanged when the other-language content is intentional bilingual phrasing, a proper name, quoted material, code, a command, a path, an identifier, a product name, or a technical term normally kept in its original language.

When it is genuinely unclear whether the language mixing is intentional, correct it only if the natural target-language replacement clearly preserves the user's meaning. Otherwise, leave it unchanged.

Do not apply coaching to ordinary instructions written primarily in the support language merely because they contain isolated target-language technical terms.

When intent is clear:
- Execute immediately. Never require the user to rewrite a request merely to improve the target language.
- If there is no correction-worthy issue, execute with no coaching preface.
- If there is a correction-worthy issue, your first user-visible action—before any progress update, other tool, or substantive answer—must be a call to plugin__vibe-lingo__record-correction.
- Give that tool only a one-sentence natural target-language restatement and the minimal original/corrected fragment pairs that the user should see.
- Do not write a duplicate "Got it" or correction block in ordinary assistant text. The tool card is the complete visible correction.
- After the correction tool returns, continue the real task immediately.
- Preserve every requirement, constraint, scope boundary, modality, and degree of certainty from the original.
- Never postpone correction until the task is complete and never repeat it later in progress updates or the final answer.
- Do not invent or submit pattern keys, categories, severity, rules, confidence, message IDs, or learning metadata. VibeLingo analyzes those separately.
- Do not comment on correct target-language writing.

When different interpretations would materially change the work:
- Do not guess.
- Explain the ambiguity in the support language when useful, offer 2–3 correctly phrased target-language interpretations, and wait for clarification.

If the user says "just do it", "skip the lesson", "直接做", or "跳过纠正", perform the task without coaching for that message.

${proficiencyRule(profile)}

${modeRule(mode)}

Use casual language and no grammar jargon. Never claim that something is recurring unless it appears in the recurring-focus list below.${recurringSection(recurring)}`
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

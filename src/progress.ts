import type { PluginInvocationContext, ToolResult } from "@ericsanchezok/synergy-plugin"
import { canonicalLanguageTag, languageDisplayName } from "./language"
import { configuredProfile, readSettings } from "./settings"
import { defaultServices } from "./application/services"
import type { LearningRepository } from "./infrastructure/learning-repository"
import type { ProgressSnapshot } from "./domain/types"

export type ProgressInput = {
  scope?: "all" | "current"
  language?: string
  limit?: number
  includeExamples?: boolean
}

export type ProgressCardPattern = {
  patternKey: string
  label: string
  rule: string
  stage: "candidate" | "practicing" | "verified"
  occurrenceCount: number
}

export type ProgressCardMetadata =
  | {
      kind: "progress"
      state: "setup_required" | "invalid_language"
    }
  | {
      kind: "progress"
      state: "ready"
      targetLanguage: string
      targetName: string
      scope: "all" | "current"
      summary: {
        targetAttemptsToday: number
        targetSessionsToday: number
        correctionsToday: number
        correctionsAnalyzing: number
        activeDays: number
        learningWeek: number
        candidatePatternCount: number
        practicingPatternCount: number
        verifiedPatternCount: number
        duePatternCount: number
      }
      patterns: ProgressCardPattern[]
    }

function day(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function inlineFragment(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").replaceAll("`", "ˋ").trim()
}

export function renderProgress(
  snapshot: ProgressSnapshot,
  includeExamples: boolean,
  targetName = languageDisplayName(snapshot.targetLanguage, "en"),
): string {
  const lines = [
    `## VibeLingo ${targetName} learning evidence`,
    "",
    `- Today: ${snapshot.summary.targetAttemptsToday} target-language attempt(s) across ${snapshot.summary.targetSessionsToday} session(s)`,
    `- Messages analyzed today: ${snapshot.summary.analyzedMessagesToday}`,
    `- Visible corrections today: ${snapshot.summary.correctionsToday}`,
    `- Accepted learning findings today: ${snapshot.summary.acceptedFindingsToday}`,
    `- Correction analysis: ${snapshot.summary.correctionsAnalyzing} in progress; ${snapshot.summary.correctionsFailed} failed`,
    `- Target-language attempts: ${snapshot.summary.targetAttempts}`,
    `- Active days: ${snapshot.summary.activeDays}`,
    `- Due for review: ${snapshot.summary.duePatternCount}`,
    `- Independent recall (last 30 days): ${snapshot.summary.independentRecallCountLast30Days} / ${snapshot.summary.reviewRecallCountLast30Days}`,
    `- Successful transfer practice (last 30 days): ${snapshot.summary.successfulTransferCountLast30Days} across ${snapshot.summary.successfulTransferSessionCountLast30Days} session(s)`,
    `- Completed review sessions: ${snapshot.summary.reviewCount}`,
    `- Candidate / practicing / verified patterns: ${snapshot.summary.candidatePatternCount} / ${snapshot.summary.practicingPatternCount} / ${snapshot.summary.verifiedPatternCount}`,
  ]
  if (snapshot.patterns.length === 0) {
    lines.push("", `No stored ${targetName} learning patterns match this view yet.`)
    return lines.join("\n")
  }

  lines.push("", "### Top patterns")
  snapshot.patterns.forEach((pattern, index) => {
    lines.push(
      "",
      `${index + 1}. **${pattern.label}** (\`${pattern.patternKey}\`)`,
      `   - ${pattern.rule}`,
      `   - Stage: ${pattern.stage}; ${pattern.occurrenceCount} error evidence item(s) across ${pattern.sessionCount} session(s)`,
      `   - ${pattern.naturalCorrectCount} natural correct use(s); ${pattern.independentReviewCount} independent review(s)`,
      `   - First seen ${day(pattern.firstSeenAt)}; last seen ${day(pattern.lastSeenAt)}`,
    )
    if (!includeExamples) return
    for (const example of pattern.examples) {
      lines.push(
        `   - ${day(example.observedAt)} — \`${inlineFragment(example.originalFragment)}\` → \`${inlineFragment(example.correctedFragment)}\``,
        `     scope \`${example.scopeId}\`, session \`${example.sessionId}\`, message \`${example.messageId}\``,
      )
    }
  })
  return lines.join("\n")
}

export async function progressTool(
  input: ProgressInput,
  context: PluginInvocationContext,
  learning: LearningRepository = defaultServices().learning,
): Promise<ToolResult> {
  const settings = await readSettings(context)
  const profile = configuredProfile(settings)
  if (!profile) {
    return {
      title: "VibeLingo setup required",
      output: "Complete your native language, target language, and proficiency in VibeLingo settings first.",
      metadata: {
        vibeLingo: {
          kind: "progress",
          state: "setup_required",
        } satisfies ProgressCardMetadata,
      },
    }
  }
  const scope = input.scope ?? "all"
  const limit = Math.max(1, Math.min(10, Math.trunc(input.limit ?? 5)))
  const includeExamples = input.includeExamples ?? false
  const targetLanguage = input.language
    ? canonicalLanguageTag(input.language)
    : profile.targetLanguage
  if (!targetLanguage) {
    return {
      title: "Invalid language",
      output: "Use a valid BCP-47 language tag, such as en, zh-Hans, or pt-BR.",
      metadata: {
        vibeLingo: {
          kind: "progress",
          state: "invalid_language",
        } satisfies ProgressCardMetadata,
      },
    }
  }
  const snapshot = learning.progress({
    targetLanguage,
    scopeId: scope === "current" ? context.scopeId : undefined,
    limit,
    includeExamples,
  })
  const targetName = languageDisplayName(targetLanguage, "en")
  const progressMetadata: ProgressCardMetadata = {
    kind: "progress",
    state: "ready",
    targetLanguage,
    targetName,
    scope,
    summary: {
      targetAttemptsToday: snapshot.summary.targetAttemptsToday,
      targetSessionsToday: snapshot.summary.targetSessionsToday,
      correctionsToday: snapshot.summary.correctionsToday,
      correctionsAnalyzing: snapshot.summary.correctionsAnalyzing,
      activeDays: snapshot.summary.activeDays,
      learningWeek: snapshot.summary.learningWeek,
      candidatePatternCount: snapshot.summary.candidatePatternCount,
      practicingPatternCount: snapshot.summary.practicingPatternCount,
      verifiedPatternCount: snapshot.summary.verifiedPatternCount,
      duePatternCount: snapshot.summary.duePatternCount,
    },
    patterns: snapshot.patterns.map((pattern) => ({
      patternKey: pattern.patternKey,
      label: pattern.label,
      rule: pattern.rule,
      stage: pattern.stage,
      occurrenceCount: pattern.occurrenceCount,
    })),
  }
  return {
    title: `VibeLingo ${targetName} patterns`,
    output: renderProgress(snapshot, includeExamples, targetName),
    metadata: {
      vibeLingo: progressMetadata,
    },
  }
}

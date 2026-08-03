import type { PluginInvocationContext, ToolResult } from "@ericsanchezok/synergy-plugin"
import { defaultServices, type VibeLingoServices } from "./application/services"
import { enqueueCorrectionAnalysis } from "./analysis"
import { hasUserFacingRootSession } from "./session"
import { configuredProfile, readSettings } from "./settings"

type FeedbackKind = "correction" | "naturalness"

export type RecordCorrectionInput = {
  restatement: string
  corrections: Array<{
    kind: FeedbackKind
    originalFragment: string
    correctedFragment: string
    explanation?: string
  }>
}

function codePoints(value: string): number {
  return Array.from(value).length
}

function readableCorrection(input: RecordCorrectionInput): string {
  return [
    `Got it: "${input.restatement}"`,
    ...input.corrections.map(
      (correction) => [
        `${correction.kind === "naturalness" ? "More natural" : "Correction"}: "${correction.originalFragment}" → "${correction.correctedFragment}"`,
        ...(correction.explanation ? [correction.explanation] : []),
      ].join("\n"),
    ),
  ].join("\n")
}

function feedbackTitle(input: RecordCorrectionInput): string {
  const kinds = new Set(input.corrections.map((item) => item.kind))
  if (kinds.size > 1) return "Language feedback"
  return kinds.has("naturalness") ? "A more natural expression" : "Wording to adjust"
}

function result(
  input: RecordCorrectionInput,
  status: string,
  message: string,
  metadata: Record<string, unknown> = {},
): ToolResult {
  return {
    title: feedbackTitle(input),
    output: `${readableCorrection(input)}\n\n${message}`,
    metadata: {
      vibeLingo: {
        status,
        ...metadata,
      },
    },
  }
}

export async function recordCorrectionTool(
  input: RecordCorrectionInput,
  context: PluginInvocationContext,
  services: VibeLingoServices = defaultServices(),
): Promise<ToolResult> {
  if (input.corrections.length < 1 || input.corrections.length > 8) {
    throw new Error("Language feedback requires between one and eight items.")
  }
  if (
    !input.restatement.trim()
    || codePoints(input.restatement) > 500
    || input.corrections.some(
      (item) =>
        !["correction", "naturalness"].includes(item.kind)
        || !item.originalFragment.trim()
        || !item.correctedFragment.trim()
        || codePoints(item.originalFragment) > 160
        || codePoints(item.correctedFragment) > 160,
    )
  ) {
    throw new Error("Correction text is empty or exceeds VibeLingo's privacy bounds.")
  }
  for (const item of input.corrections) {
    if (item.kind === "naturalness") {
      if (!item.explanation?.trim() || codePoints(item.explanation) > 200) {
        throw new Error("A naturalness suggestion requires one short support-language explanation.")
      }
    } else if (item.explanation !== undefined) {
      throw new Error("Only naturalness items include an explanation.")
    }
  }
  const settings = await readSettings(context)
  const profile = configuredProfile(settings)
  if (!profile || settings.correctionMode === "off") {
    throw new Error("VibeLingo coaching is not configured for this Scope.")
  }
  if (
    !settings.naturalnessSuggestionsEnabled
    && input.corrections.some((item) => item.kind === "naturalness")
  ) {
    throw new Error("Naturalness suggestions are disabled for this Scope.")
  }
  if (
    context.actor.type !== "agent"
    || !context.actor.userMessageId
    || !context.actor.messageId
    || !context.sessionId
  ) {
    throw new Error("VibeLingo correction recording requires a user-facing Agent tool call.")
  }
  if (!settings.trackingEnabled) {
    return result(input, "not_saved", "Shown in this chat only; learning tracking is off.")
  }

  const identity = {
    messageId: context.actor.userMessageId,
    scopeId: context.scopeId,
    sessionId: context.sessionId,
    observedAt: Date.now(),
  }
  services.learning.recordObservation(identity, profile, "target_attempt", "foreground_correction")
  const created = services.corrections.create({
    profile,
    identity,
    assistantMessageId: context.actor.messageId,
    correction: input,
  })
  if (created.kind === "conflict") {
    return result(
      input,
      "conflict",
      "Different language feedback was already recorded for this response.",
      { batchId: created.batch?.id, targetLanguage: profile.targetLanguage },
    )
  }
  const batch = created.batch
  if (!batch) throw new Error("VibeLingo could not read the saved correction.")
  const analysisStatus = ["pending", "queued"].includes(batch.status)
    ? await enqueueCorrectionAnalysis(batch, profile, context, {
      services,
      readSettings,
      hasEligibleSession: hasUserFacingRootSession,
    }, settings)
    : batch.status
  try {
    await context.events.publish("learning.changed", {
      targetLanguage: profile.targetLanguage,
      revision: services.learning.revision(profile.targetLanguage),
      reason: created.kind === "created" ? "correction-recorded" : "correction-reused",
    })
  } catch {
    // SQLite remains authoritative if UI invalidation cannot be published.
  }
  return result(
    input,
    analysisStatus === "queued" || analysisStatus === "pending"
      ? "analyzing"
      : analysisStatus,
    analysisStatus === "queued" || analysisStatus === "pending"
      ? "Organizing this language feedback in your learning record…"
      : "Saved to your learning record.",
    {
      batchId: batch.id,
      targetLanguage: profile.targetLanguage,
      analysisStatus,
    },
  )
}

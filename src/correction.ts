import type { PluginInvocationContext, ToolResult } from "@ericsanchezok/synergy-plugin"
import { defaultServices, type VibeLingoServices } from "./application/services"
import { enqueueCorrectionAnalysis } from "./analysis"
import { hasUserFacingRootSession } from "./session"
import { configuredProfile, readSettings } from "./settings"
import type { CorrectionInput } from "./infrastructure/correction-repository"

export type RecordCorrectionInput = CorrectionInput

function codePoints(value: string): number {
  return Array.from(value).length
}

function readableCorrection(input: RecordCorrectionInput): string {
  return [
    `Got it: "${input.restatement}"`,
    ...input.corrections.map(
      (correction) => `💡 "${correction.originalFragment}" → "${correction.correctedFragment}"`,
    ),
  ].join("\n")
}

function result(
  input: RecordCorrectionInput,
  status: string,
  message: string,
  metadata: Record<string, unknown> = {},
): ToolResult {
  return {
    title: "A more natural expression",
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
  if (
    !input.restatement.trim()
    || codePoints(input.restatement) > 500
    || input.corrections.some(
      (item) =>
        !item.originalFragment.trim()
        || !item.correctedFragment.trim()
        || codePoints(item.originalFragment) > 160
        || codePoints(item.correctedFragment) > 160,
    )
  ) {
    throw new Error("Correction text is empty or exceeds VibeLingo's privacy bounds.")
  }
  const settings = await readSettings(context)
  const profile = configuredProfile(settings)
  if (!profile || settings.correctionMode === "off") {
    throw new Error("VibeLingo coaching is not configured for this Scope.")
  }
  const expectedMaximum = settings.correctionMode === "focused" ? 1 : 2
  if (
    input.corrections.length < 1
    || input.corrections.length > expectedMaximum
    || (settings.correctionMode === "focused" && input.corrections.length !== 1)
  ) {
    throw new Error(
      settings.correctionMode === "focused"
        ? "Focused mode requires exactly one correction."
        : "Strict mode allows one or two corrections.",
    )
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
      "A different correction was already recorded for this response.",
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
      })
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
      ? "Organizing this correction in your learning record…"
      : "Saved to your learning record.",
    {
      batchId: batch.id,
      targetLanguage: profile.targetLanguage,
      analysisStatus,
    },
  )
}

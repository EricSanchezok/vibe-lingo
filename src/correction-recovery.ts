import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { z } from "zod"
import {
  CORRECTION_ANALYSIS_GRACE_MS,
  enqueueCorrectionAnalysis,
  profileForTarget,
  type AnalysisDependencies,
} from "./analysis"
import { defaultServices, type VibeLingoServices } from "./application/services"
import type { CorrectionBatch } from "./infrastructure/correction-repository"
import { readSettings, type VibeLingoSettings } from "./settings"

export const CorrectionRecoverySchema = z.enum(["none", "waiting", "retry_available", "retry_unavailable"])

export const CorrectionStatusOutputSchema = z.object({
  found: z.boolean(),
  status: z.enum(["pending", "queued", "analyzed", "recorded_only", "failed"]).optional(),
  patternKeys: z.array(z.string()),
  recovery: CorrectionRecoverySchema,
  retryAt: z.number().int().nonnegative().optional(),
})

export type CorrectionStatusOutput = z.infer<typeof CorrectionStatusOutputSchema>

export type CorrectionRecoveryDependencies = {
  services: VibeLingoServices
  readSettings(context: PluginInvocationContext): Promise<VibeLingoSettings>
  now(): number
}

function defaultDependencies(): CorrectionRecoveryDependencies {
  return {
    services: defaultServices(),
    readSettings,
    now: Date.now,
  }
}

function patternKeys(batch: CorrectionBatch): string[] {
  return [
    ...new Set(batch.corrections.filter((item) => item.accepted && item.patternKey).map((item) => item.patternKey!)),
  ]
}

export function projectCorrectionStatus(
  batch: CorrectionBatch | undefined,
  input: { now: number; retryAvailable: boolean },
): CorrectionStatusOutput {
  if (!batch) return { found: false, patternKeys: [], recovery: "none" }
  const base = {
    found: true as const,
    status: batch.status,
    patternKeys: patternKeys(batch),
  }
  if (batch.status === "queued") {
    const retryAt = (batch.queuedAt ?? 0) + CORRECTION_ANALYSIS_GRACE_MS
    if (retryAt > input.now) return { ...base, recovery: "waiting", retryAt }
    return {
      ...base,
      recovery: input.retryAvailable ? "retry_available" : "retry_unavailable",
    }
  }
  if (batch.status === "pending") {
    return {
      ...base,
      recovery: input.retryAvailable ? "retry_available" : "retry_unavailable",
    }
  }
  if (batch.status === "failed") {
    return {
      ...base,
      recovery: input.retryAvailable ? "retry_available" : "retry_unavailable",
    }
  }
  return { ...base, recovery: "none" }
}

async function projectionContext(
  batch: CorrectionBatch,
  context: PluginInvocationContext,
  dependencies: CorrectionRecoveryDependencies,
) {
  const settings = await dependencies.readSettings(context)
  const profile = profileForTarget(settings, batch.targetLanguage, dependencies.services)
  const retryAvailable = Boolean(profile && settings.trackingEnabled && context.agent?.start)
  return { settings, profile, retryAvailable }
}

export async function correctionStatus(
  batchId: string,
  context: PluginInvocationContext,
  dependencies: CorrectionRecoveryDependencies = defaultDependencies(),
): Promise<CorrectionStatusOutput> {
  const batch = dependencies.services.corrections.byIdForScope(batchId, context.scopeId)
  if (!batch)
    return projectCorrectionStatus(undefined, {
      now: dependencies.now(),
      retryAvailable: false,
    })
  const { retryAvailable } = await projectionContext(batch, context, dependencies)
  return projectCorrectionStatus(batch, {
    now: dependencies.now(),
    retryAvailable,
  })
}

export async function retryCorrectionAnalysis(
  batchId: string,
  context: PluginInvocationContext,
  dependencies: CorrectionRecoveryDependencies = defaultDependencies(),
): Promise<CorrectionStatusOutput> {
  const batch = dependencies.services.corrections.byIdForScope(batchId, context.scopeId)
  if (!batch)
    return projectCorrectionStatus(undefined, {
      now: dependencies.now(),
      retryAvailable: false,
    })
  const { settings, profile, retryAvailable } = await projectionContext(batch, context, dependencies)
  const before = projectCorrectionStatus(batch, {
    now: dependencies.now(),
    retryAvailable,
  })
  if (before.recovery !== "retry_available" || !profile) return before

  const analysisDependencies: AnalysisDependencies = {
    services: dependencies.services,
    readSettings: dependencies.readSettings,
    async hasEligibleSession() {
      return true
    },
  }
  await enqueueCorrectionAnalysis(batch, profile, context, analysisDependencies, settings)
  const current = dependencies.services.corrections.byIdForScope(batchId, context.scopeId)
  return projectCorrectionStatus(current, {
    now: dependencies.now(),
    retryAvailable: Boolean(current && settings.trackingEnabled && context.agent?.start),
  })
}

import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import type { VibeLingoServices } from "../src/application/services"
import type {
  ErrorCategory,
  ErrorSeverity,
  MessageIdentity,
} from "../src/domain/types"
import type { LearningProfile } from "../src/settings"

export function invocationContext(
  overrides: Omit<Partial<PluginInvocationContext>, "agent"> & {
    agent?: Partial<PluginInvocationContext["agent"]>
  } = {},
): PluginInvocationContext {
  const { agent: agentOverrides, ...contextOverrides } = overrides
  return {
    requestId: "request-test",
    scopeId: "scope-test",
    sessionId: "session-test",
    runtime: {
      hostVersion: "test",
      pluginVersion: "0.6.0",
      pluginGeneration: "generation-test",
      protocolVersion: 8,
    },
    actor: {
      type: "lifecycle",
    },
    signal: new AbortController().signal,
    log: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
    events: {
      async publish() {},
    },
    agent: {
      async call() {
        throw new Error("Unexpected synchronous Agent call")
      },
      async start() {
        throw new Error("Unexpected asynchronous Agent start")
      },
      ...agentOverrides,
    },
    ...contextOverrides,
  }
}

export function seedCorrection(
  services: VibeLingoServices,
  identity: MessageIdentity,
  profile: LearningProfile,
  finding: {
    patternKey: string
    category: ErrorCategory
    severity: ErrorSeverity
    label: string
    rule: string
    originalFragment?: string
    correctedFragment?: string
    confidence?: number
    sensitive?: boolean
  },
): string {
  services.learning.rememberProfile(profile, identity.observedAt)
  services.learning.recordObservation(identity, profile, "target_attempt", "foreground_correction")
  const created = services.corrections.create({
    profile,
    identity,
    assistantMessageId: `assistant-${identity.messageId}`,
    correction: {
      restatement: finding.correctedFragment ?? "Natural restatement",
      corrections: [{
        originalFragment: finding.originalFragment ?? "original",
        correctedFragment: finding.correctedFragment ?? "corrected",
      }],
    },
  })
  if (!created.batch) throw new Error("Correction seed could not create a batch")
  services.learning.recordCorrectionAnalysis(created.batch.id, {
    items: [{
      correctionIndex: 0,
      accepted: true,
      patternKey: finding.patternKey,
      category: finding.category,
      severity: finding.severity,
      label: finding.label,
      rule: finding.rule,
      confidence: finding.confidence ?? 0.98,
      sensitive: finding.sensitive ?? false,
    }],
  })
  return created.batch.id
}

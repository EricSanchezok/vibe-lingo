import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"

export function invocationContext(
  overrides: Partial<PluginInvocationContext> = {},
): PluginInvocationContext {
  return {
    requestId: "request-test",
    scopeId: "scope-test",
    sessionId: "session-test",
    runtime: {
      hostVersion: "test",
      pluginVersion: "0.3.0",
      pluginGeneration: "generation-test",
      protocolVersion: 5,
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
    ...overrides,
  }
}

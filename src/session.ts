import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"

type SessionRecord = {
  parentID?: unknown
  category?: unknown
  agenda?: unknown
  cortex?: unknown
  workflow?: unknown
  blueprint?: unknown
}

export function isUserFacingRootSession(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const session = value as SessionRecord
  if (typeof session.parentID === "string" && session.parentID.length > 0) return false
  if (session.category === "background") return false
  if (session.agenda || session.cortex || session.workflow || session.blueprint) return false
  return true
}

export async function hasUserFacingRootSession(
  sessionId: string | undefined,
  context: PluginInvocationContext,
): Promise<boolean> {
  if (!sessionId || !context.session?.get) return false
  return isUserFacingRootSession(await context.session.get(sessionId))
}

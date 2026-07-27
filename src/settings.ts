import type { PluginInvocationContext } from "@ericsanchezok/synergy-plugin"
import { z } from "zod"

export const CorrectionModeSchema = z.enum(["focused", "strict", "off"])

export const VibeLingoSettingsSchema = z.object({
  correctionMode: CorrectionModeSchema.default("focused"),
  trackingEnabled: z.boolean().default(true),
  recurringFocusEnabled: z.boolean().default(true),
})

export type VibeLingoSettings = z.infer<typeof VibeLingoSettingsSchema>

export const DEFAULT_SETTINGS: VibeLingoSettings = {
  correctionMode: "focused",
  trackingEnabled: true,
  recurringFocusEnabled: true,
}

export async function readSettings(context: PluginInvocationContext): Promise<VibeLingoSettings> {
  if (!context.settings?.get) throw new Error("VibeLingo settings are unavailable")
  const values = await context.settings.get()
  return VibeLingoSettingsSchema.parse(values)
}

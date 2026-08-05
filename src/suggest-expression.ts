import type { PluginInvocationContext, ToolResult } from "@ericsanchezok/synergy-plugin"
import type { VibeLingoServices } from "./application/services"
import { configuredProfile, readSettings } from "./settings"

export type SuggestExpressionInput = {
  sourceExpression: string
  targetExpression: string
  notes?: string
}

function codePoints(value: string): number {
  return Array.from(value).length
}

function result(
  input: SuggestExpressionInput,
  targetLanguage: string,
): ToolResult {
  return {
    title: `How to say this in ${targetLanguage}`,
    output: [
      `Your expression: "${input.sourceExpression}"`,
      `In ${targetLanguage}: "${input.targetExpression}"`,
      ...(input.notes ? [`Note: ${input.notes}`] : []),
    ].join("\n"),
    metadata: {
      vibeLingo: {
        status: "shown",
        targetLanguage,
      },
    },
  }
}

export async function suggestExpressionTool(
  input: SuggestExpressionInput,
  context: PluginInvocationContext,
  _services?: VibeLingoServices,
): Promise<ToolResult> {
  if (
    !input.sourceExpression.trim()
    || !input.targetExpression.trim()
    || codePoints(input.sourceExpression) > 500
    || codePoints(input.targetExpression) > 500
    || (input.notes !== undefined && codePoints(input.notes) > 200)
  ) {
    throw new Error("Expression text is empty or exceeds VibeLingo's privacy bounds.")
  }
  const settings = await readSettings(context)
  const profile = configuredProfile(settings)
  if (!profile || settings.correctionMode === "off") {
    throw new Error("VibeLingo coaching is not configured for this Scope.")
  }
  if (!settings.expressionSuggestionsEnabled) {
    throw new Error("Expression suggestions are disabled for this Scope.")
  }
  return result(input, profile.targetLanguage)
}

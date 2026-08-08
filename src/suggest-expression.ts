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

function stringField(
  input: Record<string, unknown>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = input[name]
    if (typeof value === "string") return value
  }
  return undefined
}

export const SUGGEST_EXPRESSION_MAX_CHARS = 2_000
export const SUGGEST_EXPRESSION_MAX_NOTE_CHARS = 500

function normalizeInput(raw: SuggestExpressionInput): {
  sourceExpression: string
  targetExpression: string
  notes?: string
} {
  const notes = stringField(raw, "notes", "Note", "note")
  return {
    sourceExpression: stringField(raw, "sourceExpression", "SourceExpression") ?? "",
    targetExpression: stringField(raw, "targetExpression", "TargetExpression") ?? "",
    ...(notes !== undefined ? { notes } : {}),
  }
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
  rawInput: SuggestExpressionInput,
  context: PluginInvocationContext,
  _services?: VibeLingoServices,
): Promise<ToolResult> {
  const input = normalizeInput(rawInput)
  if (
    !input.sourceExpression.trim()
    || !input.targetExpression.trim()
    || codePoints(input.sourceExpression) > SUGGEST_EXPRESSION_MAX_CHARS
    || codePoints(input.targetExpression) > SUGGEST_EXPRESSION_MAX_CHARS
    || (input.notes !== undefined && codePoints(input.notes) > SUGGEST_EXPRESSION_MAX_NOTE_CHARS)
  ) {
    throw new Error(
      `Expression text is empty or exceeds VibeLingo's privacy bounds (${SUGGEST_EXPRESSION_MAX_CHARS} characters).`,
    )
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

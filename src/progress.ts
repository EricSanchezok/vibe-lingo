import type { PluginInvocationContext, ToolResult } from "@ericsanchezok/synergy-plugin"
import { defaultStore, type VibeLingoStore } from "./storage"
import type { ProgressSnapshot } from "./types"

export type ProgressInput = {
  scope?: "all" | "current"
  limit?: number
  includeExamples?: boolean
}

function day(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function inlineFragment(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").replaceAll("`", "ˋ").trim()
}

export function renderProgress(snapshot: ProgressSnapshot, includeExamples: boolean): string {
  const lines = [
    "## VibeLingo English patterns",
    "",
    `- Analyzed messages: ${snapshot.analyzedMessages}`,
    `- Findings in the last 30 days: ${snapshot.findingsLast30Days}`,
  ]
  if (snapshot.patterns.length === 0) {
    lines.push("", "No stored English error patterns match this view yet.")
    return lines.join("\n")
  }

  lines.push("", "### Top patterns")
  snapshot.patterns.forEach((pattern, index) => {
    lines.push(
      "",
      `${index + 1}. **${pattern.label}** (\`${pattern.patternKey}\`)`,
      `   - ${pattern.rule}`,
      `   - ${pattern.occurrenceCount} occurrence(s) across ${pattern.sessionCount} session(s)`,
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
  store: VibeLingoStore = defaultStore(),
): Promise<ToolResult> {
  const scope = input.scope ?? "all"
  const limit = Math.max(1, Math.min(10, Math.trunc(input.limit ?? 5)))
  const includeExamples = input.includeExamples ?? false
  const snapshot = store.progress({
    scopeId: scope === "current" ? context.scopeId : undefined,
    limit,
    includeExamples,
  })
  return {
    title: "VibeLingo English patterns",
    output: renderProgress(snapshot, includeExamples),
    metadata: {
      scope,
      analyzedMessages: snapshot.analyzedMessages,
      findingsLast30Days: snapshot.findingsLast30Days,
      patternCount: snapshot.patterns.length,
    },
  }
}

import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js"
import type { PluginToolMessageSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"

type SurfaceInput =
  | PluginToolMessageSurfaceContext
  | { context: PluginToolMessageSurfaceContext }

type CorrectionPair = {
  originalFragment: string
  correctedFragment: string
}

type CorrectionInput = {
  restatement: string
  corrections: CorrectionPair[]
}

type CorrectionState =
  | "saving"
  | "not_saved"
  | "analyzing"
  | "recorded"
  | "pattern_updated"
  | "analysis_failed"

type CorrectionStatus = {
  found: boolean
  status?: "pending" | "queued" | "analyzed" | "recorded_only" | "failed"
  patternKeys: string[]
}

const styles = `
.vlc-card{box-sizing:border-box;width:min(680px,100%);margin:8px 0;border:1px solid color-mix(in srgb,var(--border-base) 72%,transparent);border-radius:12px;background:var(--surface-base);color:var(--text-base);font-family:var(--font-family-sans,system-ui,-apple-system,sans-serif);overflow:hidden}
.vlc-card *{box-sizing:border-box}
.vlc-body{padding:18px 20px 16px}
.vlc-title{margin:0;color:var(--text-strong);font-size:15px;line-height:1.35;font-weight:680}
.vlc-restatement{margin:12px 0 0;color:var(--text-base);font-size:14px;line-height:1.58;overflow-wrap:anywhere}
.vlc-label{display:block;margin-bottom:3px;color:var(--text-weaker);font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}
.vlc-list{display:grid;gap:10px;margin-top:14px}
.vlc-pair{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:8px;align-items:start;border-top:1px solid color-mix(in srgb,var(--border-base) 45%,transparent);padding-top:10px}
.vlc-fragment{min-width:0;color:var(--text-weak);font-size:13px;line-height:1.52;overflow-wrap:anywhere}
.vlc-fragment[data-natural=true]{color:var(--text-strong)}
.vlc-arrow{color:var(--text-weaker);font-size:13px;line-height:1.52;text-align:center}
.vlc-footer{display:flex;min-height:39px;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid color-mix(in srgb,var(--border-base) 48%,transparent);background:var(--surface-inset-base);padding:9px 20px;color:var(--text-weak);font-size:12px}
.vlc-state{display:flex;min-width:0;align-items:center;gap:8px}
.vlc-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--text-weaker)}
.vlc-dot[data-state=saving],.vlc-dot[data-state=analyzing]{background:var(--surface-warning-strong)}
.vlc-dot[data-state=recorded],.vlc-dot[data-state=pattern_updated]{background:var(--surface-success-strong)}
.vlc-dot[data-state=analysis_failed]{background:var(--surface-critical-base)}
.vlc-open{border:0;background:transparent;color:var(--text-interactive-base);padding:3px 0;font:inherit;font-weight:650;white-space:nowrap;cursor:pointer}
.vlc-open:hover{text-decoration:underline}
.vlc-open:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
@media(max-width:560px){.vlc-body{padding:16px}.vlc-footer{padding-inline:16px}.vlc-pair{grid-template-columns:1fr}.vlc-arrow{text-align:left}.vlc-arrow::after{content:"";}.vlc-arrow{height:12px}}
`

function resolveContext(input: SurfaceInput): PluginToolMessageSurfaceContext {
  return "context" in input ? input.context : input
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseInput(value: Record<string, unknown>): CorrectionInput {
  const corrections = Array.isArray(value.corrections)
    ? value.corrections.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const originalFragment = text((item as Record<string, unknown>).originalFragment)
        const correctedFragment = text((item as Record<string, unknown>).correctedFragment)
        return originalFragment && correctedFragment
          ? [{ originalFragment, correctedFragment }]
          : []
      }).slice(0, 2)
    : []
  return {
    restatement: text(value.restatement),
    corrections,
  }
}

function pluginMetadata(context: PluginToolMessageSurfaceContext): Record<string, unknown> {
  const value = context.tool.metadata?.vibeLingo
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function stateFromStatus(
  context: PluginToolMessageSurfaceContext,
  status?: CorrectionStatus,
): CorrectionState {
  const metadata = pluginMetadata(context)
  if (metadata.status === "not_saved") return "not_saved"
  if (metadata.status === "conflict" || context.tool.status === "error") return "analysis_failed"
  if (!metadata.batchId) return "saving"
  if (!status) return metadata.status === "analyzing" ? "analyzing" : "saving"
  if (status.status === "failed") return "analysis_failed"
  if (status.status === "analyzed" && status.patternKeys.length > 0) return "pattern_updated"
  if (status.status === "analyzed" || status.status === "recorded_only") return "recorded"
  return "analyzing"
}

const CorrectionCard: Component<SurfaceInput> = (props) => {
  const context = resolveContext(props)
  const input = parseInput(context.tool.input)
  const isChinese = (() => {
    try {
      return document.documentElement.lang.toLowerCase().startsWith("zh")
    } catch {
      return false
    }
  })()
  const metadata = pluginMetadata(context)
  const batchId = typeof metadata.batchId === "string" ? metadata.batchId : undefined
  const [status, setStatus] = createSignal<CorrectionStatus>()
  const [loading, setLoading] = createSignal(false)
  const state = createMemo(() => stateFromStatus(context, status()))
  const patternKey = createMemo(() => status()?.patternKeys[0])

  const stateText = createMemo(() => {
    const labels: Record<CorrectionState, [string, string]> = {
      saving: ["正在保存纠正…", "Saving correction…"],
      not_saved: ["未加入学习记录（学习追踪已关闭）", "Not added to learning history (tracking is off)"],
      analyzing: ["正在整理学习记录…", "Organizing your learning record…"],
      recorded: ["纠正已记录", "Correction recorded"],
      pattern_updated: ["学习模式已更新", "Learning pattern updated"],
      analysis_failed: ["纠正仍可见，但学习记录整理失败", "The correction remains visible, but learning analysis failed"],
    }
    return labels[state()][isChinese ? 0 : 1]
  })

  async function refresh() {
    if (!batchId || loading()) return
    setLoading(true)
    try {
      setStatus(await context.operations.query<CorrectionStatus>(
        "correction-status",
        { batchId },
      ))
    } catch {
      // The visible correction remains useful when status refresh is unavailable.
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void refresh()
    const unsubscribe = context.events.subscribe("learning.changed", () => void refresh())
    onCleanup(unsubscribe)
  })

  function openPattern() {
    const key = patternKey()
    if (key) context.host.openPluginPage("learning", { view: "pattern", pattern: key })
  }

  return (
    <article class="vlc-card" aria-label={isChinese ? "VibeLingo 纠正" : "VibeLingo correction"}>
      <style>{styles}</style>
      <div class="vlc-body">
        <h3 class="vlc-title">{isChinese ? "更自然的表达" : "A more natural expression"}</h3>
        <Show when={input.restatement}>
          <p class="vlc-restatement">
            <span class="vlc-label">Got it</span>
            “{input.restatement}”
          </p>
        </Show>
        <div class="vlc-list">
          <For each={input.corrections}>
            {(correction) => (
              <div class="vlc-pair">
                <div class="vlc-fragment">“{correction.originalFragment}”</div>
                <div class="vlc-arrow" aria-hidden="true">→</div>
                <div class="vlc-fragment" data-natural="true">“{correction.correctedFragment}”</div>
              </div>
            )}
          </For>
        </div>
      </div>
      <footer class="vlc-footer" aria-live="polite">
        <span class="vlc-state">
          <span class="vlc-dot" data-state={state()} aria-hidden="true" />
          <span>{stateText()}</span>
        </span>
        <Show when={state() === "pattern_updated" && patternKey()}>
          <button class="vlc-open" type="button" onClick={openPattern}>
            {isChinese ? "查看学习模式" : "View learning pattern"}
          </button>
        </Show>
      </footer>
    </article>
  )
}

export default CorrectionCard

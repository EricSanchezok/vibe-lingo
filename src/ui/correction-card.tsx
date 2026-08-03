import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  untrack,
  onCleanup,
  onMount,
  type Component,
} from "solid-js"
import type { PluginToolMessageSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import { learningThemeDeclarations } from "./learning-theme"

type SurfaceInput = PluginToolMessageSurfaceContext | { context: PluginToolMessageSurfaceContext }

type CorrectionPair = {
  kind: "correction" | "naturalness"
  originalFragment: string
  correctedFragment: string
  explanation?: string
}

type CorrectionInput = {
  restatement: string
  corrections: CorrectionPair[]
}

type CorrectionState =
  | "saving"
  | "not_saved"
  | "analyzing"
  | "analysis_interrupted"
  | "retry_unavailable"
  | "status_unavailable"
  | "recorded"
  | "pattern_updated"
  | "analysis_failed"

type CorrectionStatus = {
  found: boolean
  status?: "pending" | "queued" | "analyzed" | "recorded_only" | "failed"
  patternKeys: string[]
  recovery: "none" | "waiting" | "retry_available" | "retry_unavailable"
  retryAt?: number
}

const styles = `
.vlc-card{${learningThemeDeclarations}box-sizing:border-box;width:min(680px,100%);min-width:0;margin:8px 0;border:1px solid var(--vibe-warm-border);border-radius:12px;background:color-mix(in srgb,var(--surface-base) 96%,var(--vibe-sage-surface));color:var(--text-base);font-family:var(--font-family-sans,system-ui,-apple-system,sans-serif);overflow:hidden;container-name:vlc-card;container-type:inline-size}
.vlc-card *{box-sizing:border-box}
.vlc-body{padding:18px 20px 16px}
.vlc-title{margin:0;color:var(--text-strong);font-size:15px;line-height:1.35;font-weight:680}
.vlc-restatement{margin:12px 0 0;color:var(--text-base);font-size:14px;line-height:1.58;overflow-wrap:anywhere}
.vlc-label{display:block;margin-bottom:3px;color:var(--vibe-sage-ink);font-size:11px;font-weight:680;letter-spacing:.055em;text-transform:uppercase}
.vlc-list{display:grid;gap:10px;margin-top:14px}
.vlc-pair{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:8px;align-items:start;border-top:1px solid color-mix(in srgb,var(--border-base) 45%,transparent);padding-top:10px}
.vlc-kind{display:inline-flex;grid-column:1/-1;justify-self:start;align-items:center;min-height:20px;margin:0;border:1px solid color-mix(in srgb,var(--vibe-warm-border) 72%,transparent);border-radius:999px;color:var(--vibe-sage-ink);padding:1px 7px;font-size:10px;font-weight:680;letter-spacing:.045em;text-transform:uppercase}
.vlc-source,.vlc-target{min-width:0}
.vlc-fragment{min-width:0;color:var(--text-weak);font-size:13px;line-height:1.52;overflow-wrap:anywhere}
.vlc-fragment[data-natural=true]{border-radius:7px;background:var(--vibe-sage-surface);color:var(--text-strong);padding:5px 8px;margin:-5px 0}
.vlc-explanation{margin:9px 0 0;color:var(--text-weak);font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.vlc-arrow{color:var(--text-weaker);font-size:13px;line-height:1.52;text-align:center}
.vlc-expand{margin:12px 0 0;border:0;background:transparent;color:var(--vibe-sage-ink);padding:3px 0;font:inherit;font-size:12px;font-weight:680;cursor:pointer}
.vlc-expand:hover{text-decoration:underline}
.vlc-expand:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.vlc-footer{display:flex;min-height:39px;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 76%,transparent);background:var(--vibe-sage-surface);padding:9px 20px;color:var(--text-weak);font-size:12px}
.vlc-state{display:flex;min-width:0;align-items:center;gap:8px}
.vlc-state>span:last-child{min-width:0;overflow-wrap:anywhere}
.vlc-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--text-weaker)}
.vlc-dot[data-state=saving],.vlc-dot[data-state=analyzing],.vlc-dot[data-state=analysis_interrupted],.vlc-dot[data-state=status_unavailable]{background:var(--vibe-amber-strong)}
.vlc-dot[data-state=recorded],.vlc-dot[data-state=pattern_updated]{background:var(--vibe-sage-strong)}
.vlc-dot[data-state=analysis_failed]{background:var(--surface-critical-base)}
.vlc-actions{display:flex;flex:0 0 auto;align-items:center;gap:12px}
.vlc-action{border:0;background:transparent;color:var(--vibe-sage-ink);padding:3px 0;font:inherit;font-weight:680;white-space:nowrap;cursor:pointer}
.vlc-action:hover:not(:disabled){text-decoration:underline}
.vlc-action:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.vlc-action:disabled{cursor:default;opacity:.62}
@container vlc-card (max-width:560px){.vlc-body{padding:16px}.vlc-footer{padding-inline:16px}.vlc-pair{grid-template-columns:18px minmax(0,1fr);column-gap:8px;row-gap:8px}.vlc-kind,.vlc-source{grid-column:1/-1}.vlc-arrow{grid-column:1}.vlc-target{grid-column:2}}
@container vlc-card (max-width:360px){.vlc-body{padding:14px}.vlc-footer{align-items:flex-start;flex-direction:column;gap:6px;padding:9px 14px}.vlc-actions{align-self:stretch;justify-content:flex-start}.vlc-action{white-space:normal;text-align:left}}
`

function resolveContext(input: SurfaceInput): PluginToolMessageSurfaceContext {
  return "context" in input ? input.context : input
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseInput(value: Record<string, unknown>): CorrectionInput {
  const corrections = Array.isArray(value.corrections)
    ? value.corrections
        .flatMap((item) => {
          if (!item || typeof item !== "object") return []
          const originalFragment = text((item as Record<string, unknown>).originalFragment)
          const correctedFragment = text((item as Record<string, unknown>).correctedFragment)
          const kind = (item as Record<string, unknown>).kind === "naturalness"
            ? "naturalness" as const
            : "correction" as const
          const explanation = text((item as Record<string, unknown>).explanation)
          return originalFragment && correctedFragment
            ? [{
                kind,
                originalFragment,
                correctedFragment,
                ...(kind === "naturalness" && explanation ? { explanation } : {}),
              }]
            : []
        })
        .slice(0, 8)
    : []
  return {
    restatement: text(value.restatement),
    corrections,
  }
}

function pluginMetadata(context: PluginToolMessageSurfaceContext): Record<string, unknown> {
  const value = context.tool.metadata?.vibeLingo
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function stateFromStatus(
  context: PluginToolMessageSurfaceContext,
  status: CorrectionStatus | undefined,
  queryFailed: boolean,
): CorrectionState {
  const metadata = pluginMetadata(context)
  if (metadata.status === "not_saved") return "not_saved"
  if (metadata.status === "conflict" || context.tool.status === "error") return "analysis_failed"
  if (!metadata.batchId) return "saving"
  if (queryFailed) return "status_unavailable"
  if (!status) return metadata.status === "analyzing" ? "analyzing" : "saving"
  if (!status.found) return "status_unavailable"
  if (status.status === "analyzed" && status.patternKeys.length > 0) return "pattern_updated"
  if (status.status === "analyzed" || status.status === "recorded_only") return "recorded"
  if (status.recovery === "waiting") return "analyzing"
  if (status.recovery === "retry_available") return "analysis_interrupted"
  if (status.recovery === "retry_unavailable") return "retry_unavailable"
  if (status.status === "failed") return "analysis_failed"
  return "status_unavailable"
}

const CorrectionCard: Component<SurfaceInput> = (props) => {
  const context = resolveContext(props)
  const input = createMemo(() => parseInput(context.tool.input))
  const isChinese = (() => {
    try {
      return document.documentElement.lang.toLowerCase().startsWith("zh")
    } catch {
      return false
    }
  })()
  const batchId = createMemo(() => {
    const value = pluginMetadata(context).batchId
    return typeof value === "string" ? value : undefined
  })
  const [status, setStatus] = createSignal<CorrectionStatus>()
  const [queryFailed, setQueryFailed] = createSignal(false)
  const [checking, setChecking] = createSignal(false)
  const [retrying, setRetrying] = createSignal(false)
  const [expanded, setExpanded] = createSignal(false)
  const correctionListId = `vlc-list-${context.message.id}`
  let refreshId = 0
  let boundaryTimer: ReturnType<typeof setTimeout> | undefined
  const state = createMemo(() => stateFromStatus(context, status(), queryFailed()))
  const patternKey = createMemo(() => status()?.patternKeys[0])
  const visibleCorrections = createMemo(() =>
    expanded() ? input().corrections : input().corrections.slice(0, 3))
  const hiddenCorrectionCount = createMemo(() => Math.max(0, input().corrections.length - 3))
  const cardTitle = createMemo(() => {
    const kinds = new Set(input().corrections.map((item) => item.kind))
    if (kinds.size === 1 && kinds.has("naturalness")) {
      return isChinese ? "更自然的表达" : "A more natural expression"
    }
    if (kinds.size === 1 && kinds.has("correction")) {
      return isChinese ? "需要调整的表达" : "Wording to adjust"
    }
    return isChinese ? "表达建议" : "Language feedback"
  })

  const stateText = createMemo(() => {
    const labels: Record<CorrectionState, [string, string]> = {
      saving: ["正在保存语言反馈…", "Saving language feedback…"],
      not_saved: ["未加入学习记录（学习追踪已关闭）", "Not added to learning history (tracking is off)"],
      analyzing: ["正在整理学习记录…", "Organizing your learning record…"],
      analysis_interrupted: [
        "学习记录整理已中断，语言反馈已保存",
        "Learning analysis was interrupted; the language feedback is saved",
      ],
      retry_unavailable: [
        "语言反馈已保存，但当前无法重新整理学习记录",
        "The language feedback is saved, but learning analysis cannot be retried now",
      ],
      status_unavailable: [
        "语言反馈仍可见，暂时无法检查学习记录状态",
        "The language feedback remains visible, but its learning status is temporarily unavailable",
      ],
      recorded: ["语言反馈已记录", "Language feedback recorded"],
      pattern_updated: ["学习模式已更新", "Learning pattern updated"],
      analysis_failed: ["语言反馈已保存，但学习记录整理失败", "The language feedback is saved, but learning analysis failed"],
    }
    return labels[state()][isChinese ? 0 : 1]
  })

  function clearBoundaryTimer() {
    if (boundaryTimer === undefined) return
    clearTimeout(boundaryTimer)
    boundaryTimer = undefined
  }

  async function refresh() {
    const currentBatchId = batchId()
    if (!currentBatchId || retrying()) return
    const currentRefreshId = ++refreshId
    setChecking(true)
    try {
      const next = await context.operations.query<CorrectionStatus>("correction-status", { batchId: currentBatchId })
      if (currentRefreshId !== refreshId || currentBatchId !== batchId()) return
      setStatus(next)
      setQueryFailed(false)
    } catch {
      if (currentRefreshId === refreshId && currentBatchId === batchId()) setQueryFailed(true)
    } finally {
      if (currentRefreshId === refreshId) setChecking(false)
    }
  }

  async function retryAnalysis() {
    const currentBatchId = batchId()
    if (!currentBatchId || retrying()) return
    const currentRefreshId = ++refreshId
    setRetrying(true)
    setQueryFailed(false)
    try {
      const next = await context.operations.command<CorrectionStatus>("correction-retry", { batchId: currentBatchId })
      if (currentRefreshId === refreshId && currentBatchId === batchId()) setStatus(next)
    } catch {
      if (currentRefreshId === refreshId && currentBatchId === batchId()) setQueryFailed(true)
    } finally {
      if (currentRefreshId === refreshId) setRetrying(false)
    }
  }

  createEffect(() => {
    input().corrections.length
    setExpanded(false)
  })

  createEffect(() => {
    const currentBatchId = batchId()
    refreshId++
    clearBoundaryTimer()
    setStatus()
    setQueryFailed(false)
    setChecking(false)
    setRetrying(false)
    if (currentBatchId) untrack(() => void refresh())
  })

  createEffect(() => {
    clearBoundaryTimer()
    const current = status()
    if (current?.recovery !== "waiting" || current.retryAt === undefined) return
    const delay = Math.max(0, current.retryAt - Date.now())
    boundaryTimer = setTimeout(() => {
      boundaryTimer = undefined
      void refresh()
    }, delay + 1)
  })

  onMount(() => {
    const unsubscribe = context.events.subscribe("learning.changed", () => void refresh())
    onCleanup(unsubscribe)
  })
  onCleanup(() => {
    refreshId++
    clearBoundaryTimer()
  })

  function openPattern() {
    const key = patternKey()
    if (key)
      context.host.openPluginPage("learning", {
        view: "pattern",
        pattern: key,
      })
  }

  return (
    <article class="vlc-card" aria-label={isChinese ? "VibeLingo 语言反馈" : "VibeLingo language feedback"}>
      <style>{styles}</style>
      <div class="vlc-body">
        <h3 class="vlc-title">{cardTitle()}</h3>
        <Show when={input().restatement}>
          <p class="vlc-restatement">
            <span class="vlc-label">Got it</span>“{input().restatement}”
          </p>
        </Show>
        <div class="vlc-list" id={correctionListId}>
          <For each={visibleCorrections()}>
            {(correction) => (
              <div class="vlc-pair">
                <span class="vlc-kind">
                  {correction.kind === "naturalness"
                    ? isChinese ? "更自然" : "More natural"
                    : isChinese ? "纠正" : "Correction"}
                </span>
                <div class="vlc-source">
                  <div class="vlc-fragment">“{correction.originalFragment}”</div>
                </div>
                <div class="vlc-arrow" aria-hidden="true">
                  →
                </div>
                <div class="vlc-target">
                  <div class="vlc-fragment" data-natural="true">
                    “{correction.correctedFragment}”
                  </div>
                  <Show when={correction.explanation}>
                    <p class="vlc-explanation">{correction.explanation}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
        <Show when={hiddenCorrectionCount() > 0}>
          <button
            class="vlc-expand"
            type="button"
            aria-expanded={expanded()}
            aria-controls={correctionListId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded()
              ? isChinese ? "收起" : "Show less"
              : isChinese ? `查看其余 ${hiddenCorrectionCount()} 条` : `Show ${hiddenCorrectionCount()} more`}
          </button>
        </Show>
      </div>
      <footer class="vlc-footer" aria-live="polite">
        <span class="vlc-state">
          <span class="vlc-dot" data-state={state()} aria-hidden="true" />
          <span>{stateText()}</span>
        </span>
        <div class="vlc-actions">
          <Show when={state() === "analysis_interrupted"}>
            <button
              class="vlc-action"
              type="button"
              disabled={retrying()}
              aria-busy={retrying()}
              onClick={retryAnalysis}
            >
              {retrying() ? (isChinese ? "正在重试…" : "Retrying…") : isChinese ? "重试整理" : "Retry analysis"}
            </button>
          </Show>
          <Show when={state() === "status_unavailable"}>
            <button class="vlc-action" type="button" disabled={checking()} aria-busy={checking()} onClick={refresh}>
              {checking() ? (isChinese ? "正在检查…" : "Checking…") : isChinese ? "重新检查" : "Check again"}
            </button>
          </Show>
          <Show when={state() === "pattern_updated" && patternKey()}>
            <button class="vlc-action" type="button" onClick={openPattern}>
              {isChinese ? "查看学习模式" : "View learning pattern"}
            </button>
          </Show>
        </div>
      </footer>
    </article>
  )
}

export default CorrectionCard

import { For, Match, Show, Switch, createMemo, type Component } from "solid-js"
import type { PluginToolMessageSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import type { ProgressCardMetadata, ProgressCardPattern } from "../progress"
import { learningThemeDeclarations } from "./learning-theme"

type SurfaceInput = PluginToolMessageSurfaceContext | { context: PluginToolMessageSurfaceContext }

const styles = `
.vlp-card{${learningThemeDeclarations}box-sizing:border-box;width:min(760px,100%);margin:8px 0;border:1px solid var(--vibe-warm-border);border-radius:13px;background:color-mix(in srgb,var(--surface-base) 97%,var(--vibe-sage-surface));color:var(--text-base);font-family:var(--font-family-sans,system-ui,-apple-system,sans-serif);overflow:hidden}
.vlp-card *{box-sizing:border-box}
.vlp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px 16px}
.vlp-kicker{margin:0 0 4px;color:var(--vibe-sage-ink);font-size:11px;font-weight:720;letter-spacing:.075em;text-transform:uppercase}
.vlp-title{margin:0;color:var(--text-strong);font-size:18px;line-height:1.35;font-weight:700;letter-spacing:-.015em}
.vlp-subtitle{margin:5px 0 0;color:var(--text-weak);font-size:12px;line-height:1.5}
.vlp-language{flex:0 0 auto;border-radius:999px;background:var(--vibe-sage-surface);color:var(--vibe-sage-ink);padding:5px 10px;font-size:11px;font-weight:650}
.vlp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 22px;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 70%,transparent);border-bottom:1px solid color-mix(in srgb,var(--vibe-warm-border) 70%,transparent)}
.vlp-stat{min-width:0;padding:15px 12px}
.vlp-stat:first-child{padding-left:0}.vlp-stat:last-child{padding-right:0}
.vlp-stat+.vlp-stat{border-left:1px solid color-mix(in srgb,var(--vibe-warm-border) 62%,transparent)}
.vlp-value{display:block;color:var(--text-strong);font-size:22px;line-height:1.2;font-weight:710;font-variant-numeric:tabular-nums}
.vlp-label{display:block;margin-top:4px;color:var(--text-weak);font-size:11px;line-height:1.4}
.vlp-note{display:flex;align-items:center;gap:8px;margin:14px 22px 0;border-radius:8px;background:var(--vibe-amber-surface);color:var(--vibe-amber-ink);padding:9px 11px;font-size:12px}
.vlp-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--vibe-amber-strong)}
.vlp-section{padding:18px 22px 20px}
.vlp-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}
.vlp-section-title{margin:0;color:var(--text-strong);font-size:13px;font-weight:680}
.vlp-stage-summary{color:var(--text-weaker);font-size:11px}
.vlp-patterns{display:grid;gap:1px;margin:0;padding:0;list-style:none}
.vlp-pattern{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;border:0;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 58%,transparent);background:transparent;color:inherit;padding:12px 0;text-align:left;cursor:pointer}
.vlp-patterns li:first-child .vlp-pattern{border-top:0}
.vlp-pattern:hover .vlp-pattern-title{color:var(--vibe-sage-ink)}
.vlp-pattern:focus-visible,.vlp-action:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.vlp-pattern-title{display:block;color:var(--text-strong);font-size:13px;font-weight:650;overflow-wrap:anywhere}
.vlp-pattern-rule{display:block;margin-top:3px;color:var(--text-weak);font-size:11px;line-height:1.45;overflow-wrap:anywhere}
.vlp-pattern-meta{display:flex;align-items:center;gap:7px;color:var(--text-weaker);font-size:11px;white-space:nowrap}
.vlp-status{display:inline-flex;border-radius:999px;background:var(--vibe-sage-surface);color:var(--vibe-sage-ink);padding:3px 7px;font-weight:650}
.vlp-status[data-stage=candidate]{background:var(--vibe-amber-surface);color:var(--vibe-amber-ink)}
.vlp-empty{border-radius:9px;background:var(--vibe-sage-surface);padding:14px;color:var(--text-weak);font-size:12px;line-height:1.55}
.vlp-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 70%,transparent);background:var(--vibe-sage-surface);padding:11px 22px;color:var(--text-weak);font-size:11px}
.vlp-action{border:0;background:transparent;color:var(--vibe-sage-ink);padding:3px 0;font:inherit;font-weight:680;cursor:pointer;white-space:nowrap}
.vlp-action:hover{text-decoration:underline}
.vlp-state{padding:24px 22px}
.vlp-state-title{margin:0;color:var(--text-strong);font-size:16px;font-weight:680}
.vlp-state-copy{margin:6px 0 0;color:var(--text-weak);font-size:13px;line-height:1.55}
.vlp-skeleton{display:grid;gap:10px;margin-top:18px}
.vlp-skeleton-line{height:12px;border-radius:6px;background:var(--vibe-sage-surface);animation:vlp-pulse 1.3s ease-in-out infinite alternate}
.vlp-skeleton-line:nth-child(2){width:78%}.vlp-skeleton-line:nth-child(3){width:56%}
@keyframes vlp-pulse{from{opacity:.52}to{opacity:1}}
@media(max-width:560px){.vlp-head{padding:17px 16px 14px}.vlp-stats{grid-template-columns:repeat(2,1fr);margin-inline:16px}.vlp-stat:nth-child(3){border-left:0;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 62%,transparent)}.vlp-stat:nth-child(4){border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 62%,transparent)}.vlp-section{padding-inline:16px}.vlp-note{margin-inline:16px}.vlp-footer{align-items:flex-start;padding-inline:16px}.vlp-pattern{grid-template-columns:1fr}.vlp-pattern-meta{white-space:normal}}
@media(prefers-reduced-motion:reduce){.vlp-skeleton-line{animation:none;opacity:.72}}
`

function resolveContext(input: SurfaceInput): PluginToolMessageSurfaceContext {
  return "context" in input ? input.context : input
}

function metadata(context: PluginToolMessageSurfaceContext): ProgressCardMetadata | undefined {
  const value = context.tool.metadata?.vibeLingo
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Partial<ProgressCardMetadata>
  return candidate.kind === "progress" ? (candidate as ProgressCardMetadata) : undefined
}

function stageText(stage: ProgressCardPattern["stage"], chinese: boolean): string {
  const labels = {
    candidate: ["新发现", "New"],
    practicing: ["练习中", "Practicing"],
    verified: ["已验证", "Verified"],
  } as const
  return labels[stage][chinese ? 0 : 1]
}

const ProgressCard: Component<SurfaceInput> = (props) => {
  const context = resolveContext(props)
  const isChinese = (() => {
    try {
      return document.documentElement.lang.toLowerCase().startsWith("zh")
    } catch {
      return false
    }
  })()
  const data = createMemo(() => metadata(context))
  const ready = createMemo(() => {
    const value = data()
    return value?.state === "ready" ? value : undefined
  })
  const loading = createMemo(() => context.tool.status === "running" || (!data() && !context.tool.output))

  function openDashboard() {
    context.host.openPluginPage("learning", { view: "overview" })
  }

  function openPattern(patternKey: string) {
    context.host.openPluginPage("learning", { view: "pattern", pattern: patternKey })
  }

  return (
    <article class="vlp-card" aria-label={isChinese ? "VibeLingo 学习进展" : "VibeLingo learning progress"}>
      <style>{styles}</style>
      <Switch>
        <Match when={loading()}>
          <div class="vlp-state" aria-busy="true" aria-live="polite">
            <p class="vlp-kicker">VibeLingo</p>
            <h3 class="vlp-state-title">{isChinese ? "正在整理学习进展…" : "Gathering your learning progress…"}</h3>
            <div class="vlp-skeleton" aria-hidden="true">
              <span class="vlp-skeleton-line" />
              <span class="vlp-skeleton-line" />
              <span class="vlp-skeleton-line" />
            </div>
          </div>
        </Match>
        <Match when={data()?.state === "setup_required"}>
          <div class="vlp-state">
            <p class="vlp-kicker">VibeLingo</p>
            <h3 class="vlp-state-title">{isChinese ? "先完成语言设置" : "Set up your language profile"}</h3>
            <p class="vlp-state-copy">
              {isChinese ? "选择你最熟悉的语言和正在学习的语言后，VibeLingo 才能整理学习进展。" : "Choose your support and target languages before VibeLingo can organize your progress."}
            </p>
            <button class="vlp-action" type="button" onClick={() => context.host.openPluginPage("learning", { view: "settings" })}>
              {isChinese ? "打开设置 →" : "Open settings →"}
            </button>
          </div>
        </Match>
        <Match when={data()?.state === "invalid_language"}>
          <div class="vlp-state">
            <p class="vlp-kicker">VibeLingo</p>
            <h3 class="vlp-state-title">{isChinese ? "无法识别目标语言" : "Target language not recognized"}</h3>
            <p class="vlp-state-copy">{isChinese ? "请检查语言设置后再试一次。" : "Check your language settings and try again."}</p>
          </div>
        </Match>
        <Match when={ready()}>
          {(resolved) => (
            <>
              <header class="vlp-head">
                <div>
                  <p class="vlp-kicker">VibeLingo</p>
                  <h3 class="vlp-title">{isChinese ? "你的学习进展" : "Your learning progress"}</h3>
                  <p class="vlp-subtitle">
                    {isChinese
                      ? `第 ${resolved().summary.learningWeek} 周 · 来自真实工作表达的学习记录`
                      : `Week ${resolved().summary.learningWeek} · Evidence from real work`}
                  </p>
                </div>
                <span class="vlp-language">{resolved().targetName}</span>
              </header>
              <div class="vlp-stats">
                <div class="vlp-stat">
                  <strong class="vlp-value">{resolved().summary.targetAttemptsToday}</strong>
                  <span class="vlp-label">{isChinese ? "今日表达" : "Today"}</span>
                </div>
                <div class="vlp-stat">
                  <strong class="vlp-value">{resolved().summary.activeDays}</strong>
                  <span class="vlp-label">{isChinese ? "活跃天数" : "Active days"}</span>
                </div>
                <div class="vlp-stat">
                  <strong class="vlp-value">{resolved().summary.duePatternCount}</strong>
                  <span class="vlp-label">{isChinese ? "待复习" : "Due for review"}</span>
                </div>
                <div class="vlp-stat">
                  <strong class="vlp-value">{resolved().summary.verifiedPatternCount}</strong>
                  <span class="vlp-label">{isChinese ? "已验证模式" : "Verified"}</span>
                </div>
              </div>
              <Show when={resolved().summary.correctionsAnalyzing > 0}>
                <div class="vlp-note" role="status">
                  <span class="vlp-dot" aria-hidden="true" />
                  <span>
                    {isChinese
                      ? `${resolved().summary.correctionsAnalyzing} 条纠正正在整理为学习记录`
                      : `${resolved().summary.correctionsAnalyzing} correction(s) are being organized`}
                  </span>
                </div>
              </Show>
              <section class="vlp-section">
                <div class="vlp-section-head">
                  <h4 class="vlp-section-title">{isChinese ? "主要学习模式" : "Learning patterns"}</h4>
                  <span class="vlp-stage-summary">
                    {isChinese
                      ? `${resolved().summary.candidatePatternCount} 个新发现 · ${resolved().summary.practicingPatternCount} 个练习中`
                      : `${resolved().summary.candidatePatternCount} new · ${resolved().summary.practicingPatternCount} practicing`}
                  </span>
                </div>
                <Show
                  when={resolved().patterns.length > 0}
                  fallback={
                    <div class="vlp-empty">
                      {isChinese
                        ? `今天已经完成 ${resolved().summary.targetAttemptsToday} 次目标语言表达，暂时还没有足够可信的学习模式。`
                        : `You practiced ${resolved().summary.targetAttemptsToday} time(s) today. There are no reliable learning patterns yet.`}
                    </div>
                  }
                >
                  <ul class="vlp-patterns">
                    <For each={resolved().patterns.slice(0, 3)}>
                      {(pattern) => (
                        <li>
                          <button class="vlp-pattern" type="button" onClick={() => openPattern(pattern.patternKey)}>
                            <span>
                              <span class="vlp-pattern-title">{pattern.label}</span>
                              <span class="vlp-pattern-rule">{pattern.rule}</span>
                            </span>
                            <span class="vlp-pattern-meta">
                              <span class="vlp-status" data-stage={pattern.stage}>{stageText(pattern.stage, isChinese)}</span>
                              <span>{isChinese ? `${pattern.occurrenceCount} 次` : `${pattern.occurrenceCount}×`}</span>
                            </span>
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </section>
              <footer class="vlp-footer">
                <span>
                  {isChinese
                    ? `今天 ${resolved().summary.targetSessionsToday} 个真实会话 · ${resolved().summary.correctionsToday} 次可见纠正`
                    : `${resolved().summary.targetSessionsToday} real session(s) today · ${resolved().summary.correctionsToday} visible correction(s)`}
                </span>
                <button class="vlp-action" type="button" onClick={openDashboard}>
                  {isChinese ? "查看完整进展 →" : "View full progress →"}
                </button>
              </footer>
            </>
          )}
        </Match>
        <Match when={true}>
          <div class="vlp-state">
            <p class="vlp-kicker">VibeLingo</p>
            <h3 class="vlp-state-title">{isChinese ? "暂时无法显示学习进展" : "Progress is temporarily unavailable"}</h3>
            <p class="vlp-state-copy">{isChinese ? "你的学习记录没有受到影响，可以稍后再试。" : "Your learning history is unaffected. Try again later."}</p>
          </div>
        </Match>
      </Switch>
    </article>
  )
}

export default ProgressCard

import { Show, createMemo, type Component } from "solid-js"
import type { PluginToolMessageSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import { languageDisplayName } from "../language"
import { learningThemeDeclarations } from "./learning-theme"

type SurfaceInput = PluginToolMessageSurfaceContext | { context: PluginToolMessageSurfaceContext }

type ExpressionInput = {
  sourceExpression: string
  targetExpression: string
  notes?: string
}

const styles = `
.vlc-card{${learningThemeDeclarations}box-sizing:border-box;width:min(680px,100%);min-width:0;margin:8px 0;border:1px solid var(--vibe-warm-border);border-radius:12px;background:color-mix(in srgb,var(--surface-base) 96%,var(--vibe-sage-surface));color:var(--text-base);font-family:var(--font-family-sans,system-ui,-apple-system,sans-serif);overflow:hidden;container-name:vlc-card;container-type:inline-size}
.vlc-card *{box-sizing:border-box}
.vlc-body{padding:18px 20px 16px}
.vlc-title{margin:0;color:var(--text-strong);font-size:15px;line-height:1.35;font-weight:680}
.vlc-pair{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:8px;align-items:start;border-top:1px solid color-mix(in srgb,var(--border-base) 45%,transparent);padding-top:10px;margin-top:12px}
.vlc-kind{display:inline-flex;grid-column:1/-1;justify-self:start;align-items:center;min-height:20px;margin:0;border:1px solid color-mix(in srgb,var(--vibe-warm-border) 72%,transparent);border-radius:999px;color:var(--vibe-sage-ink);padding:1px 7px;font-size:10px;font-weight:680;letter-spacing:.045em;text-transform:uppercase}
.vlc-source,.vlc-target{min-width:0}
.vlc-fragment{min-width:0;color:var(--text-weak);font-size:13px;line-height:1.52;overflow-wrap:anywhere}
.vlc-fragment[data-natural=true]{border-radius:7px;background:var(--vibe-sage-surface);color:var(--text-strong);padding:5px 8px;margin:-5px 0}
.vlc-arrow{color:var(--text-weaker);font-size:13px;line-height:1.52;text-align:center}
.vlc-explanation{margin:9px 0 0;color:var(--text-weak);font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.vlc-footer{display:flex;min-height:39px;align-items:center;gap:12px;border-top:1px solid color-mix(in srgb,var(--vibe-warm-border) 76%,transparent);background:var(--vibe-sage-surface);padding:9px 20px;color:var(--text-weak);font-size:12px;font-weight:680}
@container vlc-card (max-width:560px){.vlc-body{padding:16px}.vlc-footer{padding-inline:16px}.vlc-pair{grid-template-columns:18px minmax(0,1fr);column-gap:8px;row-gap:8px}.vlc-kind,.vlc-source{grid-column:1/-1}.vlc-arrow{grid-column:1}.vlc-target{grid-column:2}}
@container vlc-card (max-width:360px){.vlc-body{padding:14px}.vlc-footer{align-items:flex-start;flex-direction:column;gap:6px;padding:9px 14px}}
`

function resolveContext(input: SurfaceInput): PluginToolMessageSurfaceContext {
  return "context" in input ? input.context : input
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseInput(value: Record<string, unknown>): ExpressionInput {
  const notes = text(value.notes)
  return {
    sourceExpression: text(value.sourceExpression),
    targetExpression: text(value.targetExpression),
    ...(notes ? { notes } : {}),
  }
}

function pluginMetadata(context: PluginToolMessageSurfaceContext): Record<string, unknown> {
  const value = context.tool.metadata?.vibeLingo
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

const ExpressionCard: Component<SurfaceInput> = (props) => {
  const context = resolveContext(props)
  const input = createMemo(() => parseInput(context.tool.input))
  const isChinese = (() => {
    try {
      return document.documentElement.lang.toLowerCase().startsWith("zh")
    } catch {
      return false
    }
  })()
  const targetLanguage = createMemo(() => {
    const tag = pluginMetadata(context).targetLanguage
    if (typeof tag === "string" && tag) {
      return languageDisplayName(tag, isChinese ? "zh-CN" : "en")
    }
    return isChinese ? "目标语言" : "the target language"
  })

  return (
    <article
      class="vlc-card"
      aria-label={isChinese ? "VibeLingo 目标语言说法" : "VibeLingo target-language example"}
    >
      <style>{styles}</style>
      <div class="vlc-body">
        <h3 class="vlc-title">
          {isChinese ? `用${targetLanguage()}怎么说` : `How to say this in ${targetLanguage()}`}
        </h3>
        <div class="vlc-pair">
          <span class="vlc-kind">{isChinese ? "你的表达" : "Your expression"}</span>
          <div class="vlc-source">
            <div class="vlc-fragment">“{input().sourceExpression}”</div>
          </div>
          <div class="vlc-arrow" aria-hidden="true">
            →
          </div>
          <div class="vlc-target">
            <div class="vlc-fragment" data-natural="true">
              “{input().targetExpression}”
            </div>
          </div>
        </div>
        <Show when={input().notes}>
          <p class="vlc-explanation">{input().notes}</p>
        </Show>
      </div>
      <footer class="vlc-footer">{targetLanguage()}</footer>
    </article>
  )
}

export default ExpressionCard

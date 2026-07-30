import {
  Show,
  createMemo,
  createSignal,
  onMount,
  type Component,
} from "solid-js"
import type { PluginTextActionSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import type { TranslationResult } from "../domain/translation"
import { languageDisplayName } from "../language"
import {
  DEFAULT_SETTINGS,
  VibeLingoSettingsSchema,
  type VibeLingoSettings,
} from "../settings"
import { localeForSettings, type UiLocale } from "./i18n"

type SurfaceInput =
  PluginTextActionSurfaceContext | { context: PluginTextActionSurfaceContext }

function resolveContext(input: SurfaceInput): PluginTextActionSurfaceContext {
  return "context" in input ? input.context : input
}

const styles = `
.vlt{box-sizing:border-box;min-width:0;color:var(--text-base);font-family:var(--font-family-sans,system-ui,sans-serif)}
.vlt *{box-sizing:border-box}.vlt-head{display:flex;align-items:center;gap:12px;padding:13px 17px;border-bottom:1px solid var(--border-base)}
.vlt-direction{min-width:0;color:var(--text-weak);font-size:12px}.vlt-action:hover{background:var(--surface-base-hover)}.vlt-body{padding:18px}.vlt-text{margin:0;color:var(--text-strong);font-size:15px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
.vlt-status{margin:11px 0 0;color:var(--text-weaker);font-size:11px}.vlt-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:0 17px 16px}
.vlt-action{min-height:36px;border:1px solid var(--border-base);border-radius:7px;background:var(--surface-base);color:var(--text-base);padding:7px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.vlt-action[data-primary=true]{border-color:var(--surface-interactive-solid);background:var(--surface-interactive-solid);color:var(--text-on-interactive-base)}
.vlt-action:disabled{cursor:not-allowed;opacity:.5}.vlt-action:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.vlt-error{margin:0 17px 14px;border-radius:8px;background:var(--surface-critical-weak);color:var(--text-on-critical-base);padding:10px 12px;font-size:12px}
.vlt-loading{display:flex;min-height:120px;align-items:center;justify-content:center;gap:9px;color:var(--text-weak);font-size:13px}.vlt-spinner{width:16px;height:16px;border:2px solid var(--border-base);border-top-color:var(--text-strong);border-radius:50%;animation:vlt-spin .8s linear infinite}
@keyframes vlt-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.vlt-spinner{animation:none}}`

const COPY = {
  en: {
    setup: "Complete VibeLingo setup to translate selections.",
    openSettings: "Open settings",
    copy: "Copy",
    copied: "Copied",
    native: "To support language",
    target: "To target language",
    refresh: "Translate again",
    history: "Translation history",
    loading: "Translating…",
    failed: "Translation failed. Try again.",
    notSaved: "Not added to translation history.",
    private: "Kept out of history for privacy.",
    writeFailed: "Shown now, but the history record could not be saved.",
    cache: "Loaded from translation history.",
  },
  "zh-CN": {
    setup: "请先完成 VibeLingo 设置，再使用划词翻译。",
    openSettings: "打开设置",
    copy: "复制",
    copied: "已复制",
    native: "翻译为母语",
    target: "翻译为目标语言",
    refresh: "重新翻译",
    history: "翻译记录",
    loading: "正在翻译…",
    failed: "翻译失败，请重试。",
    notSaved: "未加入翻译记录。",
    private: "为保护隐私，本次翻译未保存。",
    writeFailed: "译文可正常使用，但未能写入翻译记录。",
    cache: "已从翻译记录中读取。",
  },
} satisfies Record<UiLocale, Record<string, string>>

const TranslationPopover: Component<SurfaceInput> = (input) => {
  const context = resolveContext(input)
  const [result, setResult] = createSignal(
    context.textAction.output as TranslationResult,
  )
  const [locale, setLocale] = createSignal<UiLocale>(
    localeForSettings(DEFAULT_SETTINGS),
  )
  const [settings, setSettings] =
    createSignal<VibeLingoSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [copied, setCopied] = createSignal(false)
  const t = () => COPY[locale()]
  const translated = createMemo(() => {
    const value = result()
    return value.status === "translated" ? value : undefined
  })

  onMount(() => {
    void context.settings
      .get()
      .then((values) => {
        const parsed = VibeLingoSettingsSchema.safeParse(values)
        if (parsed.success) {
          setSettings(parsed.data)
          setLocale(localeForSettings(parsed.data))
        }
      })
      .catch(() => undefined)
  })

  async function translate(
    destination: "native" | "target",
    bypassCache = false,
  ) {
    setLoading(true)
    setError()
    try {
      const next = await context.operations.command<TranslationResult>(
        "translate-selection",
        {
          selection: context.textAction.selection,
          destination,
          bypassCache,
        },
      )
      setResult(next)
    } catch {
      setError(t().failed)
    } finally {
      setLoading(false)
    }
  }

  async function copyTranslation() {
    const value = translated()
    if (!value) return
    await navigator.clipboard.writeText(value.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1_500)
  }

  const statusCopy = () => {
    const value = translated()
    if (!value) return undefined
    if (value.cache !== "miss") return t().cache
    if (value.persistence === "disabled") return t().notSaved
    if (value.persistence === "privacy_excluded") return t().private
    if (value.persistence === "write_failed") return t().writeFailed
    return undefined
  }

  const refreshDestination = () => {
    const value = translated()
    if (!value) return "target" as const
    const destination = new Intl.Locale(value.destinationLanguage).language
    const native = new Intl.Locale(settings().nativeLanguage || "en").language
    return destination === native ? ("native" as const) : ("target" as const)
  }

  const openPage = (view: "settings" | "translations") => {
    context.textAction.close()
    context.host.openPluginPage("learning", { view })
  }

  return (
    <div class="vlt">
      <style>{styles}</style>
      <Show
        when={!loading()}
        fallback={
          <div class="vlt-loading" aria-live="polite">
            <span class="vlt-spinner" aria-hidden="true" />
            {t().loading}
          </div>
        }
      >
        <header class="vlt-head">
          <div class="vlt-direction">
            <Show when={translated()} fallback="VibeLingo">
              {(value) =>
                `${languageDisplayName(value().sourceLanguage, locale())} → ${languageDisplayName(value().destinationLanguage, locale())}`
              }
            </Show>
          </div>
        </header>
        <Show when={result().status === "setup_required"}>
          <div class="vlt-body">
            <p class="vlt-text">{t().setup}</p>
          </div>
          <div class="vlt-actions">
            <button
              class="vlt-action"
              data-primary
              type="button"
              onClick={() => openPage("settings")}
            >
              {t().openSettings}
            </button>
          </div>
        </Show>
        <Show when={result().status === "not_translatable"}>
          <div class="vlt-body">
            <p class="vlt-text">
              {
                (
                  result() as Extract<
                    TranslationResult,
                    { status: "not_translatable" }
                  >
                ).reason
              }
            </p>
          </div>
        </Show>
        <Show when={translated()}>
          {(value) => (
            <>
              <div class="vlt-body">
                <p class="vlt-text">{value().translatedText}</p>
                <Show when={statusCopy()}>
                  {(status) => <p class="vlt-status">{status()}</p>}
                </Show>
              </div>
              <Show when={error()}>
                {(message) => (
                  <div class="vlt-error" role="alert">
                    {message()}
                  </div>
                )}
              </Show>
              <div class="vlt-actions">
                <button
                  class="vlt-action"
                  data-primary
                  type="button"
                  onClick={() => void copyTranslation()}
                >
                  {copied() ? t().copied : t().copy}
                </button>
                <button
                  class="vlt-action"
                  type="button"
                  onClick={() => void translate("native")}
                >
                  {t().native}
                </button>
                <button
                  class="vlt-action"
                  type="button"
                  onClick={() => void translate("target")}
                >
                  {t().target}
                </button>
                <button
                  class="vlt-action"
                  type="button"
                  onClick={() => void translate(refreshDestination(), true)}
                >
                  {t().refresh}
                </button>
                <button
                  class="vlt-action"
                  type="button"
                  onClick={() => openPage("translations")}
                >
                  {t().history}
                </button>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  )
}

export default TranslationPopover

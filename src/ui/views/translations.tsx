import {
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Component,
} from "solid-js"
import { languageDisplayName } from "../../language"
import { RefreshButton } from "../components"
import { copy, formatDate } from "../i18n"
import { useDashboard } from "../app-context"

type TranslationItem = {
  id: string
  profileTargetLanguage: string
  nativeLanguage: string
  destinationPolicy: "adaptive" | "native" | "target"
  detectedSourceLanguage: string
  destinationLanguage: string
  sourceText: string
  sourceCharCount: number
  translatedText: string
  createdAt: number
  updatedAt: number
  lastUsedAt: number
  useCount: number
}

type TranslationList = {
  setupRequired: boolean
  items: TranslationItem[]
  nextCursor?: string
}

export const TranslationsView: Component = () => {
  const dashboard = useDashboard()
  const [query, setQuery] = createSignal("")
  const [direction, setDirection] = createSignal("")
  const [items, setItems] = createSignal<TranslationItem[]>([])
  const [nextCursor, setNextCursor] = createSignal<string>()
  const [cursor, setCursor] = createSignal<string>()
  const [cursorStack, setCursorStack] = createSignal<Array<string | undefined>>(
    [],
  )
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let requestVersion = 0
  let requestController: AbortController | undefined

  async function load() {
    const profile = dashboard.profile()
    if (!profile) return
    const version = ++requestVersion
    requestController?.abort()
    const controller = new AbortController()
    requestController = controller
    setLoading(true)
    try {
      const response =
        await dashboard.context.operations.query<TranslationList>(
          "translations-list",
          {
            targetLanguage: profile.targetLanguage,
            destinationLanguage: direction() || undefined,
            query: query() || undefined,
            cursor: cursor(),
            limit: 20,
          },
          { signal: controller.signal },
        )
      if (version !== requestVersion) return
      setItems(response.items)
      setNextCursor(response.nextCursor)
      setError()
    } catch (cause) {
      if (controller.signal.aborted || version !== requestVersion) return
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (version === requestVersion) setLoading(false)
    }
  }

  createEffect(
    on(
      () => [
        dashboard.profile()?.targetLanguage,
        dashboard.refreshVersion(),
        query(),
        direction(),
        cursor(),
      ],
      () => void load(),
    ),
  )
  onCleanup(() => requestController?.abort())

  function resetPage() {
    setCursor()
    setCursorStack([])
  }

  async function remove(id: string) {
    await dashboard.context.operations.command("translation-command", {
      action: "delete",
      translationId: id,
    })
    dashboard.refresh()
  }

  async function clear(scope: "target" | "all") {
    const locale = dashboard.locale()
    const confirmed = await dashboard.context.host.confirm({
      title:
        locale === "zh-CN"
          ? scope === "all"
            ? "清除全部翻译记录？"
            : "清除当前语言的翻译记录？"
          : scope === "all"
            ? "Clear all translation history?"
            : "Clear translations for this language?",
      message:
        locale === "zh-CN"
          ? "这会删除所选范围内已保存的译文和缓存，但不会删除学习模式。"
          : "This deletes saved translations and cache entries in the selected scope without changing learning patterns.",
      confirmLabel: locale === "zh-CN" ? "清除翻译记录" : "Clear translations",
    })
    if (!confirmed) return
    await dashboard.context.operations.command(
      "translation-command",
      scope === "all"
        ? { action: "clear_all" }
        : {
            action: "clear_target",
            targetLanguage: dashboard.profile()!.targetLanguage,
          },
    )
    resetPage()
    dashboard.refresh()
  }

  return (
    <div>
      <div class="vld-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "translations")}</p>
          <h2 class="vld-page-title">
            {copy(dashboard.locale(), "translationHistory")}
          </h2>
          <p class="vld-page-copy">
            {copy(dashboard.locale(), "translationHistoryHelp")}
          </p>
        </div>
        <div class="vld-inline-actions vld-page-actions">
          <RefreshButton loading={loading()} onRefresh={dashboard.refresh} />
          <button
            class="vld-secondary"
            type="button"
            disabled={items().length === 0}
            onClick={() => void clear("target")}
          >
            {copy(dashboard.locale(), "clearTranslations")}
          </button>
          <button
            class="vld-secondary"
            type="button"
            onClick={() => void clear("all")}
          >
            {dashboard.locale() === "zh-CN" ? "清除全部" : "Clear all"}
          </button>
        </div>
      </div>

      <div class="vld-toolbar">
        <div class="vld-search">
          <input
            class="vld-input"
            type="search"
            value={query()}
            placeholder={copy(dashboard.locale(), "searchTranslations")}
            onInput={(event) => {
              setQuery(event.currentTarget.value)
              resetPage()
            }}
          />
        </div>
        <select
          class="vld-select"
          value={direction()}
          aria-label={copy(dashboard.locale(), "direction")}
          onChange={(event) => {
            setDirection(event.currentTarget.value)
            resetPage()
          }}
        >
          <option value="">{copy(dashboard.locale(), "allDirections")}</option>
          <Show when={dashboard.profile()}>
            {(profile) => (
              <>
                <option value={profile().nativeLanguage}>
                  {languageDisplayName(
                    profile().targetLanguage,
                    dashboard.locale(),
                  )}{" "}
                  →{" "}
                  {languageDisplayName(
                    profile().nativeLanguage,
                    dashboard.locale(),
                  )}
                </option>
                <option value={profile().targetLanguage}>
                  {languageDisplayName(
                    profile().nativeLanguage,
                    dashboard.locale(),
                  )}{" "}
                  →{" "}
                  {languageDisplayName(
                    profile().targetLanguage,
                    dashboard.locale(),
                  )}
                </option>
              </>
            )}
          </Show>
        </select>
      </div>

      <Show
        when={!error()}
        fallback={
          <div class="vld-error" role="alert">
            {error()}
          </div>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <div class="vld-panel vld-panel-pad vld-skeleton">
              <div class="vld-skeleton-line" />
              <div class="vld-skeleton-line" />
            </div>
          }
        >
          <Show
            when={items().length > 0}
            fallback={
              <div class="vld-panel vld-empty">
                <div class="vld-empty-inner">
                  <h3 class="vld-empty-title">
                    {copy(dashboard.locale(), "noTranslations")}
                  </h3>
                  <p class="vld-empty-copy">
                    {copy(dashboard.locale(), "noTranslationsHelp")}
                  </p>
                </div>
              </div>
            }
          >
            <ul class="vld-translation-list">
              <For each={items()}>
                {(item) => (
                  <li class="vld-panel vld-translation-row">
                    <div class="vld-translation-source">
                      <span class="vld-number-sub">
                        {languageDisplayName(
                          item.detectedSourceLanguage,
                          dashboard.locale(),
                        )}{" "}
                        →{" "}
                        {languageDisplayName(
                          item.destinationLanguage,
                          dashboard.locale(),
                        )}
                      </span>
                      <p>
                        {item.sourceText}
                      </p>
                    </div>
                    <div class="vld-translation-output">
                      <span class="vld-number-sub">
                        {copy(dashboard.locale(), "translatedText")}
                      </span>
                      <p>{item.translatedText}</p>
                    </div>
                    <div class="vld-translation-meta">
                      <span>
                        {copy(dashboard.locale(), "uses")}: {item.useCount}
                      </span>
                      <span>
                        {formatDate(dashboard.locale(), item.lastUsedAt)}
                      </span>
                      <button
                        class="vld-link-button"
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            item.translatedText,
                          )
                        }
                      >
                        {dashboard.locale() === "zh-CN" ? "复制" : "Copy"}
                      </button>
                      <button
                        class="vld-link-button"
                        type="button"
                        onClick={() => void remove(item.id)}
                      >
                        {copy(dashboard.locale(), "delete")}
                      </button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
            <div class="vld-pagination">
              <button
                class="vld-secondary"
                type="button"
                disabled={cursorStack().length === 0}
                onClick={() => {
                  const stack = cursorStack()
                  setCursorStack(stack.slice(0, -1))
                  setCursor(stack.at(-1))
                }}
              >
                {copy(dashboard.locale(), "previousPage")}
              </button>
              <button
                class="vld-secondary"
                type="button"
                disabled={!nextCursor()}
                onClick={() => {
                  setCursorStack((stack) => [...stack, cursor()])
                  setCursor(nextCursor())
                }}
              >
                {copy(dashboard.locale(), "nextPage")}
              </button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}

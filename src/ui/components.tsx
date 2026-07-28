import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
  type JSX,
} from "solid-js"
import { Portal } from "solid-js/web"
import type { TrendPoint } from "../domain/types"
import type { PatternSchema } from "../application/dashboard-contracts"
import { useDashboard } from "./app-context"
import {
  copy,
  formatDate,
  formatNumber,
  profileLabel,
  statusLabel,
} from "./i18n"

type Pattern = typeof PatternSchema._output

export const LoadingBlock: Component<{ label?: string }> = (props) => {
  const dashboard = useDashboard()
  return (
    <div class="vld-panel vld-panel-pad vld-skeleton" aria-busy="true" aria-label={props.label ?? copy(dashboard.locale(), "loading")}>
      <div class="vld-skeleton-line" />
      <div class="vld-skeleton-line" />
      <div class="vld-skeleton-line" />
    </div>
  )
}

export const ErrorBlock: Component<{ message?: string; onRetry?: () => void }> = (props) => {
  const dashboard = useDashboard()
  return (
    <div class="vld-error" role="alert">
      <div>{props.message || copy(dashboard.locale(), "loadFailed")}</div>
      <Show when={props.onRetry}>
        <button class="vld-link-button" type="button" onClick={() => props.onRetry?.()}>
          {copy(dashboard.locale(), "retry")}
        </button>
      </Show>
    </div>
  )
}

export const EmptyState: Component<{
  title: string
  copy: string
  action?: JSX.Element
}> = (props) => (
  <div class="vld-panel vld-empty">
    <div class="vld-empty-inner">
      <h3 class="vld-empty-title">{props.title}</h3>
      <p class="vld-empty-copy">{props.copy}</p>
      <Show when={props.action}><div class="vld-empty-action">{props.action}</div></Show>
    </div>
  </div>
)

export const StatusBadge: Component<{ status: Pattern["displayStatus"] | "ignored" | "rejected" }> = (props) => {
  const dashboard = useDashboard()
  return (
    <span class="vld-badge" data-status={props.status}>
      {statusLabel(dashboard.locale(), props.status)}
    </span>
  )
}

export const PatternText: Component<{
  patternKey: string
  label: string
  rule?: string
  showRule?: boolean
}> = (props) => {
  const dashboard = useDashboard()
  const localized = () => dashboard.presentation(props.patternKey)
  return (
    <>
      <span class="vld-pattern-name">{localized()?.label ?? props.label}</span>
      <Show when={props.showRule && props.rule}>
        <span class="vld-pattern-rule">{localized()?.rule ?? props.rule}</span>
      </Show>
    </>
  )
}

export const Pagination: Component<{
  page: number
  canPrevious: boolean
  canNext: boolean
  onPrevious: () => void
  onNext: () => void
}> = (props) => {
  const dashboard = useDashboard()
  return (
    <nav class="vld-pagination" aria-label={dashboard.locale() === "zh-CN" ? "分页" : "Pagination"}>
      <button class="vld-secondary" type="button" disabled={!props.canPrevious} onClick={props.onPrevious}>
        {copy(dashboard.locale(), "previousPage")}
      </button>
      <span class="vld-page-count">
        {copy(dashboard.locale(), "page")} {formatNumber(dashboard.locale(), props.page)}
      </span>
      <button class="vld-secondary" type="button" disabled={!props.canNext} onClick={props.onNext}>
        {copy(dashboard.locale(), "nextPage")}
      </button>
    </nav>
  )
}

export const Heatmap: Component<{ points: TrendPoint[] }> = (props) => {
  const dashboard = useDashboard()
  const max = createMemo(() => Math.max(1, ...props.points.map((point) => point.targetAttempts)))
  return (
    <div class="vld-heatmap" role="list" aria-label={copy(dashboard.locale(), "recent30")}>
      <For each={props.points.slice(-30)}>
        {(point) => {
          const level = () => point.targetAttempts === 0
            ? 0
            : Math.max(1, Math.min(4, Math.ceil((point.targetAttempts / max()) * 4)))
          return (
            <span
              class="vld-heat-cell"
              data-level={level()}
              role="listitem"
              title={`${point.date}: ${point.targetAttempts}`}
              aria-label={`${point.date}: ${point.targetAttempts}`}
            />
          )
        }}
      </For>
    </div>
  )
}

const SERIES = [
  { key: "targetAttempts", id: "attempts", label: "attempts" },
  { key: "findings", id: "findings", label: "findings" },
  { key: "naturalCorrectUses", id: "natural", label: "naturalUses" },
  { key: "independentReviews", id: "reviews", label: "independentReviews" },
] as const

export const EvidenceChart: Component<{ points: TrendPoint[] }> = (props) => {
  const dashboard = useDashboard()
  const width = 760
  const height = 250
  const inset = { left: 36, right: 14, top: 12, bottom: 28 }
  const maximum = createMemo(() => Math.max(
    1,
    ...props.points.flatMap((point) =>
      SERIES.map((series) => point[series.key]),
    ),
  ))
  const ticks = createMemo(() => {
    const max = maximum()
    const step = Math.max(1, Math.ceil(max / 4))
    const values = Array.from(
      { length: Math.floor(max / step) + 1 },
      (_, index) => index * step,
    )
    if (values.at(-1) !== max) values.push(max)
    return values
  })
  const x = (index: number) => inset.left
    + (props.points.length <= 1 ? 0 : index / (props.points.length - 1))
      * (width - inset.left - inset.right)
  const y = (value: number) => inset.top
    + (1 - value / maximum()) * (height - inset.top - inset.bottom)
  const line = (key: typeof SERIES[number]["key"]) =>
    props.points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ")
  const summary = createMemo(() => SERIES.map((series) => {
    const total = props.points.reduce((sum, point) => sum + point[series.key], 0)
    return `${copy(dashboard.locale(), series.label)}: ${total}`
  }).join("; "))

  return (
    <>
      <div class="vld-legend" aria-hidden="true">
        <For each={SERIES}>
          {(series) => (
            <span class="vld-legend-item">
              <span class="vld-legend-dot" data-series={series.id} />
              {copy(dashboard.locale(), series.label)}
            </span>
          )}
        </For>
      </div>
      <svg
        class="vld-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary()}
      >
        <For each={ticks()}>
          {(tick) => (
            <>
              <line
                class="vld-chart-grid"
                x1={inset.left}
                x2={width - inset.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text class="vld-chart-label" x="0" y={y(tick) + 4}>
                {tick}
              </text>
            </>
          )}
        </For>
        <For each={SERIES}>
          {(series) => (
            <polyline
              class="vld-chart-line"
              data-series={series.id}
              points={line(series.key)}
            />
          )}
        </For>
        <Show when={props.points.length > 0}>
          <text class="vld-chart-label" x={inset.left} y={height - 5}>
            {props.points[0]?.date.slice(5)}
          </text>
          <text class="vld-chart-label" text-anchor="end" x={width - inset.right} y={height - 5}>
            {props.points.at(-1)?.date.slice(5)}
          </text>
        </Show>
      </svg>
    </>
  )
}

export const ProfileMenu: Component<{ anchor: HTMLButtonElement | undefined; onClose: () => void }> = (props) => {
  const dashboard = useDashboard()
  const [position, setPosition] = createSignal({ left: 8, top: 8 })
  let menu: HTMLDivElement | undefined
  const current = dashboard.profile

  function reposition() {
    if (!props.anchor) return
    const rect = props.anchor.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 16)
    setPosition({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: Math.min(rect.bottom + 7, window.innerHeight - 120),
    })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      props.onClose()
      props.anchor?.focus()
      return
    }
    const items = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex: number | undefined
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
    if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = items.length - 1
    if (nextIndex !== undefined) {
      event.preventDefault()
      items[nextIndex]?.focus()
    }
  }

  onMount(() => {
    reposition()
    menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!menu?.contains(target) && !props.anchor?.contains(target)) props.onClose()
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    onCleanup(() => document.removeEventListener("pointerdown", closeOnOutsidePointer))
  })
  onCleanup(() => {
    window.removeEventListener("resize", reposition)
    window.removeEventListener("scroll", reposition, true)
  })

  const otherProfiles = createMemo(() =>
    dashboard.profiles().filter((profile) => profile.targetLanguage !== current()?.targetLanguage),
  )

  return (
    <Portal>
      <div
        ref={menu}
        class="vld-profile-menu"
        role="menu"
        tabindex="-1"
        style={{ left: `${position().left}px`, top: `${position().top}px` }}
        onKeyDown={onKeyDown}
      >
        <div class="vld-menu-label">{copy(dashboard.locale(), "activeProfile")}</div>
        <Show when={current()}>
          {(profile) => (
            <button class="vld-menu-item" data-active="true" type="button" role="menuitem" onClick={props.onClose}>
              <span>
                <span class="vld-menu-item-main">{profileLabel(dashboard.locale(), profile())}</span>
                <span class="vld-menu-item-sub">{copy(dashboard.locale(), "activeProfile")}</span>
              </span>
              <span aria-hidden="true">✓</span>
            </button>
          )}
        </Show>
        <Show when={otherProfiles().length > 0}>
          <div class="vld-menu-label">{copy(dashboard.locale(), "profileHistory")}</div>
          <For each={otherProfiles()}>
            {(profile) => (
              <button
                class="vld-menu-item"
                type="button"
                role="menuitem"
                onClick={() => void dashboard.switchProfile(profile).then((changed) => {
                  if (changed) props.onClose()
                })}
              >
                <span>
                  <span class="vld-menu-item-main">{profileLabel(dashboard.locale(), profile)}</span>
                  <span class="vld-menu-item-sub">
                    {formatDate(dashboard.locale(), profile.lastUsedAt)}
                  </span>
                </span>
              </button>
            )}
          </For>
        </Show>
        <div class="vld-menu-divider" />
        <button
          class="vld-menu-item"
          type="button"
          role="menuitem"
          onClick={() => {
            props.onClose()
            dashboard.navigate({ view: "settings" })
          }}
        >
          <span class="vld-menu-item-main">{copy(dashboard.locale(), "addLanguage")}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </Portal>
  )
}

export const Dialog: Component<{
  title: string
  copy?: string
  onClose: () => void
  children: JSX.Element
}> = (props) => {
  let dialog: HTMLDivElement | undefined
  let previouslyFocused: HTMLElement | null = null

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      props.onClose()
      return
    }
    if (event.key !== "Tab" || !dialog) return
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )]
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]!
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  onMount(() => {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.querySelector<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )?.focus()
    if (document.activeElement === previouslyFocused) dialog?.focus()
  })
  onCleanup(() => previouslyFocused?.focus())
  return (
    <Portal>
      <div
        class="vld-dialog-backdrop"
        role="presentation"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose()
        }}
      >
        <div
          ref={dialog}
          class="vld-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vld-dialog-title"
          tabindex="-1"
          onKeyDown={onKeyDown}
        >
          <h2 id="vld-dialog-title" class="vld-dialog-title">{props.title}</h2>
          <Show when={props.copy}><p class="vld-dialog-copy">{props.copy}</p></Show>
          {props.children}
        </div>
      </div>
    </Portal>
  )
}

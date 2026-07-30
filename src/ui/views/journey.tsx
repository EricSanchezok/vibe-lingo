import { For, Show, createEffect, createSignal, type Component } from "solid-js"
import type {
  LearningJourneyOutput,
  LearningRecordOutput,
} from "../../application/dashboard-contracts"
import type { LearningEventType } from "../../domain/types"
import { useDashboard } from "../app-context"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Pagination,
  PatternText,
} from "../components"
import {
  copy,
  eventLabel,
  formatDate,
  formatNumber,
  formatRelativeDate,
  outcomeLabel,
  practiceActivityLabel,
} from "../i18n"
import { createAbortableResource } from "../resource"

type EventFilter = "all" | "work" | "review" | "pattern"

const FILTER_TYPES: Record<Exclude<EventFilter, "all">, LearningEventType[]> = {
  work: ["practice_started"],
  review: ["review_item_completed", "review_completed"],
  pattern: ["pattern_discovered", "pattern_reviewable", "pattern_verified", "pattern_lapsed"],
}

function selectedTypes(filter: EventFilter): LearningEventType[] | undefined {
  return filter === "all" ? undefined : FILTER_TYPES[filter]
}

export const JourneyView: Component = () => {
  const dashboard = useDashboard()
  const [eventFilter, setEventFilter] = createSignal<EventFilter>("all")
  const [scope, setScope] = createSignal<"all" | "current">("all")
  const [days, setDays] = createSignal<0 | 30 | 90>(0)
  const [cursors, setCursors] = createSignal<Array<string | undefined>>([undefined])
  const [pageIndex, setPageIndex] = createSignal(0)

  createEffect(() => {
    eventFilter()
    scope()
    days()
    setCursors([undefined])
    setPageIndex(0)
  })

  const resource = createAbortableResource<LearningJourneyOutput>(
    () => [
      dashboard.profile()?.targetLanguage,
      dashboard.refreshVersion(),
      eventFilter(),
      scope(),
      days(),
      cursors()[pageIndex()],
    ],
    (signal) => dashboard.context.operations.query(
      "learning-journey",
      {
        targetLanguage: dashboard.profile()?.targetLanguage,
        scope: scope(),
        timeZone: dashboard.timeZone,
        types: selectedTypes(eventFilter()),
        from: days() ? Date.now() - days() * 86_400_000 : undefined,
        cursor: cursors()[pageIndex()],
        limit: 20,
      },
      { signal },
    ),
  )
  createEffect(() => {
    const keys = resource().data?.items.flatMap((event) => event.patternKey ? [event.patternKey] : []) ?? []
    if (keys.length) void dashboard.present(keys)
  })

  function nextPage() {
    const cursor = resource().data?.nextCursor
    if (!cursor) return
    setCursors((previous) => [...previous.slice(0, pageIndex() + 1), cursor])
    setPageIndex((value) => value + 1)
  }

  return (
    <>
      <button class="vld-back" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>
        <span aria-hidden="true">←</span> {copy(dashboard.locale(), "overview")}
      </button>
      <div class="vld-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "journey")}</p>
          <h1 class="vld-page-title">{copy(dashboard.locale(), "journey")}</h1>
          <p class="vld-page-copy">
            {dashboard.locale() === "zh-CN"
              ? "按时间回看真实工作、模式形成和复习留下的学习证据。"
              : "A chronological record of real work, pattern formation, and review evidence."}
          </p>
        </div>
        <div class="vld-filter-row">
          <select aria-label={copy(dashboard.locale(), "allEvents")} class="vld-select" value={eventFilter()} onChange={(event) => setEventFilter(event.currentTarget.value as EventFilter)}>
            <option value="all">{copy(dashboard.locale(), "allEvents")}</option>
            <option value="work">{copy(dashboard.locale(), "realWork")}</option>
            <option value="review">{copy(dashboard.locale(), "reviews")}</option>
            <option value="pattern">{copy(dashboard.locale(), "milestones")}</option>
          </select>
          <select aria-label={dashboard.locale() === "zh-CN" ? "时间范围" : "Date range"} class="vld-select" value={days()} onChange={(event) => setDays(Number(event.currentTarget.value) as 0 | 30 | 90)}>
            <option value="0">{dashboard.locale() === "zh-CN" ? "全部时间" : "All time"}</option>
            <option value="30">{copy(dashboard.locale(), "range30")}</option>
            <option value="90">{copy(dashboard.locale(), "range90")}</option>
          </select>
          <select aria-label={copy(dashboard.locale(), "scope")} class="vld-select" value={scope()} onChange={(event) => setScope(event.currentTarget.value as "all" | "current")}>
            <option value="all">{copy(dashboard.locale(), "allScopes")}</option>
            <option value="current">{copy(dashboard.locale(), "currentScope")}</option>
          </select>
        </div>
      </div>

      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={(resource().data?.items.length ?? 0) > 0}
            fallback={
              <EmptyState
                title={copy(dashboard.locale(), "noJourney")}
                copy={copy(dashboard.locale(), "noDataHelp")}
              />
            }
          >
            <section class="vld-panel vld-panel-pad">
              <ul class="vld-list">
                <For each={resource().data!.items}>
                  {(event) => {
                    const kind = event.type.includes("review")
                      ? "review"
                      : event.type.includes("pattern")
                        ? "pattern"
                        : "work"
                    return (
                      <li class="vld-list-row">
                        <time class="vld-list-date" datetime={new Date(event.occurredAt).toISOString()}>
                          {formatDate(dashboard.locale(), event.occurredAt, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                        <button
                          class="vld-menu-item"
                          type="button"
                          onClick={() => dashboard.navigate({ view: "record", eventId: event.id })}
                        >
                          <span class="vld-dot-title">
                            <span class="vld-event-dot" data-kind={kind} />
                            <span>
                              <span class="vld-menu-item-main">{eventLabel(dashboard.locale(), event.type)}</span>
                              <span class="vld-menu-item-sub">
                                {event.patternKey
                                  ? dashboard.presentation(event.patternKey)?.label ?? event.patternKey
                                  : event.type === "practice_started" && event.attemptCount != null
                                    ? practiceActivityLabel(
                                        dashboard.locale(),
                                        event.attemptCount,
                                        event.findingCount ?? 0,
                                      )
                                  : event.sessionId
                                    ? dashboard.locale() === "zh-CN" ? "来自一个真实会话" : "From a real session"
                                    : formatRelativeDate(dashboard.locale(), event.occurredAt)}
                              </span>
                            </span>
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </section>
            <Pagination
              page={pageIndex() + 1}
              canPrevious={pageIndex() > 0}
              canNext={Boolean(resource().data?.nextCursor)}
              onPrevious={() => setPageIndex((value) => Math.max(0, value - 1))}
              onNext={nextPage}
            />
          </Show>
        </Show>
      </Show>
    </>
  )
}

export const RecordView: Component<{ eventId: string }> = (props) => {
  const dashboard = useDashboard()
  const resource = createAbortableResource<LearningRecordOutput>(
    () => [dashboard.profile()?.targetLanguage, props.eventId, dashboard.refreshVersion()],
    (signal) => dashboard.context.operations.query(
      "learning-record",
      {
        targetLanguage: dashboard.profile()?.targetLanguage,
        eventId: props.eventId,
      },
      { signal },
    ),
  )

  createEffect(() => {
    const keys = resource().data?.patterns?.map((pattern) => pattern.patternKey) ?? []
    if (keys.length) void dashboard.present(keys)
  })

  return (
    <>
      <button class="vld-back" type="button" onClick={() => dashboard.navigate({ view: "journey" })}>
        <span aria-hidden="true">←</span> {copy(dashboard.locale(), "journey")}
      </button>
      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={resource().data?.found && resource().data?.event}
            fallback={
              <EmptyState
                title={dashboard.locale() === "zh-CN" ? "没有找到这条学习记录" : "Learning record not found"}
                copy={copy(dashboard.locale(), "noJourney")}
              />
            }
          >
            <section class="vld-detail-hero">
              <div>
                <p class="vld-eyebrow">{copy(dashboard.locale(), "recordDetail")}</p>
                <h1 class="vld-page-title">{eventLabel(dashboard.locale(), resource().data!.event!.type)}</h1>
                <p class="vld-page-copy">
                  {formatDate(dashboard.locale(), resource().data!.event!.occurredAt, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Show when={resource().data!.sourceSession}>
                {(session) => (
                  <button class="vld-secondary" type="button" onClick={() => dashboard.context.host.openSession(session().id)}>
                    {copy(dashboard.locale(), "openSession")} →
                  </button>
                )}
              </Show>
            </section>

            <div class="vld-detail-grid">
              <div class="vld-grid">
                <Show when={resource().data!.corrections?.length}>
                  <section class="vld-panel vld-detail-section">
                    <h2 class="vld-section-title">
                      {dashboard.locale() === "zh-CN" ? "当时显示的纠正" : "Correction shown at the time"}
                    </h2>
                    <For each={resource().data!.corrections}>
                      {(correction) => (
                        <div class="vld-evidence-row">
                          <p class="vld-evidence-copy">
                            {correction.originalFragment || correction.correctedFragment
                              ? [correction.originalFragment, correction.correctedFragment].filter(Boolean).join(" → ")
                              : copy(dashboard.locale(), "contentNotRetained")}
                          </p>
                          <Show when={correction.patternKey}>
                            {(patternKey) => (
                              <button
                                class="vld-link-button"
                                type="button"
                                onClick={() => dashboard.navigate({ view: "pattern", patternKey: patternKey() })}
                              >
                                {dashboard.locale() === "zh-CN" ? "查看关联模式" : "View linked pattern"} →
                              </button>
                            )}
                          </Show>
                        </div>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={resource().data!.patterns?.length}>
                  <section class="vld-panel vld-detail-section">
                    <h2 class="vld-section-title">{copy(dashboard.locale(), "patterns")}</h2>
                    <For each={resource().data!.patterns}>
                      {(pattern) => (
                        <button
                          class="vld-menu-item"
                          type="button"
                          onClick={() => dashboard.navigate({ view: "pattern", patternKey: pattern.patternKey })}
                        >
                          <span>
                            <PatternText
                              patternKey={pattern.patternKey}
                              label={pattern.label}
                              rule={pattern.rule}
                              showRule
                            />
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={resource().data!.evidence?.length}>
                  <section class="vld-panel vld-detail-section">
                    <h2 class="vld-section-title">{copy(dashboard.locale(), "evidenceTimeline")}</h2>
                    <For each={resource().data!.evidence}>
                      {(evidence) => (
                        <div class="vld-evidence-row">
                          <div class="vld-evidence-top">
                            <strong>{evidence.label}</strong>
                            <span class="vld-list-meta">{formatDate(dashboard.locale(), evidence.observedAt)}</span>
                          </div>
                          <p class="vld-evidence-copy">
                            {evidence.originalFragment || evidence.correctedFragment
                              ? [evidence.originalFragment, evidence.correctedFragment].filter(Boolean).join(" → ")
                              : copy(dashboard.locale(), "contentNotRetained")}
                          </p>
                        </div>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={resource().data!.review}>
                  {(review) => (
                    <section class="vld-panel vld-detail-section">
                      <h2 class="vld-section-title">{copy(dashboard.locale(), "review")}</h2>
                      <div class="vld-stat-row" style={{ "margin-top": "15px" }}>
                        <div class="vld-stat">
                          <span class="vld-stat-value">{review().summary.completedPatternCount}</span>
                          <span class="vld-stat-label">{copy(dashboard.locale(), "completedPatterns")}</span>
                        </div>
                        <div class="vld-stat">
                          <span class="vld-stat-value">{review().summary.independentRecallCount}</span>
                          <span class="vld-stat-label">{copy(dashboard.locale(), "independentRecall")}</span>
                        </div>
                        <div class="vld-stat">
                          <span class="vld-stat-value">{review().summary.successfulTransferCount}</span>
                          <span class="vld-stat-label">{copy(dashboard.locale(), "successfulTransfer")}</span>
                        </div>
                        <div class="vld-stat">
                          <span class="vld-stat-value">{review().completedItems.length}</span>
                          <span class="vld-stat-label">{copy(dashboard.locale(), "reviewHistory")}</span>
                        </div>
                      </div>
                      <For each={review().completedItems}>
                        {(item) => (
                          <div class="vld-evidence-row">
                            <div class="vld-evidence-top">
                              <strong>{dashboard.presentation(item.patternKey)?.label ?? item.label}</strong>
                              <span class="vld-badge">{outcomeLabel(dashboard.locale(), item.outcome)}</span>
                            </div>
                            <p class="vld-evidence-copy">
                              {item.dueAt
                                ? `${copy(dashboard.locale(), "nextDue")}: ${formatRelativeDate(dashboard.locale(), item.dueAt)}`
                                : copy(dashboard.locale(), "verified")}
                            </p>
                          </div>
                        )}
                      </For>
                    </section>
                  )}
                </Show>
              </div>

              <aside class="vld-grid">
                <Show when={resource().data!.sessionSummary}>
                  {(summary) => (
                    <section class="vld-soft-panel">
                      <h2 class="vld-section-title">
                        {resource().data!.sessionTitle
                          ?? (dashboard.locale() === "zh-CN" ? "来源会话摘要" : "Source session summary")}
                      </h2>
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <span>{copy(dashboard.locale(), "analyzedMessages")}</span>
                          <strong>{formatNumber(dashboard.locale(), summary().analyzedMessages)}</strong>
                        </div>
                      </div>
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <span>{copy(dashboard.locale(), "attempts")}</span>
                          <strong>{formatNumber(dashboard.locale(), summary().targetAttempts)}</strong>
                        </div>
                      </div>
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <span>{copy(dashboard.locale(), "findings")}</span>
                          <strong>{formatNumber(dashboard.locale(), summary().findings)}</strong>
                        </div>
                      </div>
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <span>{copy(dashboard.locale(), "demonstrations")}</span>
                          <strong>{formatNumber(dashboard.locale(), summary().demonstrations)}</strong>
                        </div>
                      </div>
                    </section>
                  )}
                </Show>
                <Show when={!resource().data!.sourceSession && resource().data!.event!.sessionId}>
                  <section class="vld-panel vld-panel-pad">
                    <h2 class="vld-section-title">{copy(dashboard.locale(), "scope")}</h2>
                    <p class="vld-section-copy">{copy(dashboard.locale(), "sourceUnavailable")}</p>
                    <p class="vld-pattern-rule">{resource().data!.event!.sessionId}</p>
                  </section>
                </Show>
              </aside>
            </div>
          </Show>
        </Show>
      </Show>
    </>
  )
}

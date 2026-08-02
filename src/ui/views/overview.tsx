import { For, Show, createEffect, createMemo, createSignal, onCleanup, type Component } from "solid-js"
import type {
  LearningJourneyOutput,
  LearningPatternsOutput,
  LearningSummaryOutput,
  ReviewQueueOutput,
} from "../../application/dashboard-contracts"
import type { CommandResult, ReviewState } from "../../domain/types"
import { useDashboard } from "../app-context"
import {
  EmptyState,
  ErrorBlock,
  EvidenceChart,
  Heatmap,
  LoadingBlock,
  PatternText,
  RefreshButton,
} from "../components"
import {
  copy,
  eventLabel,
  formatDate,
  formatLastChecked,
  formatNumber,
  formatRelativeDate,
  greeting,
  practiceActivityLabel,
} from "../i18n"
import { createAbortableResource } from "../resource"

type OverviewData = {
  summary: LearningSummaryOutput
  journey: LearningJourneyOutput
  queue: ReviewQueueOutput
  improving: LearningPatternsOutput
}

export const OverviewView: Component = () => {
  const dashboard = useDashboard()
  const [range, setRange] = createSignal<"7" | "30" | "90">("30")
  const [starting, setStarting] = createSignal(false)
  const [startError, setStartError] = createSignal("")
  const resource = createAbortableResource<OverviewData>(
    () => [dashboard.profile()?.targetLanguage, dashboard.refreshVersion()],
    async (signal) => {
      const targetLanguage = dashboard.profile()?.targetLanguage
      const base = { targetLanguage, scope: "all" as const, timeZone: dashboard.timeZone }
      const [summary, journey, queue, improving] = await Promise.all([
        dashboard.context.operations.query<LearningSummaryOutput>(
          "learning-summary",
          base,
          { signal },
        ),
        dashboard.context.operations.query<LearningJourneyOutput>(
          "learning-journey",
          { ...base, limit: 4 },
          { signal },
        ),
        dashboard.context.operations.query<ReviewQueueOutput>(
          "review-queue",
          { ...base, limit: 3 },
          { signal },
        ),
        dashboard.context.operations.query<LearningPatternsOutput>(
          "learning-patterns",
          { ...base, status: "improving", sort: "recent", limit: 2 },
          { signal },
        ),
      ])
      return { summary, journey, queue, improving }
    },
  )

  const summary = () => resource().data?.summary
  const queue = () => resource().data?.queue
  const hasHistory = () => Boolean(
    summary()?.targetAttempts
    || summary()?.reviewCount
    || summary()?.totalPatternCount,
  )
  const reviewBatch = createMemo(() => {
    const current = queue()
    if (!current) return []
    return current.due.slice(0, 3)
  })
  createEffect(() => {
    const keys = [
      ...(resource().data?.journey.items.flatMap((event) => event.patternKey ? [event.patternKey] : []) ?? []),
      ...(resource().data?.improving.items.map((pattern) => pattern.patternKey) ?? []),
      ...(summary()?.recentNaturalUse ? [summary()!.recentNaturalUse!.patternKey] : []),
    ]
    if (keys.length) void dashboard.present(keys)
  })

  async function startReview() {
    const active = queue()?.activeReview
    if (active) {
      dashboard.navigate({ view: "review", reviewId: active.id })
      return
    }
    const profile = dashboard.profile()
    if (!profile || reviewBatch().length === 0 || starting()) return
    setStarting(true)
    setStartError("")
    let alive = true
    onCleanup(() => { alive = false })
    const fromRoute = dashboard.route()
    const fromLanguage = profile.targetLanguage
    try {
      const result = await dashboard.context.operations.command<CommandResult<ReviewState>>(
        "review-start",
        {
          targetLanguage: fromLanguage,
          patternKeys: reviewBatch().map((item) => item.patternKey),
          limit: reviewBatch().length,
        },
      )
      if (!alive) return
      if (!result.ok) {
        setStartError(result.error.message)
        return
      }
      if (dashboard.route() !== fromRoute) return
      if (dashboard.profile()?.targetLanguage !== fromLanguage) return
      dashboard.navigate({ view: "review", reviewId: result.data.id })
    } catch (error) {
      if (!alive) return
      setStartError(error instanceof Error ? error.message : copy(dashboard.locale(), "generationFailed"))
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <div class="vld-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "overview")}</p>
          <h1 class="vld-page-title">{greeting(dashboard.locale())}</h1>
          <p class="vld-page-copy">
            {dashboard.locale() === "zh-CN"
              ? "这里记录你在真实工作中使用目标语言的过程。"
              : "This is your history of using the target language in real work."}
          </p>
        </div>
        <div class="vld-page-actions">
          <RefreshButton loading={resource().loading} onRefresh={dashboard.refresh} />
        </div>
      </div>

      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={hasHistory()}
            fallback={
              <EmptyState
                title={copy(dashboard.locale(), "noData")}
                copy={copy(dashboard.locale(), "noDataHelp")}
              />
            }
          >
            <section class="vld-today-practice" aria-label={dashboard.locale() === "zh-CN" ? "今日练习" : "Today's practice"}>
              <div>
                <p class="vld-eyebrow">
                  {dashboard.locale() === "zh-CN" ? "今日练习" : "Today's practice"}
                </p>
                <strong class="vld-today-title">
                  {dashboard.locale() === "zh-CN"
                    ? `今日已检查 ${formatNumber(dashboard.locale(), summary()!.analyzedMessagesToday)} 条消息`
                    : `${formatNumber(dashboard.locale(), summary()!.analyzedMessagesToday)} messages checked today`}
                </strong>
                <p class="vld-today-meta">
                  {dashboard.locale() === "zh-CN"
                    ? `${formatNumber(dashboard.locale(), summary()!.targetAttemptsToday)} 次目标语言表达 · ${formatNumber(dashboard.locale(), summary()!.targetSessionsToday)} 个真实会话 · ${formatNumber(dashboard.locale(), summary()!.correctionsToday)} 次可见纠正 · ${formatNumber(dashboard.locale(), summary()!.acceptedFindingsToday)} 条可信发现`
                    : `${formatNumber(dashboard.locale(), summary()!.targetAttemptsToday)} target-language attempts · ${formatNumber(dashboard.locale(), summary()!.targetSessionsToday)} real sessions · ${formatNumber(dashboard.locale(), summary()!.correctionsToday)} visible corrections · ${formatNumber(dashboard.locale(), summary()!.acceptedFindingsToday)} accepted findings`}
                </p>
              </div>
              <Show when={summary()!.lastAnalyzedAt}>
                <span class="vld-list-meta">
                  {dashboard.locale() === "zh-CN" ? "最后检查：" : "Last checked: "}
                  {formatLastChecked(dashboard.locale(), summary()!.lastAnalyzedAt!)}
                </span>
              </Show>
            </section>

            <section class="vld-panel vld-week-hero" aria-label={copy(dashboard.locale(), "week")}>
              <div>
                <p class="vld-eyebrow">{copy(dashboard.locale(), "week")}</p>
                <div class="vld-week-number">
                  {dashboard.locale() === "zh-CN"
                    ? `第 ${formatNumber(dashboard.locale(), summary()!.learningWeek)} 周`
                    : `Week ${formatNumber(dashboard.locale(), summary()!.learningWeek)}`}
                </div>
                <div class="vld-week-meta">
                  {formatNumber(dashboard.locale(), summary()!.activeDays)} {copy(dashboard.locale(), "activeDays")}
                  {" · "}
                  {formatNumber(dashboard.locale(), summary()!.sessionCount)} {copy(dashboard.locale(), "sessions")}
                  {" · "}
                  {formatNumber(dashboard.locale(), summary()!.targetAttempts)} {copy(dashboard.locale(), "attempts")}
                </div>
                <Show when={summary()!.currentStreakDays > 0}>
                  <div class="vld-streak">
                    <span aria-hidden="true">●</span>
                    {dashboard.locale() === "zh-CN"
                      ? `已连续 ${summary()!.currentStreakDays} 天在真实工作中练习`
                      : `${summary()!.currentStreakDays} consecutive days of real-work practice`}
                  </div>
                </Show>
              </div>
              <div class="vld-heatmap-wrap">
                <div class="vld-heatmap-head">
                  <strong>{copy(dashboard.locale(), "recent30")}</strong>
                  <span class="vld-list-meta">
                    {summary()!.activeDays} {copy(dashboard.locale(), "activeDays")}
                  </span>
                </div>
                <Heatmap points={summary()!.trends["30"]} />
              </div>
            </section>

            <section class="vld-stat-row" aria-label={dashboard.locale() === "zh-CN" ? "学习摘要" : "Learning summary"}>
              <div class="vld-stat">
                <span class="vld-stat-value">{summary()!.targetAttemptsToday}</span>
                <span class="vld-stat-label">{dashboard.locale() === "zh-CN" ? "今日目标语言表达" : "Attempts today"}</span>
              </div>
              <div class="vld-stat">
                <span class="vld-stat-value">{summary()!.targetSessionsToday}</span>
                <span class="vld-stat-label">{dashboard.locale() === "zh-CN" ? "今日活跃会话" : "Active sessions today"}</span>
              </div>
              <div class="vld-stat">
                <span class="vld-stat-value">{summary()!.candidatePatternCount}</span>
                <span class="vld-stat-label">{dashboard.locale() === "zh-CN" ? "观察中的模式" : "Candidate patterns"}</span>
              </div>
              <div class="vld-stat">
                <span class="vld-stat-value">{summary()!.duePatternCount}</span>
                <span class="vld-stat-label">{copy(dashboard.locale(), "dueNow")}</span>
              </div>
            </section>

            <section class="vld-section">
              <div class="vld-section-head">
                <div>
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "evidence")}</h2>
                  <p class="vld-section-copy">{copy(dashboard.locale(), "evidenceHelp")}</p>
                </div>
                <div class="vld-range-tabs" role="group" aria-label={dashboard.locale() === "zh-CN" ? "时间范围" : "Time range"}>
                  <For each={["7", "30", "90"] as const}>
                    {(value) => (
                      <button
                        class="vld-chip"
                        data-active={range() === value}
                        type="button"
                        onClick={() => setRange(value)}
                      >
                        {copy(dashboard.locale(), `range${value}`)}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <div class="vld-panel vld-panel-pad">
                <EvidenceChart points={summary()!.trends[range()]} />
              </div>
            </section>

            <div class="vld-grid vld-grid-overview vld-section">
              <section>
                <div class="vld-section-head">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "recentJourney")}</h2>
                  <button class="vld-link-button" type="button" onClick={() => dashboard.navigate({ view: "journey" })}>
                    {copy(dashboard.locale(), "viewAll")} →
                  </button>
                </div>
                <div class="vld-panel vld-panel-pad">
                  <ul class="vld-list">
                    <For each={resource().data!.journey.items.slice(0, 4)}>
                      {(event) => {
                        const kind = event.type.includes("review")
                          ? "review"
                          : event.type.includes("pattern")
                            ? "pattern"
                            : "work"
                        return (
                          <li>
                            <button
                              type="button"
                              class="vld-menu-item"
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
                </div>
              </section>

              <aside class="vld-grid">
                <section class="vld-panel vld-panel-pad vld-review-callout">
                  <div>
                    <p class="vld-eyebrow">{copy(dashboard.locale(), "next")}</p>
                    <Show
                      when={queue()?.activeReview}
                      fallback={
                        <Show
                          when={reviewBatch().length > 0}
                          fallback={
                            <>
                              <h2 class="vld-callout-value">{copy(dashboard.locale(), "allCaughtUp")}</h2>
                              <p class="vld-callout-copy">{copy(dashboard.locale(), "allCaughtUpHelp")}</p>
                            </>
                          }
                        >
                          <h2 class="vld-callout-value">
                            {dashboard.locale() === "zh-CN"
                              ? `${reviewBatch().length} 个模式可以复习`
                              : `${reviewBatch().length} patterns ready`}
                          </h2>
                          <p class="vld-callout-copy">
                            {reviewBatch().filter((item) => item.overdueDays === 0 && item.dueAt > Date.now()).length > 0
                              ? copy(dashboard.locale(), "earlyPractice")
                              : copy(dashboard.locale(), "reviewQueueHelp")}
                          </p>
                        </Show>
                      }
                    >
                      <h2 class="vld-callout-value">{copy(dashboard.locale(), "resumeReview")}</h2>
                      <p class="vld-callout-copy">
                        {dashboard.locale() === "zh-CN" ? "你上次的复习仍保留在原来的位置。" : "Your previous review is saved at the same place."}
                      </p>
                    </Show>
                  </div>
                  <Show when={queue()?.activeReview || reviewBatch().length > 0}>
                    <button class="vld-primary" type="button" disabled={starting()} onClick={() => void startReview()}>
                      {queue()?.activeReview
                        ? copy(dashboard.locale(), "resumeReview")
                        : starting()
                          ? copy(dashboard.locale(), "loading")
                          : copy(dashboard.locale(), "startReview")}
                      <span aria-hidden="true">→</span>
                    </button>
                  </Show>
                  <Show when={startError()}><p class="vld-error">{startError()}</p></Show>
                </section>

                <section class="vld-soft-panel">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "recentNatural")}</h2>
                  <Show
                    when={summary()!.recentNaturalUse}
                    fallback={<p class="vld-section-copy">{copy(dashboard.locale(), "noRecentNatural")}</p>}
                  >
                    {(item) => (
                      <>
                        <div style={{ "margin-top": "14px" }}>
                          <PatternText
                            patternKey={item().patternKey}
                            label={item().label}
                          />
                        </div>
                        <p class="vld-pattern-rule">“{item().fragment}”</p>
                        <p class="vld-section-copy">{formatDate(dashboard.locale(), item().observedAt)}</p>
                      </>
                    )}
                  </Show>
                  <Show when={resource().data!.improving.items[0]}>
                    {(pattern) => (
                      <div style={{ "margin-top": "20px" }}>
                        <p class="vld-eyebrow">{copy(dashboard.locale(), "improving")}</p>
                        <PatternText
                          patternKey={pattern().patternKey}
                          label={pattern().label}
                          rule={pattern().rule}
                          showRule
                        />
                      </div>
                    )}
                  </Show>
                </section>
              </aside>
            </div>
          </Show>
        </Show>
      </Show>
    </>
  )
}

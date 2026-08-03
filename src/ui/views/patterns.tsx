import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
} from "solid-js"
import type {
  LearningPatternsOutput,
  LearningSummaryOutput,
  PatternDetailOutput,
} from "../../application/dashboard-contracts"
import type { CommandResult, ProgressPattern, ReviewState, TrendPoint } from "../../domain/types"
import { useDashboard } from "../app-context"
import {
  Dialog,
  EmptyState,
  ErrorBlock,
  EvidenceChart,
  LoadingBlock,
  Pagination,
  PatternText,
  RefreshButton,
  StatusBadge,
} from "../components"
import {
  copy,
  reviewErrorMessage,
  formatDate,
  formatRelativeDate,
  outcomeLabel,
} from "../i18n"
import { createAbortableResource } from "../resource"

type StatusFilter = "" | "new" | "focus" | "improving" | "verified" | "ignored" | "rejected"
type PatternSort = "priority" | "recent" | "frequency" | "due"

export const PatternsView: Component = () => {
  const dashboard = useDashboard()
  const [query, setQuery] = createSignal("")
  const [appliedQuery, setAppliedQuery] = createSignal("")
  const [status, setStatus] = createSignal<StatusFilter>("")
  const [scope, setScope] = createSignal<"all" | "current">("all")
  const [sort, setSort] = createSignal<PatternSort>("priority")
  const [cursors, setCursors] = createSignal<Array<string | undefined>>([undefined])
  const [pageIndex, setPageIndex] = createSignal(0)

  createEffect(() => {
    query()
    const timer = setTimeout(() => setAppliedQuery(query().trim()), 250)
    onCleanup(() => clearTimeout(timer))
  })
  createEffect(() => {
    appliedQuery()
    status()
    scope()
    sort()
    setCursors([undefined])
    setPageIndex(0)
  })

  const resource = createAbortableResource<LearningPatternsOutput>(
    () => [
      dashboard.profile()?.targetLanguage,
      dashboard.refreshVersion(),
      appliedQuery(),
      status(),
      scope(),
      sort(),
      cursors()[pageIndex()],
    ],
    (signal) => dashboard.context.operations.query(
      "learning-patterns",
      {
        targetLanguage: dashboard.profile()?.targetLanguage,
        scope: scope(),
        timeZone: dashboard.timeZone,
        query: appliedQuery() || undefined,
        status: status() || undefined,
        sort: sort(),
        cursor: cursors()[pageIndex()],
        limit: 20,
      },
      { signal },
    ),
  )
  const summaryResource = createAbortableResource<LearningSummaryOutput>(
    () => [
      dashboard.profile()?.targetLanguage,
      dashboard.refreshVersion(),
      scope(),
    ],
    (signal) => dashboard.context.operations.query(
      "learning-summary",
      {
        targetLanguage: dashboard.profile()?.targetLanguage,
        scope: scope(),
        timeZone: dashboard.timeZone,
      },
      { signal },
    ),
  )
  createEffect(() => {
    const keys = resource().data?.items.map((item) => item.patternKey) ?? []
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
      <div class="vld-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "patterns")}</p>
          <h1 class="vld-page-title">{copy(dashboard.locale(), "patterns")}</h1>
          <p class="vld-page-copy">
            {dashboard.locale() === "zh-CN"
              ? "从真实工作表达中整理出的个人学习档案。"
              : "A personal learning record built from real work expressions."}
          </p>
        </div>
        <div class="vld-page-actions">
          <RefreshButton loading={resource().loading || summaryResource().loading} onRefresh={dashboard.refresh} />
        </div>
      </div>

      <div class="vld-toolbar">
        <div class="vld-search">
          <input
            class="vld-input"
            type="search"
            value={query()}
            placeholder={copy(dashboard.locale(), "searchPatterns")}
            aria-label={copy(dashboard.locale(), "searchPatterns")}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <div class="vld-filter-row" aria-label={copy(dashboard.locale(), "filters")}>
          <select aria-label={copy(dashboard.locale(), "allStatuses")} class="vld-select" value={status()} onChange={(event) => setStatus(event.currentTarget.value as StatusFilter)}>
            <option value="">{copy(dashboard.locale(), "allStatuses")}</option>
            <option value="new">{dashboard.locale() === "zh-CN" ? "新模式" : "New"}</option>
            <option value="focus">{dashboard.locale() === "zh-CN" ? "重点" : "Focus"}</option>
            <option value="improving">{copy(dashboard.locale(), "improving")}</option>
            <option value="verified">{copy(dashboard.locale(), "verified")}</option>
            <option value="ignored">{dashboard.locale() === "zh-CN" ? "已忽略" : "Ignored"}</option>
            <option value="rejected">{dashboard.locale() === "zh-CN" ? "非错误" : "Not an error"}</option>
          </select>
          <select aria-label={copy(dashboard.locale(), "scope")} class="vld-select" value={scope()} onChange={(event) => setScope(event.currentTarget.value as "all" | "current")}>
            <option value="all">{copy(dashboard.locale(), "allScopes")}</option>
            <option value="current">{copy(dashboard.locale(), "currentScope")}</option>
          </select>
          <select aria-label={dashboard.locale() === "zh-CN" ? "排序方式" : "Sort order"} class="vld-select" value={sort()} onChange={(event) => setSort(event.currentTarget.value as PatternSort)}>
            <option value="priority">{copy(dashboard.locale(), "priority")}</option>
            <option value="recent">{copy(dashboard.locale(), "recent")}</option>
            <option value="frequency">{copy(dashboard.locale(), "frequency")}</option>
            <option value="due">{copy(dashboard.locale(), "due")}</option>
          </select>
        </div>
      </div>

      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={(resource().data?.items.length ?? 0) > 0}
            fallback={
              <EmptyState
                title={copy(dashboard.locale(), "noPatterns")}
                copy={appliedQuery() || status() || scope() === "current"
                  ? copy(dashboard.locale(), "noPatternsHelp")
                  : dashboard.locale() === "zh-CN"
                    ? `今天已经完成 ${summaryResource().data?.targetAttemptsToday ?? 0} 次目标语言表达。暂时还没有足够可信的学习模式。`
                    : `You have made ${summaryResource().data?.targetAttemptsToday ?? 0} target-language attempts today. There are not enough trustworthy signals for a learning pattern yet.`}
              />
            }
          >
            <div class="vld-panel vld-table-wrap">
              <table class="vld-table">
                <thead>
                  <tr>
                    <th style={{ width: "44%" }}>{copy(dashboard.locale(), "pattern")}</th>
                    <th style={{ width: "14%" }}>{copy(dashboard.locale(), "status")}</th>
                    <th style={{ width: "14%" }}>{copy(dashboard.locale(), "frequency")}</th>
                    <th style={{ width: "14%" }}>{copy(dashboard.locale(), "scope")}</th>
                    <th style={{ width: "14%" }}>{copy(dashboard.locale(), "lastSeen")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={resource().data!.items}>
                    {(pattern) => (
                      <tr
                        data-clickable="true"
                        tabindex="0"
                        onClick={() => dashboard.navigate({ view: "pattern", patternKey: pattern.patternKey })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") dashboard.navigate({ view: "pattern", patternKey: pattern.patternKey })
                        }}
                      >
                        <td>
                          <PatternText
                            patternKey={pattern.patternKey}
                            label={pattern.label}
                            rule={pattern.rule}
                            showRule
                          />
                        </td>
                        <td><StatusBadge status={pattern.disposition === "active" ? pattern.displayStatus : pattern.disposition} /></td>
                        <td>
                          <span class="vld-number-main">{pattern.occurrenceCount}</span>
                          <span class="vld-number-sub">{copy(dashboard.locale(), "occurrences")}</span>
                        </td>
                        <td>
                          <span class="vld-number-main">{pattern.sessionCount}</span>
                          <span class="vld-number-sub">{copy(dashboard.locale(), "sessionsCount")}</span>
                        </td>
                        <td>
                          <span class="vld-number-main">{formatRelativeDate(dashboard.locale(), pattern.lastSeenAt)}</span>
                          <Show when={pattern.dueAt}>
                            <span class="vld-number-sub">{copy(dashboard.locale(), "due")}: {formatRelativeDate(dashboard.locale(), pattern.dueAt!)}</span>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            <div class="vld-card-list">
              <For each={resource().data!.items}>
                {(pattern) => (
                  <article
                    class="vld-pattern-card"
                    tabindex="0"
                    onClick={() => dashboard.navigate({ view: "pattern", patternKey: pattern.patternKey })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") dashboard.navigate({ view: "pattern", patternKey: pattern.patternKey })
                    }}
                  >
                    <div class="vld-pattern-card-top">
                      <div>
                        <PatternText
                          patternKey={pattern.patternKey}
                          label={pattern.label}
                          rule={pattern.rule}
                          showRule
                        />
                      </div>
                      <StatusBadge status={pattern.disposition === "active" ? pattern.displayStatus : pattern.disposition} />
                    </div>
                    <div class="vld-pattern-card-meta">
                      <span>{pattern.occurrenceCount} {copy(dashboard.locale(), "occurrences")}</span>
                      <span>{pattern.sessionCount} {copy(dashboard.locale(), "sessionsCount")}</span>
                      <span>{formatRelativeDate(dashboard.locale(), pattern.lastSeenAt)}</span>
                    </div>
                  </article>
                )}
              </For>
            </div>
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

export const PatternDetailView: Component<{ patternKey: string }> = (props) => {
  const dashboard = useDashboard()
  const [mergeOpen, setMergeOpen] = createSignal(false)
  const [mergeQuery, setMergeQuery] = createSignal("")
  const [mutating, setMutating] = createSignal(false)
  const [reviewStarting, setReviewStarting] = createSignal(false)
  const [actionError, setActionError] = createSignal("")
  const resource = createAbortableResource<PatternDetailOutput>(
    () => [dashboard.profile()?.targetLanguage, props.patternKey, dashboard.refreshVersion()],
    (signal) => dashboard.context.operations.query(
      "learning-pattern-detail",
      {
        targetLanguage: dashboard.profile()?.targetLanguage,
        patternKey: props.patternKey,
        scope: "all",
        timeZone: dashboard.timeZone,
        days: 30,
      },
      { signal },
    ),
  )
  const mergeCandidates = createAbortableResource<LearningPatternsOutput>(
    () => [mergeOpen(), mergeQuery(), dashboard.refreshVersion()],
    async (signal) => {
      if (!mergeOpen()) return { items: [] }
      return dashboard.context.operations.query(
        "learning-patterns",
        {
          targetLanguage: dashboard.profile()?.targetLanguage,
          query: mergeQuery() || undefined,
          sort: "priority",
          limit: 20,
        },
        { signal },
      )
    },
  )

  const pattern = () => resource().data?.pattern
  createEffect(() => void dashboard.present([props.patternKey]))
  const trend = createMemo<TrendPoint[]>(() => (resource().data?.trend ?? []).map((point) => ({
    date: point.date,
    targetAttempts: 0,
    findings: point.errors,
    naturalCorrectUses: point.naturalCorrectUses,
    independentReviews: point.independentReviews,
  })))

  async function command(
    input:
      | { action: "ignore" | "restore" | "not_error" | "delete"; patternKey: string }
      | { action: "merge"; sourceKey: string; targetKey: string },
  ) {
    if (mutating()) return
    setMutating(true)
    setActionError("")
    try {
      const result = await dashboard.context.operations.command<CommandResult<ProgressPattern | undefined>>(
        "pattern-command",
        { ...input, targetLanguage: dashboard.profile()?.targetLanguage },
      )
      if (!result.ok) throw new Error(reviewErrorMessage(dashboard.locale(), result.error.code, result.error.message))
      if (input.action === "delete" || input.action === "not_error" || input.action === "merge") {
        dashboard.navigate({ view: "patterns" })
      } else {
        dashboard.refresh()
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy(dashboard.locale(), "actionFailed"))
    } finally {
      setMutating(false)
      setMergeOpen(false)
    }
  }

  async function confirmDestructive(action: "not_error" | "delete") {
    const isDelete = action === "delete"
    const confirmed = await dashboard.context.host.confirm({
      title: isDelete
        ? dashboard.locale() === "zh-CN" ? "删除这个学习模式？" : "Delete this learning pattern?"
        : dashboard.locale() === "zh-CN" ? "标记为“不是错误”？" : "Mark this as not an error?",
      message: isDelete
        ? dashboard.locale() === "zh-CN"
          ? "具体证据、复习历史和显示文案都会被删除，之后仍可能再次发现。"
          : "Evidence, review history, and presentation copy will be deleted. It may be discovered again."
        : dashboard.locale() === "zh-CN"
          ? "具体学习证据会被删除，并阻止分析器再次创建这个模式。"
          : "Learning evidence will be deleted and the analyzer will suppress this pattern.",
      confirmLabel: isDelete ? copy(dashboard.locale(), "delete") : copy(dashboard.locale(), "notError"),
    })
    if (confirmed) await command({ action, patternKey: props.patternKey })
  }

  async function startPatternReview() {
    const active = dashboard.profile()
    if (!active || !pattern()) return
    setMutating(true)
    setReviewStarting(true)
    try {
      const result = await dashboard.context.operations.command<CommandResult<ReviewState>>(
        "review-start",
        {
          targetLanguage: active.targetLanguage,
          patternKeys: [props.patternKey],
          limit: 1,
        },
      )
      if (!result.ok) throw new Error(result.error.message)
      dashboard.navigate({ view: "review", reviewId: result.data.id })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy(dashboard.locale(), "actionFailed"))
    } finally {
      setReviewStarting(false)
      setMutating(false)
    }
  }

  async function confirmMerge(targetKey: string) {
    setMergeOpen(false)
    const confirmed = await dashboard.context.host.confirm({
      title: dashboard.locale() === "zh-CN" ? "合并这两个学习模式？" : "Merge these learning patterns?",
      message: dashboard.locale() === "zh-CN"
        ? "当前模式的证据、复习记录和别名会并入目标模式，之后会重新计算学习状态。"
        : "Evidence, review history, and aliases will move into the target pattern, then learning state will be recalculated.",
      confirmLabel: copy(dashboard.locale(), "confirmMerge"),
    })
    if (confirmed) {
      await command({
        action: "merge",
        sourceKey: props.patternKey,
        targetKey,
      })
    }
  }

  return (
    <>
      <button class="vld-back" type="button" onClick={() => dashboard.navigate({ view: "patterns" })}>
        <span aria-hidden="true">←</span> {copy(dashboard.locale(), "backToPatterns")}
      </button>
      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={resource().data?.found && pattern()}
            fallback={
              <EmptyState
                title={dashboard.locale() === "zh-CN" ? "没有找到这个模式" : "Pattern not found"}
                copy={copy(dashboard.locale(), "noPatternsHelp")}
                action={
                  <button class="vld-secondary" type="button" onClick={() => dashboard.navigate({ view: "patterns" })}>
                    {copy(dashboard.locale(), "backToPatterns")}
                  </button>
                }
              />
            }
          >
            <section class="vld-detail-hero">
              <div>
                <p class="vld-eyebrow">{copy(dashboard.locale(), "pattern")}</p>
                <h1 class="vld-page-title">
                  {dashboard.presentation(props.patternKey)?.label ?? pattern()!.label}
                </h1>
                <p class="vld-page-copy">
                  {dashboard.presentation(props.patternKey)?.rule ?? pattern()!.rule}
                </p>
              </div>
              <div class="vld-detail-stats">
                <div class="vld-detail-stat">
                  <strong>{pattern()!.occurrenceCount}</strong>
                  <span>{copy(dashboard.locale(), "occurrences")}</span>
                </div>
                <div class="vld-detail-stat">
                  <strong>{pattern()!.sessionCount}</strong>
                  <span>{copy(dashboard.locale(), "sessionsCount")}</span>
                </div>
                <div class="vld-detail-stat">
                  <StatusBadge status={
                    pattern()!.disposition === "active"
                      ? pattern()!.displayStatus
                      : pattern()!.disposition as "ignored" | "rejected"
                  } />
                </div>
              </div>
            </section>

            <Show when={actionError()}><div class="vld-error vld-section">{actionError()}</div></Show>

            <div class="vld-detail-grid">
              <div class="vld-grid">
                <section class="vld-panel vld-detail-section">
                  <div class="vld-section-head">
                    <div>
                      <h2 class="vld-section-title">{copy(dashboard.locale(), "evidence")}</h2>
                      <p class="vld-section-copy">{copy(dashboard.locale(), "evidenceHelp")}</p>
                    </div>
                  </div>
                  <EvidenceChart points={trend()} />
                </section>

                <section class="vld-panel vld-detail-section">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "evidenceTimeline")}</h2>
                  <For each={resource().data!.evidenceTimeline}>
                    {(evidence) => (
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <strong>
                            {evidence.kind === "error"
                              ? copy(dashboard.locale(), "findings")
                              : evidence.kind === "natural_correct"
                                ? copy(dashboard.locale(), "naturalUses")
                                : copy(dashboard.locale(), "review")}
                          </strong>
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

                <section class="vld-panel vld-detail-section">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "reviewHistory")}</h2>
                  <Show
                    when={resource().data!.reviewHistory.length > 0}
                    fallback={<p class="vld-section-copy">{dashboard.locale() === "zh-CN" ? "还没有复习记录。" : "No review history yet."}</p>}
                  >
                    <For each={resource().data!.reviewHistory}>
                      {(review) => (
                        <div class="vld-evidence-row">
                          <div class="vld-evidence-top">
                            <strong>{review.outcome ? outcomeLabel(dashboard.locale(), review.outcome) : review.status}</strong>
                            <span class="vld-list-meta">{formatDate(dashboard.locale(), review.completedAt ?? review.startedAt)}</span>
                          </div>
                          <p class="vld-evidence-copy">
                            {review.latestAnswer ?? review.challenge ?? copy(dashboard.locale(), "contentNotRetained")}
                          </p>
                        </div>
                      )}
                    </For>
                  </Show>
                </section>
              </div>

              <aside class="vld-grid">
                <section class="vld-soft-panel">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "schedule")}</h2>
                  <p class="vld-callout-value">
                    {pattern()!.dueAt
                      ? formatRelativeDate(dashboard.locale(), pattern()!.dueAt!)
                      : pattern()!.stage === "verified"
                        ? copy(dashboard.locale(), "verified")
                        : "—"}
                  </p>
                  <p class="vld-section-copy">
                    {dashboard.locale() === "zh-CN"
                      ? `当前间隔阶梯：${pattern()!.scheduleStep + 1} / 5`
                      : `Current interval step: ${pattern()!.scheduleStep + 1} / 5`}
                  </p>
                  <Show when={
                    pattern()!.disposition === "active"
                    && pattern()!.stage === "practicing"
                    && pattern()!.dueAt
                    && pattern()!.dueAt! <= Date.now() + 7 * 86_400_000
                  }>
                    <button class="vld-primary vld-full-button" style={{ "margin-top": "16px" }} type="button" disabled={mutating()} aria-busy={reviewStarting()} onClick={() => void startPatternReview()}>
                      {reviewStarting() ? copy(dashboard.locale(), "preparingFirstReview") : copy(dashboard.locale(), "review")}
                    </button>
                  </Show>
                </section>

                <section class="vld-panel vld-detail-section">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "workContexts")}</h2>
                  <For each={resource().data!.contexts}>
                    {(context) => (
                      <div class="vld-evidence-row">
                        <div class="vld-evidence-top">
                          <strong>{context.scopeId}</strong>
                          <span class="vld-list-meta">{context.evidenceCount}</span>
                        </div>
                        <p class="vld-evidence-copy">
                          {context.sessionCount} {copy(dashboard.locale(), "sessionsCount")}
                          {" · "}
                          {context.naturalCorrectCount} {copy(dashboard.locale(), "naturalUses")}
                        </p>
                      </div>
                    )}
                  </For>
                </section>

                <section class="vld-panel vld-detail-section">
                  <h2 class="vld-section-title">{copy(dashboard.locale(), "patternActions")}</h2>
                  <div class="vld-action-list">
                    <Show
                      when={pattern()!.disposition === "ignored"}
                      fallback={
                        <button class="vld-secondary" type="button" disabled={mutating()} onClick={() => void command({ action: "ignore", patternKey: props.patternKey })}>
                          {copy(dashboard.locale(), "ignore")}
                        </button>
                      }
                    >
                      <button class="vld-secondary" type="button" disabled={mutating()} onClick={() => void command({ action: "restore", patternKey: props.patternKey })}>
                        {copy(dashboard.locale(), "restore")}
                      </button>
                    </Show>
                    <button class="vld-secondary" type="button" disabled={mutating()} onClick={() => setMergeOpen(true)}>
                      {copy(dashboard.locale(), "merge")}
                    </button>
                    <button class="vld-secondary" type="button" disabled={mutating()} onClick={() => void confirmDestructive("not_error")}>
                      {copy(dashboard.locale(), "notError")}
                    </button>
                    <button class="vld-danger" type="button" disabled={mutating()} onClick={() => void confirmDestructive("delete")}>
                      {copy(dashboard.locale(), "delete")}
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={mergeOpen()}>
        <Dialog
          title={copy(dashboard.locale(), "mergeInto")}
          copy={dashboard.locale() === "zh-CN" ? "历史证据和复习记录会合并到你选择的模式。" : "Evidence and review history will move to the selected pattern."}
          onClose={() => setMergeOpen(false)}
        >
          <input
            class="vld-input"
            type="search"
            value={mergeQuery()}
            placeholder={copy(dashboard.locale(), "searchPatterns")}
            aria-label={copy(dashboard.locale(), "searchPatterns")}
            onInput={(event) => setMergeQuery(event.currentTarget.value)}
          />
          <div class="vld-action-list">
            <For each={mergeCandidates().data?.items.filter((item) => item.patternKey !== props.patternKey) ?? []}>
              {(candidate) => (
                <button
                  class="vld-menu-item"
                  type="button"
                  disabled={mutating()}
                  onClick={() => void confirmMerge(candidate.patternKey)}
                >
                  <span>
                    <PatternText
                      patternKey={candidate.patternKey}
                      label={candidate.label}
                      rule={candidate.rule}
                      showRule
                    />
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </For>
          </div>
          <div class="vld-dialog-actions">
            <button class="vld-secondary" type="button" onClick={() => setMergeOpen(false)}>
              {copy(dashboard.locale(), "cancel")}
            </button>
          </div>
        </Dialog>
      </Show>
    </>
  )
}

import {
  onCleanup,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type Component,
} from "solid-js"
import type {
  ReviewQueueOutput,
  ReviewStateOutput,
  LearningSummaryOutput,
} from "../../application/dashboard-contracts"
import type {
  CommandResult,
  ReviewState,
} from "../../domain/types"
import { useDashboard } from "../app-context"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PatternText,
  RefreshButton,
} from "../components"
import {
  copy,
  formatRelativeDate,
  outcomeLabel,
} from "../i18n"
import { createAbortableResource } from "../resource"

type ReviewData = {
  queue: ReviewQueueOutput
  summary: LearningSummaryOutput
  state?: ReviewState
}

type CommandAction = "submit_answer" | "request_hint" | "next_item" | "pause" | "resume" | "abandon"

export const ReviewView: Component<{ reviewId?: string }> = (props) => {
  const dashboard = useDashboard()
  const [stateOverride, setStateOverride] = createSignal<ReviewState>()
  const [answer, setAnswer] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")
  let retryReceipt: { fingerprint: string; requestId: string } | undefined

  const resource = createAbortableResource<ReviewData>(
    () => [
      dashboard.profile()?.targetLanguage,
      props.reviewId,
      dashboard.refreshVersion(),
    ],
    async (signal) => {
      const targetLanguage = dashboard.profile()?.targetLanguage
      const [queue, review, summary] = await Promise.all([
        dashboard.context.operations.query<ReviewQueueOutput>(
          "review-queue",
          { targetLanguage, scope: "all", timeZone: dashboard.timeZone, limit: 3 },
          { signal },
        ),
        dashboard.context.operations.query<ReviewStateOutput>(
          "review-state",
          { targetLanguage, reviewId: props.reviewId },
          { signal },
        ),
        dashboard.context.operations.query<LearningSummaryOutput>(
          "learning-summary",
          { targetLanguage, scope: "all", timeZone: dashboard.timeZone },
          { signal },
        ),
      ])
      return { queue, summary, state: review.state }
    },
  )

  const state = () => stateOverride() ?? resource().data?.state
  const batch = createMemo(() => {
    const queue = resource().data?.queue
    return queue ? queue.due.slice(0, 3) : []
  })

  createEffect(() => {
    resource().data?.state?.revision
    setStateOverride(undefined)
  })
  createEffect(() => {
    state()?.currentItem?.id
    state()?.currentItem?.stage
    setAnswer("")
    setError("")
    retryReceipt = undefined
  })
  createEffect(() => {
    const keys = [
      ...(state()?.completedItems.map((item) => item.patternKey) ?? []),
      ...(state()?.currentItem ? [state()!.currentItem!.patternKey] : []),
      ...batch().map((item) => item.patternKey),
    ]
    if (keys.length) void dashboard.present(keys)
  })

  function requestId(fingerprint: string): string {
    if (retryReceipt?.fingerprint === fingerprint) return retryReceipt.requestId
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    retryReceipt = { fingerprint, requestId: id }
    return id
  }

  async function startReview() {
    const profile = dashboard.profile()
    if (!profile || batch().length === 0 || busy()) return
    setBusy(true)
    setError("")
    let alive = true
    onCleanup(() => { alive = false })
    const fromRoute = dashboard.route()
    const fromLanguage = profile.targetLanguage
    try {
      const result = await dashboard.context.operations.command<CommandResult<ReviewState>>(
        "review-start",
        {
          targetLanguage: fromLanguage,
          patternKeys: batch().map((item) => item.patternKey),
          limit: batch().length,
        },
      )
      if (!alive) return
      if (!result.ok) throw new Error(result.error.message)
      if (dashboard.route() !== fromRoute) return
      if (dashboard.profile()?.targetLanguage !== fromLanguage) return
      setStateOverride(result.data)
      dashboard.navigate({ view: "review", reviewId: result.data.id })
    } catch (failure) {
      if (!alive) return
      setError(failure instanceof Error ? failure.message : copy(dashboard.locale(), "generationFailed"))
    } finally {
      setBusy(false)
    }
  }

  async function command(action: CommandAction, submittedAnswer?: string): Promise<boolean> {
    const current = state()
    const profile = dashboard.profile()
    if (!current || !profile || busy()) return false
    const fingerprint = `${action}:${current.id}:${current.revision}:${submittedAnswer ?? ""}`
    setBusy(true)
    setError("")
    try {
      const result = await dashboard.context.operations.command<CommandResult<ReviewState>>(
        "review-command",
        {
          action,
          targetLanguage: profile.targetLanguage,
          reviewId: current.id,
          requestId: requestId(fingerprint),
          expectedRevision: current.revision,
          ...(action === "submit_answer" ? { answer: submittedAnswer } : {}),
        },
      )
      if (!result.ok) {
        if (result.error.code === "CONFLICT") {
          setError(copy(dashboard.locale(), "conflict"))
          retryReceipt = undefined
          dashboard.refresh()
          return false
        }
        const friendly = result.error.code === "GENERATION_FAILED"
          ? copy(dashboard.locale(), "generationFailed")
          : result.error.code === "EVALUATION_FAILED"
            ? copy(dashboard.locale(), "evaluationFailed")
            : result.error.message
        setError(friendly)
        if (!result.error.retryable) retryReceipt = undefined
        return false
      }
      retryReceipt = undefined
      setStateOverride(result.data)
      if (action === "pause") {
        dashboard.navigate({ view: "overview" })
      }
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : copy(dashboard.locale(), "actionFailed"))
      // Keep the same request ID so a user retry remains idempotent.
      return false
    } finally {
      setBusy(false)
    }
  }

  async function abandon() {
    const confirmed = await dashboard.context.host.confirm({
      title: dashboard.locale() === "zh-CN" ? "结束本次复习？" : "End this review?",
      message: dashboard.locale() === "zh-CN"
        ? "未完成的模式会在明天重新到期，不会记录成功证据。"
        : "Unfinished patterns will be due again tomorrow and no success evidence will be recorded.",
      confirmLabel: copy(dashboard.locale(), "endReview"),
    })
    if (confirmed) {
      if (await command("abandon")) dashboard.navigate({ view: "overview" })
    }
  }

  function submit() {
    const value = answer().trim()
    if (!value) return
    void command("submit_answer", value)
  }

  const stageTitle = () => {
    const stage = state()?.currentItem?.stage
    if (stage === "awaiting_repair") return copy(dashboard.locale(), "repair")
    if (stage === "awaiting_transfer") return copy(dashboard.locale(), "transfer")
    if (stage === "item_completed") return copy(dashboard.locale(), "feedback")
    return copy(dashboard.locale(), "yourAnswer")
  }

  return (
    <>
      <div class="vld-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "review")}</p>
          <h1 class="vld-page-title">
            {state()?.status === "completed"
              ? copy(dashboard.locale(), "reviewComplete")
              : copy(dashboard.locale(), "reviewQueue")}
          </h1>
          <p class="vld-page-copy">{copy(dashboard.locale(), "reviewQueueHelp")}</p>
        </div>
        <div class="vld-page-actions">
          <RefreshButton loading={resource().loading} onRefresh={dashboard.refresh} />
        </div>
      </div>

      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show
            when={state()}
            fallback={
              <Show
                when={batch().length > 0}
                fallback={
                  <EmptyState
                    title={copy(dashboard.locale(), "allCaughtUp")}
                    copy={dashboard.locale() === "zh-CN"
                      ? `当前没有到期复习。今天已完成 ${resource().data?.summary.targetAttemptsToday ?? 0} 次目标语言表达，${resource().data?.summary.candidatePatternCount ?? 0} 个模式仍在观察中。`
                      : `Nothing is due now. You have made ${resource().data?.summary.targetAttemptsToday ?? 0} target-language attempts today, with ${resource().data?.summary.candidatePatternCount ?? 0} candidate patterns still being observed.`}
                    action={
                      <button class="vld-secondary" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>
                        {copy(dashboard.locale(), "overview")}
                      </button>
                    }
                  />
                }
              >
                <div
                  class="vld-review-layout"
                  data-single={resource().data!.queue.upcoming.length === 0}
                >
                  <section class="vld-panel vld-review-stage">
                    <p class="vld-eyebrow">{copy(dashboard.locale(), "reviewQueue")}</p>
                    <h2 class="vld-review-question">
                      {dashboard.locale() === "zh-CN"
                        ? `${batch().length} 个模式可以复习`
                        : `${batch().length} patterns are ready`}
                    </h2>
                    <p class="vld-review-instruction">
                      {dashboard.locale() === "zh-CN"
                        ? "每个模式都来自你的真实表达，先回忆，再在新场景里使用。"
                        : "Each pattern comes from your real expression: recall it first, then use it in a new situation."}
                    </p>
                    <div class="vld-queue-list" style={{ "margin-top": "28px" }}>
                      <For each={batch()}>
                        {(item) => (
                          <div class="vld-queue-item">
                            <PatternText patternKey={item.patternKey} label={item.label} />
                            <span>
                              {item.dueAt > Date.now()
                                ? `${copy(dashboard.locale(), "earlyPractice")} · ${formatRelativeDate(dashboard.locale(), item.dueAt)}`
                                : item.overdueDays > 0
                                  ? dashboard.locale() === "zh-CN" ? `已逾期 ${item.overdueDays} 天` : `${item.overdueDays} days overdue`
                                  : copy(dashboard.locale(), "dueNow")}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                    <Show when={error()}><div class="vld-error" style={{ "margin-top": "18px" }}>{error()}</div></Show>
                    <button class="vld-primary" style={{ "margin-top": "26px" }} type="button" disabled={busy()} onClick={() => void startReview()}>
                      {busy() ? copy(dashboard.locale(), "loading") : copy(dashboard.locale(), "startReview")} →
                    </button>
                  </section>
                  <Show when={resource().data!.queue.upcoming.length > 0}>
                    <aside class="vld-soft-panel">
                      <h2 class="vld-section-title">{copy(dashboard.locale(), "upcoming")}</h2>
                      <p class="vld-section-copy">{copy(dashboard.locale(), "manualReviewNote")}</p>
                      <div class="vld-queue-list">
                        <For each={resource().data!.queue.upcoming}>
                          {(item) => (
                            <div class="vld-queue-item">
                              <PatternText patternKey={item.patternKey} label={item.label} />
                              <span>{formatRelativeDate(dashboard.locale(), item.dueAt)}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </aside>
                  </Show>
                </div>
              </Show>
            }
          >
            {(review) => (
              <Show
                when={review().status !== "abandoned"}
                fallback={
                  <EmptyState
                    title={dashboard.locale() === "zh-CN" ? "这次复习已经结束" : "This review has ended"}
                    copy={dashboard.locale() === "zh-CN" ? "未完成的模式会按照复习安排再次出现。" : "Unfinished patterns will return according to the review schedule."}
                    action={
                      <button class="vld-primary" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>
                        {copy(dashboard.locale(), "overview")}
                      </button>
                    }
                  />
                }
              >
              <Show
                when={review().status !== "completed"}
                fallback={<ReviewComplete state={review()} />}
              >
                <Show
                  when={review().status !== "paused"}
                  fallback={
                    <section class="vld-panel vld-empty">
                      <div class="vld-empty-inner">
                        <h2 class="vld-empty-title">{dashboard.locale() === "zh-CN" ? "复习已暂停" : "Review paused"}</h2>
                        <p class="vld-empty-copy">
                          {dashboard.locale() === "zh-CN" ? "继续后会回到刚才的位置。" : "Resume to return to the same place."}
                        </p>
                        <button class="vld-primary vld-empty-action" type="button" disabled={busy()} onClick={() => void command("resume")}>
                          {copy(dashboard.locale(), "resumeReview")}
                        </button>
                      </div>
                    </section>
                  }
                >
                  <div class="vld-review-layout">
                    <section class="vld-panel vld-review-stage">
                      <div class="vld-progress-track" aria-label={copy(dashboard.locale(), "reviewProgress")}>
                        <div
                          class="vld-progress-fill"
                          style={{ width: `${Math.max(4, ((review().currentIndex + 1) / review().totalItems) * 100)}%` }}
                        />
                      </div>
                      <p class="vld-eyebrow" style={{ "margin-top": "20px" }}>
                        {review().currentIndex + 1} / {review().totalItems}
                        {" · "}
                        {dashboard.presentation(review().currentItem!.patternKey)?.label ?? review().currentItem!.label}
                      </p>

                      <ReviewCurrentItem state={review()} stageTitle={stageTitle()} />

                      <Show when={error()}><div class="vld-error" style={{ "margin-top": "18px" }}>{error()}</div></Show>

                      <Show
                        when={review().currentItem!.stage !== "item_completed"}
                        fallback={
                          <div class="vld-review-actions">
                            <span />
                            <button class="vld-primary" type="button" disabled={busy()} onClick={() => void command("next_item")}>
                              {review().currentIndex + 1 >= review().totalItems
                                ? copy(dashboard.locale(), "completeReview")
                                : copy(dashboard.locale(), "continue")}
                              {" →"}
                            </button>
                          </div>
                        }
                      >
                        <div class="vld-review-form">
                          <label class="vld-section-title" for="vld-review-answer">{stageTitle()}</label>
                          <textarea
                            id="vld-review-answer"
                            class="vld-textarea"
                            value={answer()}
                            disabled={busy()}
                            maxlength="300"
                            onInput={(event) => setAnswer(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit()
                            }}
                          />
                          <div class="vld-review-actions">
                            <Show when={review().currentItem!.hintLevel < 2}>
                              <button class="vld-link-button" type="button" disabled={busy()} onClick={() => void command("request_hint")}>
                                {review().currentItem!.hintLevel > 0
                                  ? copy(dashboard.locale(), "anotherHint")
                                  : copy(dashboard.locale(), "hint")}
                              </button>
                            </Show>
                            <button class="vld-primary" type="button" disabled={busy() || !answer().trim()} onClick={submit}>
                              {busy()
                                ? copy(dashboard.locale(), "loading")
                                : review().currentItem!.stage === "awaiting_repair"
                                  ? copy(dashboard.locale(), "submitRepair")
                                  : review().currentItem!.stage === "awaiting_transfer"
                                    ? copy(dashboard.locale(), "submitTransfer")
                                    : copy(dashboard.locale(), "submitAnswer")}
                            </button>
                          </div>
                        </div>
                      </Show>
                    </section>

                    <aside class="vld-grid">
                      <section class="vld-soft-panel">
                        <h2 class="vld-section-title">{copy(dashboard.locale(), "reviewProgress")}</h2>
                        <div class="vld-queue-list">
                          <For each={review().completedItems}>
                            {(item) => (
                              <div class="vld-queue-item">
                                <strong>{dashboard.presentation(item.patternKey)?.label ?? item.label}</strong>
                                <span>{outcomeLabel(dashboard.locale(), item.outcome)}</span>
                              </div>
                            )}
                          </For>
                          <Show when={review().currentItem}>
                            <div class="vld-queue-item">
                              <strong>{dashboard.presentation(review().currentItem!.patternKey)?.label ?? review().currentItem!.label}</strong>
                              <span>{review().currentIndex + 1} / {review().totalItems}</span>
                            </div>
                          </Show>
                        </div>
                      </section>
                      <section class="vld-panel vld-panel-pad">
                        <button class="vld-secondary vld-full-button" type="button" disabled={busy()} onClick={() => void command("pause")}>
                          {copy(dashboard.locale(), "later")}
                        </button>
                        <button class="vld-link-button vld-full-button" style={{ "margin-top": "10px" }} type="button" disabled={busy()} onClick={() => void abandon()}>
                          {copy(dashboard.locale(), "endReview")}
                        </button>
                      </section>
                    </aside>
                  </div>
                </Show>
              </Show>
              </Show>
            )}
          </Show>
        </Show>
      </Show>
    </>
  )
}

const ReviewCurrentItem: Component<{ state: ReviewState; stageTitle: string }> = (props) => {
  const dashboard = useDashboard()
  const item = () => props.state.currentItem!
  const question = () => item().stage === "awaiting_transfer"
    ? item().transferChallenge
    : item().challenge
  return (
    <>
      <h2 class="vld-review-question">{question()}</h2>
      <p class="vld-review-instruction">
        {item().stage === "awaiting_response"
          ? dashboard.locale() === "zh-CN"
            ? "先凭记忆写出你会在真实工作中使用的表达。"
            : "Write the expression you would use in real work from memory."
          : item().stage === "awaiting_repair"
            ? copy(dashboard.locale(), "repair")
            : item().stage === "awaiting_transfer"
              ? copy(dashboard.locale(), "transfer")
              : outcomeLabel(dashboard.locale(), item().outcome!)}
      </p>
      <Show when={item().visibleHints.length > 0}>
        <div class="vld-hints">
          <For each={item().visibleHints}>
            {(hint) => <div class="vld-hint">{hint}</div>}
          </For>
        </div>
      </Show>
      <Show when={item().latestFeedback || item().referenceAnswer || item().latestNaturalAnswer}>
        <div class="vld-review-feedback" data-kind={item().stage === "awaiting_transfer" || item().stage === "item_completed" ? "success" : "feedback"}>
          <Show when={item().latestFeedback}>
            <strong>{copy(dashboard.locale(), "feedback")}</strong>
            <p class="vld-evidence-copy">{item().latestFeedback}</p>
          </Show>
          <Show when={item().latestNaturalAnswer || item().referenceAnswer}>
            <strong>{copy(dashboard.locale(), "reference")}</strong>
            <p class="vld-evidence-copy">{item().latestNaturalAnswer ?? item().referenceAnswer}</p>
          </Show>
          <Show when={item().explanation}>
            <p class="vld-evidence-copy">{item().explanation}</p>
          </Show>
        </div>
      </Show>
    </>
  )
}

const ReviewComplete: Component<{ state: ReviewState }> = (props) => {
  const dashboard = useDashboard()
  return (
    <section class="vld-complete-hero">
      <div class="vld-complete-mark" aria-hidden="true">✓</div>
      <h2 class="vld-page-title">{copy(dashboard.locale(), "reviewComplete")}</h2>
      <p class="vld-page-copy" style={{ margin: "8px auto 0" }}>
        {dashboard.locale() === "zh-CN"
          ? "这次练习已经转化为新的学习证据，复习安排也已更新。"
          : "This practice is now learning evidence, and the review schedule has been updated."}
      </p>
      <div class="vld-complete-stats">
        <div class="vld-complete-stat">
          <span class="vld-stat-value">{props.state.summary.completedPatternCount}</span>
          <span class="vld-stat-label">{copy(dashboard.locale(), "completedPatterns")}</span>
        </div>
        <div class="vld-complete-stat">
          <span class="vld-stat-value">{props.state.summary.independentRecallCount}</span>
          <span class="vld-stat-label">{copy(dashboard.locale(), "independentRecall")}</span>
        </div>
        <div class="vld-complete-stat">
          <span class="vld-stat-value">{props.state.summary.assistedPatternCount}</span>
          <span class="vld-stat-label">{copy(dashboard.locale(), "assisted")}</span>
        </div>
        <div class="vld-complete-stat">
          <span class="vld-stat-value">{props.state.summary.successfulTransferCount}</span>
          <span class="vld-stat-label">{copy(dashboard.locale(), "successfulTransfer")}</span>
        </div>
      </div>
      <div class="vld-panel vld-panel-pad" style={{ "margin-top": "24px", "text-align": "left" }}>
        <For each={props.state.completedItems}>
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
      </div>
      <div class="vld-dialog-actions" style={{ "justify-content": "center" }}>
        <Show when={props.state.completionEventId}>
          <button
            class="vld-secondary"
            type="button"
            onClick={() => dashboard.navigate({
              view: "record",
              eventId: props.state.completionEventId!,
            })}
          >
            {copy(dashboard.locale(), "viewReviewRecord")}
          </button>
        </Show>
        <button class="vld-secondary" type="button" onClick={() => dashboard.navigate({ view: "patterns" })}>
          {copy(dashboard.locale(), "patterns")}
        </button>
        <button class="vld-primary" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>
          {copy(dashboard.locale(), "overview")}
        </button>
      </div>
    </section>
  )
}

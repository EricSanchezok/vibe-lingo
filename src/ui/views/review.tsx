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
  reviewErrorMessage,
} from "../i18n"
import { createAbortableResource } from "../resource"

type ReviewData = {
  queue: ReviewQueueOutput
  summary: LearningSummaryOutput
  state?: ReviewState
}

type ReviewQueueEntry = ReviewQueueOutput["due"][number]

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
      if (!result.ok) {
        setError(reviewErrorMessage(dashboard.locale(), result.error.code, result.error.message))
        return
      }
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
        setError(reviewErrorMessage(dashboard.locale(), result.error.code, result.error.message))
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
      <div class="vld-page-head vld-review-page-head">
        <div>
          <p class="vld-eyebrow">{copy(dashboard.locale(), "review")}</p>
          <h1 class="vld-page-title">
            {state()?.status === "completed"
              ? dashboard.locale() === "zh-CN" ? "今天的复习完成了" : "Today’s review is complete"
              : copy(dashboard.locale(), "reviewQueue")}
          </h1>
          <p class="vld-page-copy">
            {state()?.status === "completed"
              ? dashboard.locale() === "zh-CN"
                ? "没有学习分数。这里只记录你刚刚完成的行为与下一次安排。"
                : "There is no learning score. This records only what you completed and what comes next."
              : state()?.currentItem
                ? `${dashboard.locale() === "zh-CN" ? "模式" : "Pattern"} ${state()!.currentIndex + 1} / ${state()!.totalItems} · ${dashboard.presentation(state()!.currentItem!.patternKey)?.label ?? state()!.currentItem!.label}`
                : dashboard.locale() === "zh-CN"
                  ? `${batch().length} 个模式 · 预计 ${Math.max(2, batch().length * 2)} 分钟 · 可以随时暂停`
                  : `${batch().length} patterns · about ${Math.max(2, batch().length * 2)} minutes · pause anytime`}
          </p>
        </div>
        <div class="vld-page-actions">
          <RefreshButton loading={resource().loading} onRefresh={dashboard.refresh} />
        </div>
      </div>

      <Show when={!resource().loading} fallback={<LoadingBlock />}>
        <Show when={!resource().error} fallback={<ErrorBlock message={resource().error} onRetry={dashboard.refresh} />}>
          <Show when={state()} fallback={
            <Show when={batch().length > 0} fallback={
              <EmptyState
                title={copy(dashboard.locale(), "allCaughtUp")}
                copy={dashboard.locale() === "zh-CN"
                  ? `当前没有到期复习。今天已完成 ${resource().data?.summary.targetAttemptsToday ?? 0} 次目标语言表达，${resource().data?.summary.candidatePatternCount ?? 0} 个模式仍在观察中。`
                  : `Nothing is due now. You have made ${resource().data?.summary.targetAttemptsToday ?? 0} target-language attempts today, with ${resource().data?.summary.candidatePatternCount ?? 0} candidate patterns still being observed.`}
                action={<button class="vld-secondary" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>{copy(dashboard.locale(), "overview")}</button>}
              />
            }>
              <ReviewProgress current={0} total={batch().length} label={dashboard.locale() === "zh-CN" ? "准备复习" : "Ready to review"} />
              <div class="vld-review-workspace">
                <ReviewQueueRail due={batch()} upcoming={resource().data!.queue.upcoming} />
                <section class="vld-panel vld-review-stage vld-review-start-stage">
                  <span class="vld-review-context-pill">{dashboard.locale() === "zh-CN" ? "真实工作表达" : "Real-work expression"}</span>
                  <p class="vld-review-kicker">{dashboard.locale() === "zh-CN" ? "准备开始" : "Before you begin"}</p>
                  <h2 class="vld-review-question">
                    {dashboard.locale() === "zh-CN" ? "先凭记忆表达，再看反馈。" : "Recall it first, then compare your expression."}
                  </h2>
                  <p class="vld-review-instruction">
                    {dashboard.locale() === "zh-CN"
                      ? "练习会使用新的工作场景，不会要求你背诵答案。需要时可以查看提示，最后再换一个场景验证。"
                      : "You will work in a new scenario rather than memorize an answer. Hints are available, followed by a transfer task."}
                  </p>
                  <div class="vld-review-method" aria-label={dashboard.locale() === "zh-CN" ? "复习方法" : "Review method"}>
                    <div><span>1</span><strong>{dashboard.locale() === "zh-CN" ? "主动回忆" : "Recall"}</strong><small>{dashboard.locale() === "zh-CN" ? "先自己写" : "Write first"}</small></div>
                    <div><span>2</span><strong>{dashboard.locale() === "zh-CN" ? "获得反馈" : "Compare"}</strong><small>{dashboard.locale() === "zh-CN" ? "理解差异" : "Notice the difference"}</small></div>
                    <div><span>3</span><strong>{dashboard.locale() === "zh-CN" ? "新场景迁移" : "Transfer"}</strong><small>{dashboard.locale() === "zh-CN" ? "再用一次" : "Use it again"}</small></div>
                  </div>
                  <Show when={error()}><ReviewError message={error()} onRetry={() => void startReview()} busy={busy()} /></Show>
                  <div class="vld-review-stage-actions">
                    <button class="vld-primary" type="button" disabled={busy()} onClick={() => void startReview()}>
                      {busy() ? copy(dashboard.locale(), "loading") : copy(dashboard.locale(), "startReview")} <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </section>
              </div>
            </Show>
          }>
            {(review) => <Show when={review().status !== "abandoned"} fallback={
              <EmptyState
                title={dashboard.locale() === "zh-CN" ? "这次复习已经结束" : "This review has ended"}
                copy={dashboard.locale() === "zh-CN" ? "未完成的模式会按照复习安排再次出现。" : "Unfinished patterns will return according to the review schedule."}
                action={<button class="vld-primary" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>{copy(dashboard.locale(), "overview")}</button>}
              />
            }>
              <Show when={review().status !== "completed"} fallback={<ReviewComplete state={review()} />}>
                <ReviewProgress
                  current={review().currentIndex + reviewStep(review()) / 5}
                  total={review().totalItems}
                  label={`${dashboard.locale() === "zh-CN" ? "第" : "Step"} ${reviewStep(review())} ${dashboard.locale() === "zh-CN" ? "步 / 5" : "/ 5"}`}
                />
                <div class="vld-review-workspace">
                  <ReviewLearningRail
                    state={review()}
                    busy={busy()}
                    onPause={() => void command("pause")}
                    onAbandon={() => void abandon()}
                  />
                  <Show when={review().status !== "paused"} fallback={
                    <section class="vld-panel vld-review-stage vld-review-paused">
                      <p class="vld-review-kicker">{dashboard.locale() === "zh-CN" ? "进度已保留" : "Your place is saved"}</p>
                      <h2 class="vld-review-question">{dashboard.locale() === "zh-CN" ? "复习已暂停" : "Review paused"}</h2>
                      <p class="vld-review-instruction">{dashboard.locale() === "zh-CN" ? "继续后会回到刚才的位置。" : "Resume to return to the same place."}</p>
                      <div class="vld-review-stage-actions"><button class="vld-primary" type="button" disabled={busy()} onClick={() => void command("resume")}>{copy(dashboard.locale(), "resumeReview")}</button></div>
                    </section>
                  }>
                    <section class="vld-panel vld-review-stage">
                      <ReviewCurrentItem state={review()} />
                      <Show when={error()}><ReviewError message={error()} busy={busy()} /></Show>
                      <Show when={review().currentItem!.stage !== "item_completed"} fallback={
                        <div class="vld-review-stage-actions vld-review-stage-actions-end">
                          <button class="vld-primary" type="button" disabled={busy()} onClick={() => void command("next_item")}>
                            {review().currentIndex + 1 >= review().totalItems ? copy(dashboard.locale(), "completeReview") : copy(dashboard.locale(), "continue")} <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      }>
                        <div class="vld-review-form">
                          <label class="vld-review-input-label" for="vld-review-answer">{stageTitle()}</label>
                          <textarea
                            id="vld-review-answer"
                            class="vld-textarea vld-review-textarea"
                            value={answer()}
                            disabled={busy()}
                            maxlength="300"
                            placeholder={dashboard.locale() === "zh-CN" ? "写下你会真正发送的表达…" : "Write what you would actually send…"}
                            onInput={(event) => setAnswer(event.currentTarget.value)}
                            onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit() }}
                          />
                          <div class="vld-review-actions">
                            <Show when={review().currentItem!.hintLevel < 2 && review().currentItem!.stage !== "awaiting_repair"} fallback={<span />}>
                              <button class="vld-link-button" type="button" disabled={busy()} onClick={() => void command("request_hint")}>
                                {review().currentItem!.hintLevel > 0 ? copy(dashboard.locale(), "anotherHint") : copy(dashboard.locale(), "hint")}
                              </button>
                            </Show>
                            <button class="vld-primary" type="button" disabled={busy() || !answer().trim()} onClick={submit}>
                              {busy() ? copy(dashboard.locale(), "loading") : review().currentItem!.stage === "awaiting_repair" ? copy(dashboard.locale(), "submitRepair") : review().currentItem!.stage === "awaiting_transfer" ? copy(dashboard.locale(), "submitTransfer") : copy(dashboard.locale(), "submitAnswer")}
                            </button>
                          </div>
                          <p class="vld-review-privacy">{dashboard.locale() === "zh-CN" ? "只评估当前学习模式；包含敏感信息的回答不会保留。" : "Only this pattern is evaluated; answers containing sensitive information are not retained."}</p>
                        </div>
                      </Show>
                    </section>
                  </Show>
                </div>
              </Show>
            </Show>}
          </Show>
        </Show>
      </Show>
    </>
  )
}

function reviewStep(state: ReviewState): number {
  const item = state.currentItem
  if (!item) return 5
  if (item.stage === "item_completed") return 5
  if (item.stage === "awaiting_transfer") return 4
  if (item.stage === "awaiting_repair") return 3
  return item.hintLevel > 0 ? 2 : 1
}

const ReviewProgress: Component<{ current: number; total: number; label: string }> = (props) => (
  <div class="vld-review-progress-row">
    <span>{props.label}</span>
    <div class="vld-progress-track" aria-label={props.label}>
      <div
        class="vld-progress-fill"
        style={{ width: `${props.total > 0 ? Math.min(100, Math.max(3, (props.current / props.total) * 100)) : 0}%` }}
      />
    </div>
  </div>
)

const ReviewQueueRail: Component<{ due: ReviewQueueEntry[]; upcoming: ReviewQueueEntry[] }> = (props) => {
  const dashboard = useDashboard()
  const entries = () => [...props.due, ...props.upcoming.slice(0, Math.max(0, 3 - props.due.length))]
  return (
    <aside class="vld-panel vld-review-rail">
      <h2 class="vld-review-rail-title">{dashboard.locale() === "zh-CN" ? "本次复习" : "This review"}</h2>
      <p class="vld-review-rail-copy">{dashboard.locale() === "zh-CN" ? "按到期时间和真实工作相关性排列" : "Ordered by due date and relevance to your work"}</p>
      <div class="vld-review-queue">
        <For each={entries()}>{(item, index) => {
          const isDue = () => index() < props.due.length
          return (
            <div class="vld-review-queue-item" data-current={index() === 0 && isDue()}>
              <span class="vld-review-number">{index() + 1}</span>
              <div>
                <PatternText patternKey={item.patternKey} label={item.label} />
                <small>
                  {isDue()
                    ? item.overdueDays > 0
                      ? dashboard.locale() === "zh-CN" ? `已逾期 ${item.overdueDays} 天 · 待复习` : `${item.overdueDays} days overdue · due`
                      : dashboard.locale() === "zh-CN" ? "今天到期 · 待复习" : "Due today · ready"
                    : `${formatRelativeDate(dashboard.locale(), item.dueAt)} · ${copy(dashboard.locale(), "earlyPractice")}`}
                </small>
              </div>
            </div>
          )
        }}</For>
      </div>
      <div class="vld-review-rail-note">
        <strong>{dashboard.locale() === "zh-CN" ? "为什么先主动回忆？" : "Why recall first?"}</strong>
        <p>{dashboard.locale() === "zh-CN" ? "先自己写，比先看到答案更能检验你是否真的记得。" : "Writing first tests what you can actually retrieve before seeing an answer."}</p>
        <small>{copy(dashboard.locale(), "manualReviewNote")}</small>
      </div>
    </aside>
  )
}

const ReviewLearningRail: Component<{
  state: ReviewState
  busy: boolean
  onPause: () => void
  onAbandon: () => void
}> = (props) => {
  const dashboard = useDashboard()
  const step = () => reviewStep(props.state)
  const stages = () => dashboard.locale() === "zh-CN"
    ? ["自己写", "获得提示", "修正表达", "新场景迁移"]
    : ["Write first", "Use a hint", "Repair", "Transfer"]
  return (
    <aside class="vld-panel vld-review-rail">
      <h2 class="vld-review-rail-title">{dashboard.locale() === "zh-CN" ? "学习状态" : "Learning status"}</h2>
      <div class="vld-review-steps">
        <For each={stages()}>{(label, index) => {
          const stageNumber = () => index() + 1
          const completed = () => step() > stageNumber()
          const current = () => step() === stageNumber()
          const skippedHint = () => stageNumber() === 2 && step() > 2 && props.state.currentItem?.hintLevel === 0
          return (
            <div class="vld-review-step" data-current={current()} data-completed={completed()}>
              <span class="vld-review-step-mark" aria-hidden="true">{completed() ? "✓" : stageNumber()}</span>
              <strong>{label}</strong>
              <small>{current()
                ? dashboard.locale() === "zh-CN" ? "进行中" : "In progress"
                : completed()
                  ? skippedHint()
                    ? dashboard.locale() === "zh-CN" ? "未使用" : "Not used"
                    : dashboard.locale() === "zh-CN" ? "已完成" : "Complete"
                  : dashboard.locale() === "zh-CN" ? "待完成" : "Up next"}</small>
            </div>
          )
        }}</For>
      </div>
      <div class="vld-review-rail-note">
        <strong>{dashboard.locale() === "zh-CN" ? "本次记录什么" : "What this records"}</strong>
        <p>{dashboard.locale() === "zh-CN" ? "是否使用提示、能否自己修正，以及能否把同一模式用到新的工作场景。" : "Whether you used a hint, repaired the expression, and transferred it to a new work scenario."}</p>
      </div>
      <div class="vld-review-rail-actions">
        <button class="vld-secondary vld-full-button" type="button" disabled={props.busy} onClick={props.onPause}>{copy(dashboard.locale(), "later")}</button>
        <button class="vld-link-button vld-full-button" type="button" disabled={props.busy} onClick={props.onAbandon}>{copy(dashboard.locale(), "endReview")}</button>
      </div>
    </aside>
  )
}

const ReviewError: Component<{ message: string; onRetry?: () => void; busy: boolean }> = (props) => {
  const dashboard = useDashboard()
  return (
    <div class="vld-review-error" role="alert">
      <div><strong>{dashboard.locale() === "zh-CN" ? "这一步暂时没有完成" : "This step did not finish"}</strong><p>{props.message}</p></div>
      <Show when={props.onRetry}><button class="vld-secondary" type="button" disabled={props.busy} onClick={props.onRetry}>{copy(dashboard.locale(), "retry")}</button></Show>
    </div>
  )
}

const ReviewCurrentItem: Component<{ state: ReviewState }> = (props) => {
  const dashboard = useDashboard()
  const item = () => props.state.currentItem!
  const question = () => item().stage === "awaiting_transfer"
    ? item().transferChallenge
    : item().challenge
  const naturalAnswer = () => item().latestNaturalAnswer ?? item().referenceAnswer
  return (
    <>
      <span class="vld-review-context-pill">
        {item().stage === "awaiting_transfer"
          ? dashboard.locale() === "zh-CN" ? "新场景迁移" : "New scenario"
          : dashboard.locale() === "zh-CN" ? "真实工作场景" : "Real-work scenario"}
      </span>
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
          <strong class="vld-review-input-label">{dashboard.locale() === "zh-CN" ? "提示" : "Hint"}</strong>
          <For each={item().visibleHints}>
            {(hint) => <div class="vld-hint">{hint}</div>}
          </For>
        </div>
      </Show>
      <Show when={item().stage === "awaiting_repair"}>
        <div class="vld-review-comparison">
          <div class="vld-review-original"><strong>{copy(dashboard.locale(), "yourAnswer")}</strong><p>{item().latestAnswer ?? "—"}</p></div>
          <div class="vld-review-natural"><strong>{dashboard.locale() === "zh-CN" ? "更自然的表达" : "A more natural expression"}</strong><p>{naturalAnswer()}</p></div>
          <div class="vld-review-why"><strong>{dashboard.locale() === "zh-CN" ? "为什么" : "Why"}</strong><p>{item().latestFeedback}</p><Show when={item().explanation}><p>{item().explanation}</p></Show></div>
        </div>
      </Show>
      <Show when={item().stage === "awaiting_transfer" && (item().latestFeedback || naturalAnswer())}>
        <div class="vld-review-previous-note"><strong>{dashboard.locale() === "zh-CN" ? "上一轮反馈" : "Previous feedback"}</strong><p>{item().latestFeedback}</p><Show when={naturalAnswer()}><small>{naturalAnswer()}</small></Show></div>
      </Show>
      <Show when={item().stage === "item_completed"}>
        <div class="vld-review-feedback" data-kind="success"><strong>{outcomeLabel(dashboard.locale(), item().outcome!)}</strong><p>{item().latestFeedback}</p><Show when={naturalAnswer()}><small>{naturalAnswer()}</small></Show></div>
      </Show>
    </>
  )
}

const ReviewComplete: Component<{ state: ReviewState }> = (props) => {
  const dashboard = useDashboard()
  return (
    <section class="vld-review-complete">
      <p class="vld-eyebrow">{copy(dashboard.locale(), "reviewComplete")}</p>
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
      <div class="vld-complete-layout">
        <section class="vld-panel vld-complete-schedule">
          <h2 class="vld-review-rail-title">{dashboard.locale() === "zh-CN" ? "接下来的安排" : "What comes next"}</h2>
          <For each={props.state.completedItems}>{(item) => (
            <div class="vld-complete-schedule-row">
              <div><strong>{dashboard.presentation(item.patternKey)?.label ?? item.label}</strong><small>{outcomeLabel(dashboard.locale(), item.outcome)}</small></div>
              <span class="vld-badge">{item.dueAt ? formatRelativeDate(dashboard.locale(), item.dueAt) : copy(dashboard.locale(), "verified")}</span>
            </div>
          )}</For>
        </section>
        <aside class="vld-complete-note">
          <span class="vld-complete-mark" aria-hidden="true">✓</span>
          <h2>{dashboard.locale() === "zh-CN" ? "复习安排已更新" : "Review schedule updated"}</h2>
          <p>{dashboard.locale() === "zh-CN" ? "VibeLingo 只根据刚才的回忆、提示和迁移行为安排下一次练习，不把它换算成分数。" : "VibeLingo schedules the next practice from recall, hint, and transfer evidence without turning it into a score."}</p>
        </aside>
      </div>
      <div class="vld-dialog-actions vld-complete-actions">
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

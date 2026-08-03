import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { pathToFileURL } from "url"

GlobalRegistrator.register({
  width: 1440,
  height: 1024,
  url: "http://localhost/plugins/vibe-lingo/learning?view=overview",
})
document.documentElement.lang = "zh-CN"

const solid = await import("solid-js/dist/solid.js" as string)
const web = await import("solid-js/web/dist/web.js" as string)
const store = await import("solid-js/store/dist/store.js" as string)
;(globalThis as any).__SYNERGY_PLUGIN_SOLID_RUNTIME__ = { solid, web, store }
const manifest = await Bun.file("dist/plugin.json").json()
const navigation = manifest.contributions.find(
  (item: any) => item.kind === "ui.navigationItem" && item.id === "learning",
)
if (!navigation?.component?.exportName) throw new Error("Built navigation export was not found")
const bundled = await import(pathToFileURL(`${process.cwd()}/dist/ui/index.js`).href)
const App = bundled[navigation.component.exportName]
const correctionRenderer = manifest.contributions.find(
  (item: any) =>
    item.kind === "ui.messageRenderer" &&
    item.id === "correction-card" &&
    item.tool === "plugin__vibe-lingo__record-correction",
)
if (!correctionRenderer?.component?.exportName) {
  throw new Error("Built correction-card export was not found")
}
const CorrectionCard = bundled[correctionRenderer.component.exportName]
const progressRenderer = manifest.contributions.find(
  (item: any) =>
    item.kind === "ui.messageRenderer" &&
    item.id === "progress-card" &&
    item.tool === "plugin__vibe-lingo__progress",
)
if (!progressRenderer?.component?.exportName) {
  throw new Error("Built progress-card export was not found")
}
const ProgressCard = bundled[progressRenderer.component.exportName]
const DAY = 86_400_000
const now = Date.now()
const reviewId = "11111111-1111-4111-8111-111111111111"
const eventId = "22222222-2222-4222-8222-222222222222"
const itemId = "33333333-3333-4333-8333-333333333333"

const configuredSettings = {
  nativeLanguage: "zh-Hans",
  targetLanguage: "en",
  proficiency: "intermediate",
  correctionMode: "focused",
  naturalnessSuggestionsEnabled: true,
  trackingEnabled: true,
  recurringFocusEnabled: true,
}
let currentSettings: Record<string, unknown> = configuredSettings
let currentReview: any
let emptyCollections = false

const pattern = {
  patternKey: "missing_article",
  category: "grammar",
  label: "Missing article",
  rule: "Use an article before a singular countable noun.",
  occurrenceCount: 6,
  sessionCount: 4,
  lastSeenAt: now - DAY,
  severity: "high_value",
  stage: "practicing",
  disposition: "active",
  displayStatus: "improving",
  dueAt: now,
  scheduleStep: 1,
  lapseCount: 0,
  naturalCorrectCount: 2,
  independentReviewCount: 1,
  firstSeenAt: now - 20 * DAY,
  examples: [],
}
const trends = Array.from({ length: 90 }, (_, index) => ({
  date: new Date(now - (89 - index) * DAY).toISOString().slice(0, 10),
  targetAttempts: index % 5,
  findings: index % 3,
  naturalCorrectUses: index % 4 === 0 ? 1 : 0,
  independentReviews: index % 9 === 0 ? 1 : 0,
}))
const summary = {
  setupRequired: false,
  targetLanguage: "en",
  analyzedMessages: 214,
  analyzedMessagesToday: 12,
  findingsLast30Days: 31,
  targetAttemptsToday: 5,
  targetSessionsToday: 2,
  findingMessagesToday: 2,
  findingsToday: 2,
  correctionsToday: 2,
  acceptedFindingsToday: 1,
  correctionsAnalyzing: 1,
  correctionsFailed: 0,
  lastAnalyzedAt: now - 3 * 60_000,
  totalPatternCount: 11,
  recurringPatternCount: 4,
  candidatePatternCount: 4,
  practicingPatternCount: 4,
  targetAttempts: 88,
  activeDays: 16,
  sessionCount: 6,
  duePatternCount: 2,
  reviewCount: 8,
  reviewRecallCountLast30Days: 7,
  independentRecallCountLast30Days: 5,
  successfulTransferCountLast30Days: 4,
  successfulTransferSessionCountLast30Days: 3,
  awaitingVerificationCount: 2,
  verifiedPatternCount: 3,
  currentStreakDays: 4,
  learningWeek: 6,
  recentNaturalUse: {
    patternKey: pattern.patternKey,
    label: pattern.label,
    fragment: "Add a settings panel.",
    sessionCount: 2,
    observedAt: now - DAY,
  },
  trends: { "7": trends.slice(-7), "30": trends.slice(-30), "90": trends },
}
const journey = {
  items: [
    {
      id: eventId,
      type: "practice_started",
      occurredAt: now,
      scopeId: "scope-test",
      sessionId: "session-test",
      attemptCount: 4,
      findingMessageCount: 1,
      findingCount: 1,
      demonstrationCount: 1,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      type: "pattern_reviewable",
      occurredAt: now - DAY,
      patternKey: pattern.patternKey,
    },
  ],
}
const queue = {
  due: [
    {
      patternKey: pattern.patternKey,
      label: pattern.label,
      rule: pattern.rule,
      severity: "high_value",
      dueAt: now,
      overdueDays: 0,
      occurrenceCount: 6,
      lapseCount: 0,
    },
  ],
  upcoming: [
    {
      patternKey: "natural_request",
      label: "Natural requests",
      rule: "Prefer direct verbs for task instructions.",
      severity: "high_value",
      dueAt: now + DAY,
      overdueDays: 0,
      occurrenceCount: 4,
      lapseCount: 0,
    },
  ],
}
const reviewBase = {
  id: reviewId,
  targetLanguage: "en",
  status: "active",
  revision: 2,
  currentIndex: 0,
  totalItems: 1,
  completedItems: [],
  summary: {
    completedPatternCount: 0,
    independentRecallCount: 0,
    assistedPatternCount: 0,
    successfulTransferCount: 0,
  },
  startedAt: now,
  updatedAt: now,
}

function review(stage: string, extra: Record<string, unknown> = {}) {
  return {
    ...reviewBase,
    currentItem: {
      id: itemId,
      patternKey: pattern.patternKey,
      label: pattern.label,
      stage,
      hintLevel: 0,
      challenge: "Ask an agent to add one button.",
      visibleHints: [],
      ...(stage === "awaiting_transfer" ? { transferChallenge: "Ask for one settings panel." } : {}),
      ...extra,
    },
  }
}

const subscribers = new Set<(settings: Record<string, unknown>) => void>()
const context: any = {
  pluginId: "vibe-lingo",
  scopeId: "scope-test",
  surface: { kind: "ui.navigationItem", id: "learning" },
  settings: {
    async get() {
      return currentSettings
    },
    async replace(values: Record<string, unknown>) {
      currentSettings = values
      subscribers.forEach((listener) => listener(values))
    },
    subscribe(listener: (settings: Record<string, unknown>) => void) {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
  },
  events: {
    subscribe() {
      return () => undefined
    },
  },
  host: {
    openPluginPage(_path: string, params: Record<string, string>) {
      const query = new URLSearchParams(params).toString()
      history.pushState({}, "", `/plugins/vibe-lingo/learning?${query}`)
      window.dispatchEvent(new PopStateEvent("popstate"))
    },
    openSession() {},
    openWorkbenchPanel() {},
    openResource() {},
    notify() {},
    async confirm() {
      return true
    },
  },
  operations: {
    async query(id: string) {
      if (id === "learning-profiles")
        return {
          current: configuredSettings,
          profiles: [
            {
              nativeLanguage: "zh-Hans",
              targetLanguage: "en",
              proficiency: "intermediate",
              firstUsedAt: now - 40 * DAY,
              lastUsedAt: now,
            },
            {
              nativeLanguage: "en",
              targetLanguage: "es",
              proficiency: "beginner",
              firstUsedAt: now - 10 * DAY,
              lastUsedAt: now - DAY,
            },
          ],
        }
      if (id === "learning-summary") return summary
      if (id === "learning-journey") return journey
      if (id === "review-queue")
        return {
          ...queue,
          due: emptyCollections ? [] : queue.due,
          upcoming: emptyCollections ? [] : queue.upcoming,
          activeReview: currentReview,
        }
      if (id === "review-state") return { state: currentReview }
      if (id === "learning-patterns") return { items: emptyCollections ? [] : [pattern] }
      if (id === "learning-pattern-detail")
        return {
          found: true,
          pattern,
          evidenceTimeline: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              kind: "error",
              outcome: "incorrect",
              confidence: 0.98,
              observedAt: now - DAY,
              originalFragment: "add button",
              correctedFragment: "add a button",
            },
          ],
          reviewHistory: [],
          trend: trends.slice(-30).map((point) => ({
            date: point.date,
            errors: point.findings,
            naturalCorrectUses: point.naturalCorrectUses,
            independentReviews: point.independentReviews,
          })),
          contexts: [
            {
              scopeId: "scope-test",
              sessionCount: 4,
              evidenceCount: 8,
              errorCount: 6,
              naturalCorrectCount: 2,
              reviewCount: 1,
              lastSeenAt: now,
            },
          ],
        }
      if (id === "learning-record")
        return {
          found: true,
          event: journey.items[0],
          patterns: [pattern],
          evidence: [],
          review: currentReview?.status === "completed" ? currentReview : undefined,
          sessionSummary: {
            analyzedMessages: 8,
            targetAttempts: 8,
            findingMessages: 2,
            findings: 2,
            demonstrations: 2,
            discoveredPatterns: 1,
          },
          sourceSession: { id: "session-test", title: "Refine checkout flow" },
        }
      if (id === "translations-list")
        return {
          setupRequired: false,
          items: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              profileTargetLanguage: "en",
              nativeLanguage: "zh-Hans",
              destinationPolicy: "adaptive",
              detectedSourceLanguage: "en",
              destinationLanguage: "zh-Hans",
              sourceText: "The complete selected source is visible here.",
              sourceCharCount: 45,
              translatedText: "完整的选区原文会显示在这里。",
              createdAt: now,
              updatedAt: now,
              lastUsedAt: now,
              useCount: 2,
            },
          ],
        }
      throw new Error(`Unexpected query ${id}`)
    },
    async command(id: string, input: any) {
      if (id === "pattern-presentations")
        return {
          items: input.patternKeys.map((patternKey: string) => ({
            patternKey,
            label: patternKey === "missing_article" ? "单数名词前的冠词" : "更自然的请求表达",
            rule: "根据语境使用自然、可迁移的表达。",
            source: "localized",
          })),
        }
      throw new Error(`Unexpected command ${id}`)
    },
  },
}

async function mount(view: string, options: { settings?: Record<string, unknown>; state?: any } = {}) {
  currentSettings = options.settings ?? configuredSettings
  currentReview = options.state
  history.replaceState({}, "", `/plugins/vibe-lingo/learning?${view}`)
  const target = document.createElement("div")
  target.style.width = "1440px"
  target.style.height = "1024px"
  document.body.append(target)
  const dispose = web.render(() => solid.createComponent(App, context), target)
  await new Promise((resolve) => setTimeout(resolve, 30))
  return { target, dispose }
}

function assertText(target: HTMLElement, text: string) {
  if (!target.textContent?.includes(text)) {
    const copy = target.cloneNode(true) as HTMLElement
    copy.querySelectorAll("style").forEach((style) => style.remove())
    throw new Error(`Expected "${text}" in ${copy.textContent?.slice(0, 1200)}`)
  }
}

const screens: Array<[string, string, any?]> = [
  ["view=overview", "学习证据"],
  ["view=review", "你的表达", review("awaiting_response")],
  [
    "view=review",
    "提示",
    review("awaiting_response", {
      hintLevel: 1,
      visibleHints: ["想一想单数名词前的词。"],
    }),
  ],
  [
    "view=review",
    "用正确形式再写一次",
    review("awaiting_repair", {
      latestAnswer: "Add button.",
      latestFeedback: "缺少冠词。",
      referenceAnswer: "Add a button.",
    }),
  ],
  [
    "view=review",
    "在新场景中使用它",
    review("awaiting_transfer", {
      latestFeedback: "很好。",
      referenceAnswer: "Add a button.",
    }),
  ],
  [
    "view=review",
    "本次复习完成",
    {
      ...reviewBase,
      status: "completed",
      completionEventId: eventId,
      currentItem: undefined,
      completedItems: [
        {
          id: itemId,
          patternKey: pattern.patternKey,
          label: pattern.label,
          outcome: "independent",
          hintCount: 0,
          scheduleStep: 1,
          dueAt: now + 3 * DAY,
          completedAt: now,
        },
      ],
      summary: {
        completedPatternCount: 1,
        independentRecallCount: 1,
        assistedPatternCount: 0,
        successfulTransferCount: 1,
      },
    },
  ],
  ["view=patterns", "从真实工作表达中整理出的个人学习档案"],
  ["view=pattern&pattern=missing_article", "证据时间线"],
  ["view=pattern&pattern=missing_article", "模式操作"],
  ["view=journey", "按时间回看真实工作"],
  ["view=translations", "完整的选区原文会显示在这里。"],
  [`view=record&event=${eventId}`, "来源会话摘要"],
  ["view=settings", "复习只会在你主动"],
]

const mounted = await mount("view=overview")
assertText(mounted.target, "今日已检查 12 条消息")
assertText(mounted.target, "5 次目标语言表达 · 2 个真实会话 · 2 次可见纠正 · 1 条可信发现")
assertText(mounted.target, "最后检查：3分钟前")
for (const [route, expected, state] of screens) {
  currentReview = state
  context.host.openPluginPage("learning", Object.fromEntries(new URLSearchParams(route)))
  await new Promise((resolve) => setTimeout(resolve, 35))
  assertText(mounted.target, expected)
  if (route === "view=journey") {
    assertText(mounted.target, "4 次目标语言表达 · 1 条学习发现")
  }
  if (["view=overview", "view=review", "view=patterns", "view=journey", "view=translations"].includes(route)) {
    assertText(mounted.target, "刷新")
  }
  if (state?.status === "completed") assertText(mounted.target, "查看学习记录")
  if (route === "view=review" && state?.status === "active") {
    const workspace = mounted.target.querySelector<HTMLElement>(".vld-review-workspace")
    if (!workspace || !workspace.firstElementChild?.classList.contains("vld-review-rail")) {
      throw new Error("Review workspace did not render the learning rail before the practice stage")
    }
    assertText(workspace, "学习状态")
    if (state.currentItem.stage !== "awaiting_transfer") assertText(workspace, "真实工作场景")
    if (state.currentItem.stage === "awaiting_repair") {
      assertText(workspace, "你的表达")
      assertText(workspace, "更自然的表达")
      assertText(workspace, "为什么")
    }
    if (state.currentItem.stage === "awaiting_transfer") {
      assertText(workspace, "新场景迁移")
    }
  }
  if (state?.status === "completed") {
    assertText(mounted.target, "没有学习分数")
    assertText(mounted.target, "接下来的安排")
  }
  if (route === "view=settings") assertText(mounted.target, "自然表达建议")
  if (route === "view=review") {
    context.host.openPluginPage("learning", { view: "overview" })
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const naturalnessSwitch = mounted.target.querySelector<HTMLButtonElement>(
  'button[role="switch"][aria-label="自然表达建议"]',
)
if (
  !naturalnessSwitch
  || naturalnessSwitch.disabled
  || naturalnessSwitch.getAttribute("aria-checked") !== "true"
) {
  throw new Error("Naturalness setting was not enabled by default")
}
await context.settings.replace({ ...configuredSettings, correctionMode: "off" })
await new Promise((resolve) => setTimeout(resolve, 20))
if (!naturalnessSwitch.disabled || naturalnessSwitch.getAttribute("aria-checked") !== "true") {
  throw new Error("Global coaching off did not disable and preserve the naturalness setting")
}
await context.settings.replace(configuredSettings)
await new Promise((resolve) => setTimeout(resolve, 20))

currentReview = undefined
context.host.openPluginPage("learning", { view: "review" })
await new Promise((resolve) => setTimeout(resolve, 35))
const reviewLanding = mounted.target.querySelector<HTMLElement>(".vld-review-workspace")
if (!reviewLanding || !reviewLanding.firstElementChild?.classList.contains("vld-review-rail")) {
  throw new Error("Review landing did not preserve the two-column learning workspace")
}
assertText(reviewLanding, "本次复习")
assertText(reviewLanding, "主动回忆")

context.host.openPluginPage("learning", { view: "overview" })
await new Promise((resolve) => setTimeout(resolve, 20))
const profileButton = mounted.target.querySelector<HTMLButtonElement>(".vld-profile-trigger")
if (!profileButton) throw new Error("Profile trigger was not rendered")
profileButton.click()
await new Promise((resolve) => setTimeout(resolve, 0))
assertText(document.body, "其他学习档案")
profileButton.click()

emptyCollections = true
context.host.openPluginPage("learning", { view: "patterns" })
await new Promise((resolve) => setTimeout(resolve, 35))
assertText(mounted.target, "今天已经完成 5 次目标语言表达")
context.host.openPluginPage("learning", { view: "review" })
await new Promise((resolve) => setTimeout(resolve, 35))
assertText(mounted.target, "当前没有到期复习。今天已完成 5 次目标语言表达，4 个模式仍在观察中。")
emptyCollections = false

await context.settings.replace({
  ...configuredSettings,
  nativeLanguage: "",
  targetLanguage: "",
})
await new Promise((resolve) => setTimeout(resolve, 20))
assertText(mounted.target, "设置你的学习档案")
mounted.dispose()
mounted.target.remove()

let correctionStatus: any = {
  found: true,
  status: "queued",
  patternKeys: [],
  recovery: "waiting",
  retryAt: Date.now() + 100,
}
let correctionQueryCount = 0
let correctionRetryCount = 0
let finishCorrectionRetry: (() => void) | undefined
const [correctionTool, setCorrectionTool] = store.createStore({
  name: "plugin__vibe-lingo__record-correction",
  input: {} as Record<string, unknown>,
  metadata: {} as Record<string, unknown>,
  status: "running",
})
const learningListeners = new Set<() => void>()
const correctionContext: any = {
  ...context,
  surface: { kind: "ui.messageRenderer", id: "correction-card" },
  message: { id: "assistant-one", role: "assistant" },
  get tool() {
    return correctionTool
  },
  operations: {
    ...context.operations,
    async query(id: string) {
      if (id === "correction-status") {
        correctionQueryCount++
        return { ...correctionStatus }
      }
      return context.operations.query(id)
    },
    async command(id: string, input: any) {
      if (id === "correction-retry") {
        correctionRetryCount++
        return new Promise((resolve) => {
          finishCorrectionRetry = () =>
            resolve({
              found: true,
              status: "queued",
              patternKeys: [],
              recovery: "waiting",
              retryAt: Date.now() + 1_000,
            })
        })
      }
      return context.operations.command(id, input)
    },
  },
  events: {
    subscribe(id: string, listener: () => void) {
      if (id === "learning.changed") learningListeners.add(listener)
      return () => learningListeners.delete(listener)
    },
  },
}
const correctionTarget = document.createElement("div")
document.body.append(correctionTarget)
const disposeCorrection = web.render(() => solid.createComponent(CorrectionCard, correctionContext), correctionTarget)
await new Promise((resolve) => setTimeout(resolve, 10))
const correctionStyles = correctionTarget.querySelector("style")?.textContent ?? ""
if (!correctionStyles.includes("--vibe-sage-ref-ink:light-dark(#4a613b,#a2b394)")) {
  throw new Error("Correction card did not use the Figma-aligned sage palette")
}
if (correctionStyles.includes("--surface-success-strong")) {
  throw new Error("Correction card still derives its learning palette from the host success color")
}
assertText(correctionTarget, "表达建议")
assertText(correctionTarget, "正在保存语言反馈")
setCorrectionTool({
  input: {
    restatement: "Add a button to the settings page.",
    corrections: [
      {
        originalFragment: "add button",
        correctedFragment: "add a button",
      },
    ],
  },
  metadata: {
    vibeLingo: {
      status: "analyzing",
      batchId: "66666666-6666-4666-8666-666666666666",
    },
  },
  status: "completed",
})
await new Promise((resolve) => setTimeout(resolve, 10))
assertText(correctionTarget, "需要调整的表达")
assertText(correctionTarget, "纠正")
assertText(correctionTarget, "add button")
assertText(correctionTarget, "正在整理学习记录")
const correctionPair = correctionTarget.querySelector(".vlc-pair")
if (!correctionPair) throw new Error("Correction pair was not rendered")
const correctionPairSections = [...correctionPair.children].map((child) => child.className)
if (correctionPairSections.join("|") !== "vlc-kind|vlc-source|vlc-arrow|vlc-target") {
  throw new Error(`Correction pair did not expose stable alignment rows: ${correctionPairSections.join("|")}`)
}
if (!correctionStyles.includes("container-type:inline-size")) {
  throw new Error("Correction card responsiveness was not based on its own rendered width")
}
if (!correctionStyles.includes(".vlc-arrow{grid-column:1}.vlc-target{grid-column:2}")) {
  throw new Error("Narrow correction layout did not keep the arrow attached to the corrected fragment")
}

setCorrectionTool("input", {
  restatement: "Okay, go ahead and continue the cleanup.",
  corrections: [
    {
      kind: "correction",
      originalFragment: "ok",
      correctedFragment: "Okay",
    },
    {
      kind: "naturalness",
      originalFragment: "I allow you to continue cleaning",
      correctedFragment: "go ahead and continue the cleanup",
      explanation: "这里用 allow 会显得正式，像是在上对下授权。",
    },
    {
      kind: "correction",
      originalFragment: "i",
      correctedFragment: "I",
    },
    {
      kind: "correction",
      originalFragment: "settings page button",
      correctedFragment: "button on the settings page",
    },
    {
      kind: "naturalness",
      originalFragment: "do the cleaning work",
      correctedFragment: "continue the cleanup",
      explanation: "这里直接说 cleanup 更简洁自然。",
    },
  ],
})
await new Promise((resolve) => setTimeout(resolve, 0))
assertText(correctionTarget, "表达建议")
assertText(correctionTarget, "更自然")
assertText(correctionTarget, "这里用 allow 会显得正式")
assertText(correctionTarget, "查看其余 2 条")
if (correctionTarget.textContent?.includes("settings page button")) {
  throw new Error("Collapsed correction card revealed a hidden item")
}
const expandButton = [...correctionTarget.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
  button.textContent?.includes("查看其余 2 条"),
)
if (!expandButton || expandButton.getAttribute("aria-expanded") !== "false") {
  throw new Error("Correction expansion control was not accessible")
}
expandButton.click()
await new Promise((resolve) => setTimeout(resolve, 0))
assertText(correctionTarget, "settings page button")
assertText(correctionTarget, "收起")
if (expandButton.getAttribute("aria-expanded") !== "true") {
  throw new Error("Correction expansion state was not exposed")
}

correctionStatus = {
  found: true,
  status: "failed",
  patternKeys: [],
  recovery: "retry_available",
  failureReason: "timeout",
  attemptCount: 2,
}
await new Promise((resolve) => setTimeout(resolve, 110))
assertText(correctionTarget, "多次尝试后仍超时")
const retryButton = [...correctionTarget.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
  button.textContent?.includes("重试整理"),
)
if (!retryButton) throw new Error("Correction retry action was not rendered")
retryButton.click()
retryButton.click()
await new Promise((resolve) => setTimeout(resolve, 0))
assertText(correctionTarget, "正在重试")
if (correctionRetryCount !== 1) throw new Error(`Expected one correction retry, received ${correctionRetryCount}`)
finishCorrectionRetry?.()
await new Promise((resolve) => setTimeout(resolve, 10))
assertText(correctionTarget, "正在整理学习记录")

correctionStatus = {
  found: true,
  status: "analyzed",
  patternKeys: ["missing_article"],
  recovery: "none",
}
learningListeners.forEach((listener) => listener())
await new Promise((resolve) => setTimeout(resolve, 10))
assertText(correctionTarget, "学习模式已更新")
assertText(correctionTarget, "查看学习模式")
disposeCorrection()
correctionTarget.remove()

const progressContext: any = {
  ...context,
  surface: { kind: "ui.messageRenderer", id: "progress-card" },
  message: { id: "assistant-progress", role: "assistant" },
  tool: {
    name: "plugin__vibe-lingo__progress",
    input: {},
    metadata: {
      vibeLingo: {
        kind: "progress",
        state: "ready",
        targetLanguage: "en",
        targetName: "English",
        scope: "all",
        summary: {
          targetAttemptsToday: 5,
          targetSessionsToday: 2,
          correctionsToday: 2,
          correctionsAnalyzing: 1,
          activeDays: 16,
          learningWeek: 6,
          candidatePatternCount: 4,
          practicingPatternCount: 4,
          verifiedPatternCount: 3,
          duePatternCount: 2,
        },
        patterns: [
          {
            patternKey: pattern.patternKey,
            label: "单数名词前的冠词",
            rule: "指一个可数事物时，根据语境使用 a 或 the。",
            stage: "practicing",
            occurrenceCount: 6,
          },
        ],
      },
    },
    status: "completed",
  },
}
const progressTarget = document.createElement("div")
document.body.append(progressTarget)
const disposeProgress = web.render(() => solid.createComponent(ProgressCard, progressContext), progressTarget)
await new Promise((resolve) => setTimeout(resolve, 0))
const progressStyles = progressTarget.querySelector("style")?.textContent ?? ""
if (!progressStyles.includes("--vibe-sage-ref-surface:light-dark(#edf0e5,#252b22)")) {
  throw new Error("Progress card did not use the Figma-aligned sage surface")
}
assertText(progressTarget, "你的学习进展")
assertText(progressTarget, "第 6 周")
assertText(progressTarget, "5")
assertText(progressTarget, "单数名词前的冠词")
assertText(progressTarget, "1 条纠正正在整理为学习记录")
assertText(progressTarget, "查看完整进展")
if (progressTarget.textContent?.includes("missing_article")) {
  throw new Error("Progress card exposed an internal pattern key")
}
disposeProgress()
progressTarget.remove()

correctionStatus = {
  found: true,
  status: "queued",
  patternKeys: [],
  recovery: "waiting",
  retryAt: Date.now() + 100,
}
const cleanupTarget = document.createElement("div")
document.body.append(cleanupTarget)
const disposeCleanup = web.render(() => solid.createComponent(CorrectionCard, correctionContext), cleanupTarget)
await new Promise((resolve) => setTimeout(resolve, 10))
const queryCountBeforeDispose = correctionQueryCount
disposeCleanup()
cleanupTarget.remove()
await new Promise((resolve) => setTimeout(resolve, 120))
if (correctionQueryCount !== queryCountBeforeDispose) {
  throw new Error("Correction card queried after its retry boundary timer was disposed")
}

console.log("21 VibeLingo UI states and tool-card interactions rendered successfully")
GlobalRegistrator.unregister()

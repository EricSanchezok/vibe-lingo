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
  trackingEnabled: true,
  recurringFocusEnabled: true,
}
let currentSettings: Record<string, unknown> = configuredSettings
let currentReview: any

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
  findingsLast30Days: 31,
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
  items: [{
    id: eventId,
    type: "practice_started",
    occurredAt: now,
    scopeId: "scope-test",
    sessionId: "session-test",
  }, {
    id: "44444444-4444-4444-8444-444444444444",
    type: "pattern_reviewable",
    occurredAt: now - DAY,
    patternKey: pattern.patternKey,
  }],
}
const queue = {
  due: [{
    patternKey: pattern.patternKey,
    label: pattern.label,
    rule: pattern.rule,
    severity: "high_value",
    dueAt: now,
    overdueDays: 0,
    occurrenceCount: 6,
    lapseCount: 0,
  }],
  upcoming: [{
    patternKey: "natural_request",
    label: "Natural requests",
    rule: "Prefer direct verbs for task instructions.",
    severity: "high_value",
    dueAt: now + DAY,
    overdueDays: 0,
    occurrenceCount: 4,
    lapseCount: 0,
  }],
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
    async get() { return currentSettings },
    async replace(values: Record<string, unknown>) {
      currentSettings = values
      subscribers.forEach((listener) => listener(values))
    },
    subscribe(listener: (settings: Record<string, unknown>) => void) {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
  },
  events: { subscribe() { return () => undefined } },
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
    async confirm() { return true },
  },
  operations: {
    async query(id: string) {
      if (id === "learning-profiles") return {
        current: configuredSettings,
        profiles: [{
          nativeLanguage: "zh-Hans",
          targetLanguage: "en",
          proficiency: "intermediate",
          firstUsedAt: now - 40 * DAY,
          lastUsedAt: now,
        }, {
          nativeLanguage: "en",
          targetLanguage: "es",
          proficiency: "beginner",
          firstUsedAt: now - 10 * DAY,
          lastUsedAt: now - DAY,
        }],
      }
      if (id === "learning-summary") return summary
      if (id === "learning-journey") return journey
      if (id === "review-queue") return { ...queue, activeReview: currentReview }
      if (id === "review-state") return { state: currentReview }
      if (id === "learning-patterns") return { items: [pattern] }
      if (id === "learning-pattern-detail") return {
        found: true,
        pattern,
        evidenceTimeline: [{
          id: "55555555-5555-4555-8555-555555555555",
          kind: "error",
          outcome: "incorrect",
          confidence: .98,
          observedAt: now - DAY,
          originalFragment: "add button",
          correctedFragment: "add a button",
        }],
        reviewHistory: [],
        trend: trends.slice(-30).map((point) => ({
          date: point.date,
          errors: point.findings,
          naturalCorrectUses: point.naturalCorrectUses,
          independentReviews: point.independentReviews,
        })),
        contexts: [{
          scopeId: "scope-test",
          sessionCount: 4,
          evidenceCount: 8,
          errorCount: 6,
          naturalCorrectCount: 2,
          reviewCount: 1,
          lastSeenAt: now,
        }],
      }
      if (id === "learning-record") return {
        found: true,
        event: journey.items[0],
        patterns: [pattern],
        evidence: [],
        review: currentReview?.status === "completed" ? currentReview : undefined,
        sessionSummary: {
          analyzedMessages: 8,
          targetAttempts: 8,
          findings: 2,
          demonstrations: 2,
          discoveredPatterns: 1,
        },
        sourceSession: { id: "session-test", title: "Refine checkout flow" },
      }
      throw new Error(`Unexpected query ${id}`)
    },
    async command(id: string, input: any) {
      if (id === "pattern-presentations") return {
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
  ["view=review", "提示", review("awaiting_response", { hintLevel: 1, visibleHints: ["想一想单数名词前的词。"] })],
  ["view=review", "用正确形式再写一次", review("awaiting_repair", { latestFeedback: "缺少冠词。", referenceAnswer: "Add a button." })],
  ["view=review", "在新场景中使用它", review("awaiting_transfer", { latestFeedback: "很好。", referenceAnswer: "Add a button." })],
  ["view=review", "本次复习完成", {
    ...reviewBase,
    status: "completed",
    completionEventId: eventId,
    currentItem: undefined,
    completedItems: [{
      id: itemId,
      patternKey: pattern.patternKey,
      label: pattern.label,
      outcome: "independent",
      hintCount: 0,
      scheduleStep: 1,
      dueAt: now + 3 * DAY,
      completedAt: now,
    }],
    summary: {
      completedPatternCount: 1,
      independentRecallCount: 1,
      assistedPatternCount: 0,
      successfulTransferCount: 1,
    },
  }],
  ["view=patterns", "从真实工作表达中整理出的个人学习档案"],
  ["view=pattern&pattern=missing_article", "证据时间线"],
  ["view=pattern&pattern=missing_article", "模式操作"],
  ["view=journey", "按时间回看真实工作"],
  [`view=record&event=${eventId}`, "来源会话摘要"],
  ["view=settings", "复习只会在你主动"],
]

const mounted = await mount("view=overview")
for (const [route, expected, state] of screens) {
  currentReview = state
  context.host.openPluginPage("learning", Object.fromEntries(new URLSearchParams(route)))
  await new Promise((resolve) => setTimeout(resolve, 35))
  assertText(mounted.target, expected)
  if (state?.status === "completed") assertText(mounted.target, "查看学习记录")
  if (route === "view=review") {
    context.host.openPluginPage("learning", { view: "overview" })
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

context.host.openPluginPage("learning", { view: "overview" })
await new Promise((resolve) => setTimeout(resolve, 20))
const profileButton = mounted.target.querySelector<HTMLButtonElement>(".vld-profile-trigger")
if (!profileButton) throw new Error("Profile trigger was not rendered")
profileButton.click()
await new Promise((resolve) => setTimeout(resolve, 0))
assertText(document.body, "其他学习档案")
profileButton.click()

await context.settings.replace({ ...configuredSettings, nativeLanguage: "", targetLanguage: "" })
await new Promise((resolve) => setTimeout(resolve, 20))
assertText(mounted.target, "设置你的学习档案")
mounted.dispose()
mounted.target.remove()

console.log("14 VibeLingo UI states rendered successfully")

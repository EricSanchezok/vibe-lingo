import type {
  LearningEventType,
  PatternDisplayStatus,
  ReviewOutcome,
} from "../domain/types"
import { languageDisplayName } from "../language"
import type { VibeLingoSettings } from "../settings"

export type UiLocale = "en" | "zh-CN"

const COPY = {
  en: {
    overview: "Overview",
    review: "Review",
    patterns: "Learning patterns",
    settings: "Settings",
    journey: "Learning journey",
    loading: "Loading learning data…",
    loadFailed: "Learning data could not be loaded.",
    retry: "Try again",
    noData: "No learning evidence yet",
    noDataHelp: "Use the language in real Synergy tasks. VibeLingo will quietly build your learning history.",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    week: "Learning week",
    streak: "Current streak",
    activeDays: "Active days",
    sessions: "Real sessions",
    days: "days",
    evidence: "Learning evidence",
    evidenceHelp: "What you produced, noticed, used correctly, and recalled independently.",
    range7: "7 days",
    range30: "30 days",
    range90: "90 days",
    attempts: "Target-language attempts",
    findings: "Useful findings",
    naturalUses: "Natural correct uses",
    independentReviews: "Independent reviews",
    recent30: "Recent 30 days",
    dueNow: "Due now",
    upcoming: "Coming up",
    startReview: "Start today’s review",
    resumeReview: "Resume review",
    allCaughtUp: "You’re caught up",
    allCaughtUpHelp: "There are no patterns due today. Upcoming items stay visible so you can plan ahead.",
    earlyPractice: "Early practice",
    next: "Next",
    recentJourney: "Recent journey",
    viewAll: "View all records",
    recentNatural: "Recent natural use",
    improving: "Improving",
    verified: "Verified",
    noRecentNatural: "A natural correct use will appear here when there is enough evidence.",
    searchPatterns: "Search patterns",
    allStatuses: "All statuses",
    allScopes: "All scopes",
    currentScope: "Current scope",
    priority: "Priority",
    recent: "Recent",
    frequency: "Frequency",
    due: "Due",
    status: "Status",
    pattern: "Pattern",
    scope: "Scope",
    lastSeen: "Last seen",
    occurrences: "occurrences",
    sessionsCount: "sessions",
    previousPage: "Previous",
    nextPage: "Next",
    page: "Page",
    noPatterns: "No matching learning patterns",
    noPatternsHelp: "Change the filters or keep using the target language in real work.",
    backToPatterns: "All patterns",
    schedule: "Review schedule",
    evidenceTimeline: "Evidence timeline",
    reviewHistory: "Review history",
    workContexts: "Work contexts",
    examples: "Recent examples",
    contentNotRetained: "Content was not retained",
    patternActions: "Pattern actions",
    ignore: "Ignore",
    restore: "Restore",
    notError: "Not an error",
    delete: "Delete",
    merge: "Merge",
    mergeInto: "Merge into another pattern",
    choosePattern: "Choose a target pattern",
    cancel: "Cancel",
    confirmMerge: "Merge patterns",
    filters: "Filters",
    allEvents: "All activity",
    realWork: "Real work",
    reviews: "Reviews",
    milestones: "Pattern milestones",
    noJourney: "No learning journey entries match these filters.",
    recordDetail: "Learning record",
    openSession: "Open source session",
    sourceUnavailable: "Source session is outside the current scope",
    analyzedMessages: "Messages analyzed",
    demonstrations: "Natural uses",
    discoveredPatterns: "Patterns discovered",
    reviewQueue: "Today’s review",
    reviewQueueHelp: "Practice patterns from your real work. Due items come first.",
    reviewProgress: "Review progress",
    later: "Later",
    endReview: "End this review",
    hint: "Show a hint",
    anotherHint: "Show another hint",
    yourAnswer: "Your answer",
    submitAnswer: "Check answer",
    repair: "Try the corrected form",
    submitRepair: "Check correction",
    transfer: "Use it in a new situation",
    submitTransfer: "Check transfer",
    feedback: "Feedback",
    reference: "Natural expression",
    continue: "Continue",
    completeReview: "Complete review",
    reviewComplete: "Review complete",
    completedPatterns: "Patterns reviewed",
    independentRecall: "Independent recall",
    assisted: "Completed with help",
    successfulTransfer: "Successful transfer",
    nextDue: "Next review",
    viewReviewRecord: "View learning record",
    setupTitle: "Set up your learning profile",
    setupHelp: "Choose a support language and a different language to practice before learning data is collected.",
    manualReviewNote: "Reviews start only when you choose to begin one from VibeLingo.",
    addLanguage: "Add or manage languages",
    activeProfile: "Current learning profile",
    profileHistory: "Other learning profiles",
    saved: "Saved",
    saving: "Saving…",
    conflict: "This review changed in another window. The latest state is now shown.",
    actionFailed: "The action could not be completed.",
    generationFailed: "The review item could not be prepared. Try again without losing your place.",
    evaluationFailed: "The answer could not be evaluated confidently. Try again.",
  },
  "zh-CN": {
    overview: "总览",
    review: "复习",
    patterns: "学习模式",
    settings: "设置",
    journey: "学习旅程",
    loading: "正在加载学习数据…",
    loadFailed: "学习数据暂时无法加载。",
    retry: "重试",
    noData: "还没有学习证据",
    noDataHelp: "在真实的 Synergy 任务中使用目标语言，VibeLingo 会安静地整理你的学习经历。",
    greetingMorning: "早上好",
    greetingAfternoon: "下午好",
    greetingEvening: "晚上好",
    week: "学习周数",
    streak: "当前连续",
    activeDays: "活跃日",
    sessions: "真实会话",
    days: "天",
    evidence: "学习证据",
    evidenceHelp: "你表达过、注意到、自然用对，以及独立回忆出的内容。",
    range7: "7 天",
    range30: "30 天",
    range90: "90 天",
    attempts: "目标语言表达",
    findings: "有价值发现",
    naturalUses: "自然正确使用",
    independentReviews: "独立复习",
    recent30: "最近 30 天",
    dueNow: "现在到期",
    upcoming: "即将到期",
    startReview: "开始今天的复习",
    resumeReview: "继续上次复习",
    allCaughtUp: "今天的复习已经完成",
    allCaughtUpHelp: "目前没有到期模式；即将到期的内容会继续显示，方便你提前安排。",
    earlyPractice: "可提前练习",
    next: "下一步",
    recentJourney: "最近的学习旅程",
    viewAll: "查看全部记录",
    recentNatural: "最近自然用对",
    improving: "正在改善",
    verified: "已验证",
    noRecentNatural: "有足够证据后，最近自然用对的表达会显示在这里。",
    searchPatterns: "搜索模式",
    allStatuses: "全部状态",
    allScopes: "全部范围",
    currentScope: "当前范围",
    priority: "优先级",
    recent: "最近出现",
    frequency: "出现频率",
    due: "到期时间",
    status: "状态",
    pattern: "模式",
    scope: "范围",
    lastSeen: "最近出现",
    occurrences: "次出现",
    sessionsCount: "个会话",
    previousPage: "上一页",
    nextPage: "下一页",
    page: "第",
    noPatterns: "没有符合条件的学习模式",
    noPatternsHelp: "可以调整筛选，或继续在真实工作中使用目标语言。",
    backToPatterns: "全部模式",
    schedule: "复习安排",
    evidenceTimeline: "证据时间线",
    reviewHistory: "复习记录",
    workContexts: "工作场景",
    examples: "最近例子",
    contentNotRetained: "具体内容未保留",
    patternActions: "模式操作",
    ignore: "忽略",
    restore: "恢复",
    notError: "这不是错误",
    delete: "删除",
    merge: "合并",
    mergeInto: "合并到另一个模式",
    choosePattern: "选择目标模式",
    cancel: "取消",
    confirmMerge: "确认合并",
    filters: "筛选",
    allEvents: "全部活动",
    realWork: "真实工作",
    reviews: "复习",
    milestones: "模式里程碑",
    noJourney: "没有符合当前筛选的学习记录。",
    recordDetail: "学习记录",
    openSession: "打开来源会话",
    sourceUnavailable: "来源会话不在当前范围内",
    analyzedMessages: "已分析消息",
    demonstrations: "自然正确使用",
    discoveredPatterns: "形成的模式",
    reviewQueue: "今天的复习",
    reviewQueueHelp: "练习来自真实工作的模式，到期内容会排在前面。",
    reviewProgress: "复习进度",
    later: "稍后再说",
    endReview: "结束本次复习",
    hint: "查看提示",
    anotherHint: "再看一个提示",
    yourAnswer: "你的表达",
    submitAnswer: "检查表达",
    repair: "用正确形式再写一次",
    submitRepair: "检查修正",
    transfer: "在新场景中使用它",
    submitTransfer: "检查迁移练习",
    feedback: "反馈",
    reference: "自然表达",
    continue: "继续",
    completeReview: "完成复习",
    reviewComplete: "本次复习完成",
    completedPatterns: "完成模式",
    independentRecall: "独立回忆",
    assisted: "借助提示完成",
    successfulTransfer: "成功迁移",
    nextDue: "下次复习",
    viewReviewRecord: "查看学习记录",
    setupTitle: "设置你的学习档案",
    setupHelp: "先选择用于解释的语言和一门不同的目标语言，之后才会开始记录学习数据。",
    manualReviewNote: "复习只会在你主动从 VibeLingo 开始时进行。",
    addLanguage: "添加或管理语言",
    activeProfile: "当前学习档案",
    profileHistory: "其他学习档案",
    saved: "已保存",
    saving: "正在保存…",
    conflict: "这次复习已在其他窗口更新，现在显示的是最新状态。",
    actionFailed: "操作未能完成。",
    generationFailed: "复习内容暂时无法生成，你的位置不会丢失，可以重试。",
    evaluationFailed: "暂时无法可靠评估这个答案，请重试。",
  },
} as const

export type CopyKey = keyof typeof COPY.en

export function localeForSettings(settings: VibeLingoSettings): UiLocale {
  if (settings.nativeLanguage) {
    try {
      if (new Intl.Locale(settings.nativeLanguage).language === "zh") return "zh-CN"
    } catch {
      // Fall back to the host document language.
    }
  }
  return typeof document !== "undefined"
    && document.documentElement.lang.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en"
}

export function copy(locale: UiLocale, key: CopyKey): string {
  return COPY[locale][key]
}

export function formatNumber(locale: UiLocale, value: number): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatDate(locale: UiLocale, value: number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options ?? {
    month: "short",
    day: "numeric",
  }).format(value)
}

export function formatRelativeDate(locale: UiLocale, value: number, now = Date.now()): string {
  const days = Math.round((value - now) / 86_400_000)
  if (Math.abs(days) <= 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day")
  }
  return formatDate(locale, value)
}

export function formatLastChecked(locale: UiLocale, value: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - value)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (elapsed < 60_000) return locale === "zh-CN" ? "刚刚" : "just now"
  if (elapsed < 3_600_000) return relative.format(-Math.max(1, Math.round(elapsed / 60_000)), "minute")
  if (elapsed < 86_400_000) return relative.format(-Math.max(1, Math.round(elapsed / 3_600_000)), "hour")
  return formatRelativeDate(locale, value, now)
}

export function practiceActivityLabel(
  locale: UiLocale,
  attemptCount: number,
  findingCount: number,
): string {
  return locale === "zh-CN"
    ? `${attemptCount} 次目标语言表达 · ${findingCount} 条学习发现`
    : `${attemptCount} target-language attempts · ${findingCount} learning findings`
}

export function greeting(locale: UiLocale, hour = new Date().getHours()): string {
  return copy(
    locale,
    hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening",
  )
}

export function profileLabel(
  locale: UiLocale,
  profile: { nativeLanguage: string; targetLanguage: string; proficiency: string },
): string {
  const level = profile.proficiency === "beginner"
    ? locale === "zh-CN" ? "初学" : "Beginner"
    : profile.proficiency === "advanced"
      ? locale === "zh-CN" ? "进阶" : "Advanced"
      : locale === "zh-CN" ? "中级" : "Intermediate"
  return `${languageDisplayName(profile.nativeLanguage, locale)} → ${languageDisplayName(profile.targetLanguage, locale)} · ${level}`
}

export function statusLabel(locale: UiLocale, status: PatternDisplayStatus | "ignored" | "rejected"): string {
  const labels = locale === "zh-CN"
    ? { new: "新模式", focus: "重点", improving: "改善中", verified: "已验证", ignored: "已忽略", rejected: "非错误" }
    : { new: "New", focus: "Focus", improving: "Improving", verified: "Verified", ignored: "Ignored", rejected: "Not an error" }
  return labels[status]
}

export function outcomeLabel(locale: UiLocale, outcome: ReviewOutcome): string {
  const labels = locale === "zh-CN"
    ? { failed: "未完成", assisted: "借助提示完成", independent: "独立完成", abandoned: "已结束" }
    : { failed: "Not completed", assisted: "Completed with help", independent: "Independent", abandoned: "Ended" }
  return labels[outcome]
}

export function eventLabel(locale: UiLocale, type: LearningEventType): string {
  const labels = locale === "zh-CN"
      ? {
        practice_started: "在真实工作中使用目标语言",
        correction_recorded: "记录了一次可见纠正",
        pattern_discovered: "建立新的学习模式",
        pattern_reviewable: "一个模式进入复习阶段",
        review_item_completed: "完成一个模式的复习",
        review_completed: "完成一次复习",
        pattern_verified: "一个模式获得稳定证据",
        pattern_lapsed: "一个已验证模式再次出现问题",
      }
      : {
        practice_started: "Used the target language in real work",
        correction_recorded: "Recorded a visible correction",
        pattern_discovered: "Created a new learning pattern",
        pattern_reviewable: "A pattern became ready for review",
        review_item_completed: "Completed one pattern review",
        review_completed: "Completed a review",
        pattern_verified: "A pattern gained stable evidence",
        pattern_lapsed: "A verified pattern appeared incorrectly again",
      }
  return labels[type]
}

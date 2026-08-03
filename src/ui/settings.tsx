import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js"
import { Portal } from "solid-js/web"
import type { PluginSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import {
  COMMON_LANGUAGE_TAGS,
  canonicalLanguageTag,
  languageDisplayName,
} from "../language"
import {
  DEFAULT_SETTINGS,
  VibeLingoSettingsSchema,
  configuredProfile,
  type VibeLingoSettings,
} from "../settings"
import type { ClearLearningDataResult, LearningSummary } from "../domain/types"
import { localeForSettings, type UiLocale } from "./i18n"
import { createSettingsController } from "./settings-controller"
import { createSettingsPopoverMount } from "./settings-popover"
import { learningThemeDeclarations } from "./learning-theme"

type SurfaceInput = (PluginSurfaceContext | { context: PluginSurfaceContext }) & {
  embedded?: boolean
}
type Copy = {
  subtitle: string
  setupRequired: string
  active: string
  loading: string
  saving: string
  saved: string
  saveFailed: string
  loadFailed: string
  dataFailed: string
  profile: string
  profileDescription: string
  nativeLanguage: string
  nativeLanguageHelp: string
  targetLanguage: string
  targetLanguageHelp: string
  languagePlaceholder: string
  customLanguage: string
  invalidLanguage: string
  sameLanguage: string
  level: string
  levelHelp: string
  beginner: string
  beginnerDescription: string
  intermediate: string
  intermediateDescription: string
  advanced: string
  advancedDescription: string
  start: string
  coaching: string
  coachingDescription: string
  focused: string
  focusedDescription: string
  strict: string
  strictDescription: string
  off: string
  offDescription: string
  naturalness: string
  naturalnessDescription: string
  tracking: string
  trackingDescription: string
  recurring: string
  recurringDescription: string
  models: string
  modelsDescription: string
  detectionModel: string
  detectionModelDescription: string
  analysisModel: string
  analysisModelDescription: string
  translationModel: string
  translationModelDescription: string
  reviewModel: string
  reviewModelDescription: string
  translationHistory: string
  translationHistoryDescription: string
  on: string
  offState: string
  data: string
  dataDescription: string
  noHistory: string
  messages: string
  findings: string
  recurringPatterns: string
  clearTarget: string
  clearAll: string
  clearTargetTitle: (language: string) => string
  clearTargetMessage: (language: string) => string
  clearTargetConfirm: string
  clearAllTitle: string
  clearAllMessage: string
  clearAllConfirm: string
  deleted: (result: ClearLearningDataResult) => string
}

const COPY: Record<UiLocale, Copy> = {
  en: {
    subtitle: "Practice a language while Synergy helps you get real work done.",
    setupRequired: "Setup required",
    active: "Active",
    loading: "Loading VibeLingo settings…",
    saving: "Saving…",
    saved: "Saved",
    saveFailed: "We couldn't save your VibeLingo settings. Your previous settings are still active.",
    loadFailed: "We couldn't load your VibeLingo settings. Try reopening this page.",
    dataFailed: "We couldn't update your VibeLingo learning data.",
    profile: "Learning profile",
    profileDescription: "Choose the language you rely on and the language you want to practice.",
    nativeLanguage: "Language I’m most comfortable with",
    nativeLanguageHelp: "VibeLingo uses this language when an explanation is useful.",
    targetLanguage: "Language I’m learning",
    targetLanguageHelp: "Corrections and recurring patterns are kept separately for this language.",
    languagePlaceholder: "Search by language or enter a tag",
    customLanguage: "Use custom language tag",
    invalidLanguage: "Enter a valid language tag, such as en, zh-Hans, or pt-BR.",
    sameLanguage: "Choose two different languages.",
    level: "Current level",
    levelHelp: "This changes which kinds of feedback are most useful.",
    beginner: "Beginner",
    beginnerDescription: "Simple, usable phrasing and foundational corrections.",
    intermediate: "Intermediate",
    intermediateDescription: "Clear, transferable corrections without too much detail.",
    advanced: "Advanced",
    advancedDescription: "Nuance, collocation, register, and natural phrasing.",
    start: "Start language coaching",
    coaching: "Coaching",
    coachingDescription: "Control when VibeLingo speaks up and what it remembers.",
    focused: "Focused",
    focusedDescription: "High-value, clearly unnatural, or recurring issues.",
    strict: "Strict",
    strictDescription: "Every certain target-language issue.",
    off: "Off",
    offDescription: "No coaching in Agent responses.",
    naturalness: "Suggest more natural phrasing",
    naturalnessDescription:
      "Speak up when grammatical wording has a clearly more conventional form in context, without rewriting for style alone.",
    tracking: "Track recurring patterns",
    trackingDescription: "Analyze eligible messages and store minimal local learning signals.",
    recurring: "Use recurring focus",
    recurringDescription: "Prioritize established patterns when they appear again.",
    models: "Models",
    modelsDescription: "Choose a Synergy model role for each kind of language work.",
    detectionModel: "Language detection",
    detectionModelDescription: "Classifies whether a message is an attempt in your target language.",
    analysisModel: "Learning analysis",
    analysisModelDescription: "Organizes visible corrections and recognizes natural use of known patterns.",
    translationModel: "Translation",
    translationModelDescription: "Translates selected text into your native or target language.",
    reviewModel: "Review and presentation",
    reviewModelDescription: "Builds and evaluates reviews and presents learning patterns.",
    translationHistory: "Save translation history",
    translationHistoryDescription: "Save selected source text and translations locally, then reuse them without another model call.",
    on: "On",
    offState: "Off",
    data: "Learning data",
    dataDescription: "A compact view of local data for the active target language.",
    noHistory: "No learning history for this language yet.",
    messages: "messages analyzed",
    findings: "findings in 30 days",
    recurringPatterns: "recurring patterns",
    clearTarget: "Clear this language",
    clearAll: "Clear all learning data",
    clearTargetTitle: (language) => `Delete ${language} learning history?`,
    clearTargetMessage: (language) =>
      `This permanently deletes stored ${language} patterns and examples. Your settings will stay unchanged.`,
    clearTargetConfirm: "Delete language history",
    clearAllTitle: "Delete all VibeLingo learning data?",
    clearAllMessage:
      "This permanently deletes patterns and examples for every target language. Your settings will stay unchanged.",
    clearAllConfirm: "Delete all learning data",
    deleted: (result) =>
      `Deleted ${result.deletedPatterns} patterns from ${result.deletedMessages} analyzed messages.`,
  },
  "zh-CN": {
    subtitle: "在 Synergy 帮你完成真实工作的同时，自然练习一门语言。",
    setupRequired: "需要完成设置",
    active: "已启用",
    loading: "正在加载 VibeLingo 设置…",
    saving: "正在保存…",
    saved: "已保存",
    saveFailed: "VibeLingo 设置未能保存，之前的设置仍然有效。",
    loadFailed: "VibeLingo 设置未能加载，请重新打开此页面。",
    dataFailed: "VibeLingo 学习数据未能更新。",
    profile: "学习档案",
    profileDescription: "选择你最熟悉的语言，以及你想在工作中练习的语言。",
    nativeLanguage: "我最熟悉的语言",
    nativeLanguageHelp: "需要解释时，VibeLingo 会优先使用这门语言。",
    targetLanguage: "我正在学习",
    targetLanguageHelp: "纠正和重复模式会按目标语言分别保存。",
    languagePlaceholder: "搜索语言或输入语言标签",
    customLanguage: "使用自定义语言标签",
    invalidLanguage: "请输入有效的语言标签，例如 en、zh-Hans 或 pt-BR。",
    sameLanguage: "请选择两门不同的语言。",
    level: "当前水平",
    levelHelp: "这会影响 VibeLingo 优先指出哪些问题。",
    beginner: "初学",
    beginnerDescription: "简单、可直接使用的表达和基础纠正。",
    intermediate: "中级",
    intermediateDescription: "清晰、可迁移的纠正，不过度展开。",
    advanced: "进阶",
    advancedDescription: "关注细微含义、搭配、语域和自然表达。",
    start: "开始语言辅导",
    coaching: "辅导方式",
    coachingDescription: "控制 VibeLingo 何时提醒你，以及记录哪些学习信号。",
    focused: "专注",
    focusedDescription: "只处理高价值、明显不自然或已经重复出现的问题。",
    strict: "严格",
    strictDescription: "处理所有确认存在的目标语言问题。",
    off: "关闭",
    offDescription: "不在 Agent 回复中提供语言辅导。",
    naturalness: "自然表达建议",
    naturalnessDescription: "语法正确但在当前语境中有明显更常用的表达时提醒，不做纯风格改写。",
    tracking: "记录重复模式",
    trackingDescription: "分析符合条件的消息，并在本地保存最少量学习信号。",
    recurring: "使用重复模式",
    recurringDescription: "同一问题再次出现时优先提醒。",
    models: "模型",
    modelsDescription: "为不同类型的语言任务选择 Synergy 模型角色。",
    detectionModel: "语言检测",
    detectionModelDescription: "判断消息是否是在尝试使用目标语言。",
    analysisModel: "学习分析",
    analysisModelDescription: "整理已展示的纠正，并识别已知模式的自然正确使用。",
    translationModel: "划词翻译",
    translationModelDescription: "把选中的文字翻译成母语或目标语言。",
    reviewModel: "复习与模式呈现",
    reviewModelDescription: "生成和评估复习内容，并呈现学习模式。",
    translationHistory: "保存翻译记录",
    translationHistoryDescription: "在本地保存选区原文和译文，重复选择时无需再次调用模型。",
    on: "开启",
    offState: "关闭",
    data: "学习数据",
    dataDescription: "这里只显示当前目标语言的本地数据摘要。",
    noHistory: "这门语言还没有学习记录。",
    messages: "条消息已分析",
    findings: "条近 30 天发现",
    recurringPatterns: "个重复模式",
    clearTarget: "清除这门语言",
    clearAll: "清除全部学习数据",
    clearTargetTitle: (language) => `删除 ${language} 学习记录？`,
    clearTargetMessage: (language) =>
      `这会永久删除已保存的 ${language} 模式和例子，但不会改变你的设置。`,
    clearTargetConfirm: "删除这门语言的记录",
    clearAllTitle: "删除全部 VibeLingo 学习数据？",
    clearAllMessage: "这会永久删除所有目标语言的模式和例子，但不会改变你的设置。",
    clearAllConfirm: "删除全部学习数据",
    deleted: (result) =>
      `已删除 ${result.deletedMessages} 条消息中的 ${result.deletedPatterns} 个模式。`,
  },
}

const styles = `
.vl-settings{${learningThemeDeclarations}box-sizing:border-box;width:min(100%,720px);padding:36px 48px 52px;color:var(--text-base);font-family:var(--font-family-sans,system-ui,sans-serif);font-size:var(--type-ui-body-size,.875rem);line-height:var(--type-ui-body-line-height,1.5)}
.vl-settings[data-embedded=true] .vl-header{display:none}
.vl-settings *{box-sizing:border-box}
.vl-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}
.vl-title{margin:0;color:var(--text-strong);font-size:var(--type-ui-page-title-size,1.5rem);line-height:var(--type-ui-page-title-line-height,1.25);font-weight:var(--font-weight-semibold,600)}
.vl-subtitle{max-width:62ch;margin:5px 0 0;color:var(--text-weak);line-height:1.5}
.vl-header-state{display:flex;align-items:center;gap:7px;min-height:28px;padding:4px 9px;border-radius:999px;background:var(--surface-inset-base);color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem);white-space:nowrap}
.vl-state-dot{width:7px;height:7px;border-radius:50%;background:var(--vibe-amber-strong)}
.vl-header-state[data-active=true] .vl-state-dot{background:var(--vibe-sage-strong)}
.vl-save-state{min-height:20px;margin-top:8px;color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem);text-align:right}
.vl-section{padding:28px 0;border-bottom:1px solid color-mix(in srgb,var(--border-base) 34%,transparent)}
.vl-section:last-child{border-bottom:0;padding-bottom:0}
.vl-section-head{margin-bottom:18px}
.vl-section-title{margin:0;color:var(--text-strong);font-size:var(--type-ui-section-title-size,1rem);line-height:var(--type-ui-section-title-line-height,1.35);font-weight:var(--font-weight-semibold,600)}
.vl-section-copy{max-width:65ch;margin:5px 0 0;color:var(--text-weak);line-height:1.5}
.vl-language-grid{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);align-items:end;gap:12px}
.vl-language-arrow{display:grid;place-items:center;height:44px;color:var(--text-weaker);font-size:18px}
.vl-field-label{display:block;margin:0 0 5px;color:var(--text-strong);font-size:var(--type-ui-row-title-size,.875rem);font-weight:var(--font-weight-medium,500)}
.vl-field-help{min-height:36px;margin:0 0 9px;color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem);line-height:1.5}
.vl-combobox-wrap{position:relative}
.vl-combobox{width:100%;height:44px;border:1px solid var(--border-weaker-base);border-radius:8px;background:var(--input-base);color:var(--text-strong);padding:0 36px 0 12px;font:inherit;outline:none;transition:border-color 160ms ease,background-color 160ms ease,box-shadow 160ms ease}
.vl-combobox:hover{background:var(--input-hover)}
.vl-combobox:focus-visible{border-color:var(--border-strong-base);box-shadow:0 0 0 3px color-mix(in srgb,var(--text-strong) 8%,transparent)}
.vl-combobox:disabled{cursor:not-allowed;opacity:.5}
.vl-combobox-icon{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--text-weaker);pointer-events:none}
.vl-language-portal{pointer-events:auto}
.vl-language-popover{position:fixed;z-index:90;max-height:248px;overflow:auto;border:1px solid var(--border-base);border-radius:10px;background:var(--surface-raised-stronger-non-alpha);box-shadow:0 6px 8px color-mix(in srgb,var(--surface-overlay) 35%,transparent);padding:5px}
.vl-language-option{display:flex;width:100%;min-height:42px;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:7px;background:transparent;color:var(--text-base);padding:8px 9px;text-align:left;font:inherit;cursor:pointer}
.vl-language-option:hover,.vl-language-option[data-active=true]{background:var(--surface-hover-base)}
.vl-language-option:focus-visible{outline:2px solid var(--border-focus);outline-offset:-2px}
.vl-language-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vl-language-tag{color:var(--text-weaker);font-size:var(--type-ui-caption-size,.75rem);font-variant-numeric:tabular-nums}
.vl-error{margin:12px 0 0;border-radius:8px;background:var(--surface-critical-weak);color:var(--text-on-critical-base);padding:10px 12px;font-size:var(--type-ui-caption-size,.75rem)}
.vl-control-block{margin-top:22px}
.vl-segmented{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.vl-segment{min-height:44px;border:1px solid var(--border-weaker-base);border-radius:8px;background:var(--surface-base);color:var(--text-base);padding:8px 10px;font:inherit;font-weight:var(--font-weight-medium,500);cursor:pointer;transition:background-color 160ms ease,border-color 160ms ease}
.vl-segment:hover{background:var(--surface-base-hover)}
.vl-segment[data-selected=true]{border-color:color-mix(in srgb,var(--vibe-sage-strong) 42%,var(--border-base));background:var(--vibe-sage-surface);color:var(--vibe-sage-ink)}
.vl-segment:focus-visible,.vl-button:focus-visible,.vl-switch:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.vl-segment:disabled,.vl-switch:disabled{cursor:not-allowed;opacity:.5}
.vl-selection-help{min-height:20px;margin:8px 0 0;color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem)}
.vl-primary-row{display:flex;justify-content:flex-end;margin-top:22px}
.vl-button{min-height:40px;border:1px solid var(--border-base);border-radius:8px;background:var(--surface-base);color:var(--text-base);padding:8px 13px;font:inherit;font-weight:var(--font-weight-medium,500);cursor:pointer;transition:background-color 160ms ease,border-color 160ms ease}
.vl-button:hover{background:var(--surface-base-hover)}
.vl-button[data-primary=true]{border-color:var(--vibe-sage-action);background:var(--vibe-sage-action);color:var(--text-on-interactive-base)}
.vl-button[data-primary=true]:hover{filter:brightness(.94)}
.vl-button[data-danger=true]{color:var(--text-on-critical-base);border-color:var(--surface-critical-base);background:var(--surface-critical-weak)}
.vl-button:disabled{cursor:not-allowed;opacity:.5}
.vl-setting-row{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:64px;padding:10px 0}
.vl-row-copy{min-width:0}
.vl-row-title{display:block;color:var(--text-strong);font-weight:var(--font-weight-medium,500)}
.vl-row-description{display:block;margin-top:3px;color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem);line-height:1.45}
.vl-model-select{min-width:190px;height:38px;border:1px solid var(--border-weaker-base);border-radius:8px;background:var(--input-base);color:var(--text-strong);padding:0 30px 0 10px;font:inherit;outline:none}
.vl-model-select:focus-visible{border-color:var(--border-strong-base);box-shadow:0 0 0 3px color-mix(in srgb,var(--text-strong) 8%,transparent)}
.vl-model-select:disabled{cursor:not-allowed;opacity:.5}
.vl-switch-wrap{display:flex;align-items:center;gap:8px;color:var(--text-weak);font-size:var(--type-ui-caption-size,.75rem)}
.vl-switch{position:relative;width:44px;height:44px;border:0;background:transparent;padding:0;cursor:pointer}
.vl-switch-track{position:absolute;left:2px;top:11px;width:40px;height:22px;border-radius:999px;background:var(--surface-disabled);transition:background-color 160ms ease}
.vl-switch[aria-checked=true] .vl-switch-track{background:var(--vibe-sage-action)}
.vl-switch-knob{position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:var(--text-on-interactive-base);transition:transform 160ms ease}
.vl-switch[aria-checked=true] .vl-switch-knob{transform:translateX(18px)}
.vl-data-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;color:var(--text-weak)}
.vl-data-summary strong{color:var(--text-strong);font-weight:var(--font-weight-semibold,600);font-variant-numeric:tabular-nums}
.vl-data-separator{color:var(--text-weaker)}
.vl-empty{color:var(--text-weak)}
.vl-data-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap}
.vl-skeleton{padding-top:24px}
.vl-skeleton-line{height:14px;border-radius:6px;background:var(--surface-inset-base);margin-top:12px}
.vl-skeleton-line:nth-child(1){width:42%}.vl-skeleton-line:nth-child(2){width:86%}.vl-skeleton-line:nth-child(3){width:68%}
@media(max-width:720px){.vl-settings{width:100%;padding:28px 24px 44px}.vl-language-grid{grid-template-columns:1fr;gap:14px}.vl-language-arrow{height:18px;transform:rotate(90deg)}.vl-field-help{min-height:0}.vl-header{align-items:flex-start}.vl-data-actions{justify-content:flex-start}}
@media(max-width:480px){.vl-settings{padding:24px 16px 36px}.vl-header{display:block}.vl-header-state{width:max-content;margin-top:14px}.vl-save-state{text-align:left}.vl-segmented{grid-template-columns:1fr}.vl-setting-row{align-items:flex-start}.vl-model-select{min-width:145px;max-width:48%}.vl-switch-wrap{padding-top:1px}.vl-data-actions{align-items:stretch;flex-direction:column}.vl-button{width:100%}}
@media(prefers-reduced-motion:reduce){.vl-combobox,.vl-segment,.vl-button,.vl-switch-track,.vl-switch-knob{transition:none}}
`

function resolveContext(input: SurfaceInput): PluginSurfaceContext {
  return "context" in input ? input.context : input
}

type LanguageOption = { tag: string; name: string; custom?: boolean }

const LanguageCombobox: Component<{
  id: string
  label: string
  value: string
  locale: UiLocale
  placeholder: string
  customLabel: string
  disabled?: boolean
  onChange: (value: string) => void
  onInvalid: () => void
}> = (props) => {
  let inputElement: HTMLInputElement | undefined
  const [query, setQuery] = createSignal("")
  const [open, setOpen] = createSignal(false)
  const [activeIndex, setActiveIndex] = createSignal(0)
  const [position, setPosition] = createSignal({ left: 0, top: 0, width: 280 })
  const [popoverMount, setPopoverMount] = createSignal<HTMLElement>()

  const common = createMemo<LanguageOption[]>(() =>
    COMMON_LANGUAGE_TAGS.map((tag) => ({
      tag,
      name: languageDisplayName(tag, props.locale),
    })),
  )

  createEffect(() => {
    const value = props.value
    if (!open()) setQuery(value ? languageDisplayName(value, props.locale) : "")
  })

  const options = createMemo<LanguageOption[]>(() => {
    const needle = query().trim().toLocaleLowerCase(props.locale)
    const filtered = common()
      .filter(
        (option) =>
          !needle ||
          option.tag.toLowerCase().includes(needle) ||
          option.name.toLocaleLowerCase(props.locale).includes(needle),
      )
      .slice(0, 12)
    const canonical = canonicalLanguageTag(query())
    if (canonical && !filtered.some((option) => option.tag === canonical)) {
      filtered.unshift({
        tag: canonical,
        name: languageDisplayName(canonical, props.locale),
        custom: true,
      })
    }
    return filtered
  })

  function updatePosition() {
    if (!inputElement || typeof window === "undefined") return
    const rect = inputElement.getBoundingClientRect()
    const height = Math.min(248, Math.max(48, options().length * 42 + 12))
    const roomBelow = window.innerHeight - rect.bottom
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      top: roomBelow >= height + 8 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      width: rect.width,
    })
  }

  function openList() {
    setOpen(true)
    setActiveIndex(0)
    queueMicrotask(updatePosition)
  }

  function choose(option: LanguageOption) {
    props.onChange(option.tag)
    setQuery(option.name)
    setOpen(false)
  }

  function commitQuery() {
    const exact = common().find(
      (option) =>
        option.name.toLocaleLowerCase(props.locale) === query().trim().toLocaleLowerCase(props.locale),
    )
    const canonical = exact?.tag ?? canonicalLanguageTag(query())
    if (canonical) props.onChange(canonical)
    else if (query().trim()) props.onInvalid()
    if (!canonical) {
      setQuery(props.value ? languageDisplayName(props.value, props.locale) : "")
    }
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open()) openList()
      else setActiveIndex((current) => Math.min(options().length - 1, current + 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!open()) openList()
      else setActiveIndex((current) => Math.max(0, current - 1))
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const option = options()[activeIndex()]
      if (open() && option) choose(option)
      else commitQuery()
      return
    }
    if (event.key === "Escape") {
      setOpen(false)
      setQuery(props.value ? languageDisplayName(props.value, props.locale) : "")
    }
  }

  const reposition = () => open() && updatePosition()
  onMount(() => {
    if (inputElement) setPopoverMount(createSettingsPopoverMount(inputElement, document.body))
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
  })
  onCleanup(() => {
    window.removeEventListener("resize", reposition)
    window.removeEventListener("scroll", reposition, true)
    popoverMount()?.remove()
  })

  return (
    <div class="vl-combobox-wrap">
      <input
        ref={inputElement}
        id={props.id}
        class="vl-combobox"
        role="combobox"
        aria-label={props.label}
        aria-autocomplete="list"
        aria-expanded={open()}
        aria-controls={`${props.id}-listbox`}
        aria-activedescendant={open() ? `${props.id}-option-${activeIndex()}` : undefined}
        autocomplete="off"
        disabled={props.disabled}
        value={query()}
        placeholder={props.placeholder}
        onFocus={() => {
          setQuery(props.value)
          openList()
        }}
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          openList()
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(commitQuery, 120)}
      />
      <span class="vl-combobox-icon" aria-hidden="true">⌄</span>
      <Show when={open() && options().length > 0 && popoverMount()}>
        <Portal mount={popoverMount()}>
          <div
            id={`${props.id}-listbox`}
            class="vl-language-popover"
            role="listbox"
            style={{
              left: `${position().left}px`,
              top: `${position().top}px`,
              width: `${position().width}px`,
            }}
          >
            <For each={options()}>
              {(option, index) => (
                <button
                  id={`${props.id}-option-${index()}`}
                  type="button"
                  role="option"
                  aria-selected={option.tag === props.value}
                  class="vl-language-option"
                  data-active={index() === activeIndex()}
                  onMouseEnter={() => setActiveIndex(index())}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    choose(option)
                  }}
                >
                  <span class="vl-language-name">
                    {option.custom ? `${props.customLabel}: ` : ""}
                    {option.name}
                  </span>
                  <span class="vl-language-tag">{option.tag}</span>
                </button>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  )
}

const SegmentedControl: Component<{
  label: string
  value: string
  options: Array<{ value: string; label: string; description: string }>
  disabled?: boolean
  onChange: (value: string) => void
}> = (props) => {
  const activeDescription = createMemo(
    () => props.options.find((option) => option.value === props.value)?.description ?? "",
  )
  return (
    <>
      <div class="vl-segmented" role="radiogroup" aria-label={props.label}>
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              class="vl-segment"
              role="radio"
              aria-checked={props.value === option.value}
              data-selected={props.value === option.value}
              disabled={props.disabled}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
      <p class="vl-selection-help">{activeDescription()}</p>
    </>
  )
}

const SettingSwitch: Component<{
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  onLabel: string
  offLabel: string
}> = (props) => (
  <div class="vl-setting-row">
    <div class="vl-row-copy">
      <span class="vl-row-title">{props.label}</span>
      <span class="vl-row-description">{props.description}</span>
    </div>
    <div class="vl-switch-wrap">
      <span>{props.checked ? props.onLabel : props.offLabel}</span>
      <button
        type="button"
        class="vl-switch"
        role="switch"
        aria-label={props.label}
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
      >
        <span class="vl-switch-track" aria-hidden="true">
          <span class="vl-switch-knob" />
        </span>
      </button>
    </div>
  </div>
)

const MODEL_ROLES = [
  { value: "nano", en: "Nano · fastest", zh: "Nano · 最快" },
  { value: "mini", en: "Mini · balanced", zh: "Mini · 均衡" },
  { value: "mid", en: "Mid · more capable", zh: "Mid · 更强" },
  { value: "thinking", en: "Thinking · deeper reasoning", zh: "Thinking · 深度推理" },
  { value: "long", en: "Long · long context", zh: "Long · 长上下文" },
  { value: "creative", en: "Creative · expressive", zh: "Creative · 更具表达力" },
] as const

const ModelRoleRow: Component<{
  label: string
  description: string
  value: VibeLingoSettings["translationModelRole"]
  locale: UiLocale
  disabled?: boolean
  onChange(value: VibeLingoSettings["translationModelRole"]): void
}> = (props) => (
  <div class="vl-setting-row">
    <div class="vl-row-copy">
      <label class="vl-row-title">{props.label}</label>
      <span class="vl-row-description">{props.description}</span>
    </div>
    <select
      class="vl-model-select"
      value={props.value}
      disabled={props.disabled}
      aria-label={props.label}
      onChange={(event) =>
        props.onChange(event.currentTarget.value as VibeLingoSettings["translationModelRole"])}
    >
      <For each={MODEL_ROLES}>
        {(role) => <option value={role.value}>{props.locale === "zh-CN" ? role.zh : role.en}</option>}
      </For>
    </select>
  </div>
)

export const SettingsView: Component<SurfaceInput> = (input) => {
  const context = resolveContext(input)
  const [settings, setSettings] = createSignal<VibeLingoSettings>(DEFAULT_SETTINGS)
  const [draftNative, setDraftNative] = createSignal("")
  const [draftTarget, setDraftTarget] = createSignal("")
  const [draftLevel, setDraftLevel] = createSignal<VibeLingoSettings["proficiency"]>("intermediate")
  const [loading, setLoading] = createSignal(true)
  const [saveState, setSaveState] = createSignal<"idle" | "saving" | "saved" | "error">("idle")
  const [clearing, setClearing] = createSignal(false)
  const [error, setError] = createSignal("")
  const [summary, setSummary] = createSignal<LearningSummary>()

  const profile = createMemo(() => configuredProfile(settings()))
  const locale = createMemo(() => localeForSettings(settings()))
  const copy = createMemo(() => COPY[locale()])
  const controller = createSettingsController(context, {
    loadFailure: () => copy().loadFailed,
    saveFailure: () => copy().saveFailed,
    dataFailure: () => copy().dataFailed,
    deleted: (result) => copy().deleted(result),
  })
  const targetName = createMemo(() =>
    profile() ? languageDisplayName(profile()!.targetLanguage, locale()) : "",
  )

  const levelOptions = createMemo(() => [
    {
      value: "beginner",
      label: copy().beginner,
      description: copy().beginnerDescription,
    },
    {
      value: "intermediate",
      label: copy().intermediate,
      description: copy().intermediateDescription,
    },
    {
      value: "advanced",
      label: copy().advanced,
      description: copy().advancedDescription,
    },
  ])

  const correctionOptions = createMemo(() => [
    {
      value: "focused",
      label: copy().focused,
      description: copy().focusedDescription,
    },
    {
      value: "strict",
      label: copy().strict,
      description: copy().strictDescription,
    },
    {
      value: "off",
      label: copy().off,
      description: copy().offDescription,
    },
  ])

  function syncDrafts(next: VibeLingoSettings) {
    setDraftNative(next.nativeLanguage)
    setDraftTarget(next.targetLanguage)
    setDraftLevel(next.proficiency)
  }

  async function persist(next: VibeLingoSettings) {
    await controller.replace(next)
  }

  async function activate() {
    const nativeLanguage = canonicalLanguageTag(draftNative())
    const targetLanguage = canonicalLanguageTag(draftTarget())
    if (!nativeLanguage || !targetLanguage) {
      setError(copy().invalidLanguage)
      return
    }
    if (nativeLanguage === targetLanguage) {
      setError(copy().sameLanguage)
      return
    }
    const next = VibeLingoSettingsSchema.parse({
      ...settings(),
      nativeLanguage,
      targetLanguage,
      proficiency: draftLevel(),
    })
    syncDrafts(next)
    await persist(next)
  }

  function updateProfile(key: "nativeLanguage" | "targetLanguage", value: string) {
    const canonical = canonicalLanguageTag(value)
    if (!canonical) {
      setError(copy().invalidLanguage)
      return
    }
    const current = settings()
    const next = VibeLingoSettingsSchema.parse({ ...current, [key]: canonical })
    if (next.nativeLanguage === next.targetLanguage) {
      setError(copy().sameLanguage)
      return
    }
    setError("")
    syncDrafts(next)
    void persist(next)
  }

  async function clearData(scope: "target" | "all") {
    const activeProfile = profile()
    if (!activeProfile) return
    const language = targetName()
    await controller.clear(
      scope === "target"
        ? { scope, targetLanguage: activeProfile.targetLanguage }
        : { scope },
      scope === "target"
        ? {
            title: copy().clearTargetTitle(language),
            message: copy().clearTargetMessage(language),
            confirmLabel: copy().clearTargetConfirm,
          }
        : {
            title: copy().clearAllTitle,
            message: copy().clearAllMessage,
            confirmLabel: copy().clearAllConfirm,
          },
    )
  }

  onMount(() => {
    const stop = controller.subscribe((next) => {
      setSettings(next.settings)
      syncDrafts(next.settings)
      setLoading(next.loading)
      setSaveState(next.saveState)
      setClearing(next.clearing)
      setError(next.error ?? "")
      setSummary(next.summary)
    })
    void controller.start()
    onCleanup(() => {
      stop()
      controller.dispose()
    })
  })

  return (
    <main class="vl-settings" data-embedded={Boolean(input.embedded)} aria-busy={loading()}>
      <style>{styles}</style>
      <header class="vl-header">
        <div>
          <h1 class="vl-title">VibeLingo</h1>
          <p class="vl-subtitle">{copy().subtitle}</p>
        </div>
        <div>
          <div class="vl-header-state" data-active={Boolean(profile())}>
            <span class="vl-state-dot" aria-hidden="true" />
            <span>
              {profile()
                ? `${copy().active} · ${languageDisplayName(profile()!.nativeLanguage, locale())} → ${targetName()} · ${levelOptions().find((item) => item.value === profile()!.proficiency)?.label}`
                : copy().setupRequired}
            </span>
          </div>
          <div class="vl-save-state" aria-live="polite">
            {saveState() === "saving"
              ? copy().saving
              : saveState() === "saved"
                ? copy().saved
                : ""}
          </div>
        </div>
      </header>

      <Show
        when={!loading()}
        fallback={
          <div class="vl-skeleton" aria-label={copy().loading}>
            <div class="vl-skeleton-line" />
            <div class="vl-skeleton-line" />
            <div class="vl-skeleton-line" />
          </div>
        }
      >
        <section class="vl-section" aria-labelledby="vl-profile-title">
          <div class="vl-section-head">
            <h2 id="vl-profile-title" class="vl-section-title">{copy().profile}</h2>
            <p class="vl-section-copy">{copy().profileDescription}</p>
          </div>
          <div class="vl-language-grid">
            <div>
              <label class="vl-field-label" for="vl-native-language">{copy().nativeLanguage}</label>
              <p class="vl-field-help">{copy().nativeLanguageHelp}</p>
              <LanguageCombobox
                id="vl-native-language"
                label={copy().nativeLanguage}
                value={profile()?.nativeLanguage ?? draftNative()}
                locale={locale()}
                placeholder={copy().languagePlaceholder}
                customLabel={copy().customLanguage}
                disabled={saveState() === "saving"}
                onChange={(value) => {
                  if (profile()) updateProfile("nativeLanguage", value)
                  else setDraftNative(value)
                }}
                onInvalid={() => setError(copy().invalidLanguage)}
              />
            </div>
            <div class="vl-language-arrow" aria-hidden="true">→</div>
            <div>
              <label class="vl-field-label" for="vl-target-language">{copy().targetLanguage}</label>
              <p class="vl-field-help">{copy().targetLanguageHelp}</p>
              <LanguageCombobox
                id="vl-target-language"
                label={copy().targetLanguage}
                value={profile()?.targetLanguage ?? draftTarget()}
                locale={locale()}
                placeholder={copy().languagePlaceholder}
                customLabel={copy().customLanguage}
                disabled={saveState() === "saving"}
                onChange={(value) => {
                  if (profile()) updateProfile("targetLanguage", value)
                  else setDraftTarget(value)
                }}
                onInvalid={() => setError(copy().invalidLanguage)}
              />
            </div>
          </div>

          <div class="vl-control-block">
            <span class="vl-field-label">{copy().level}</span>
            <p class="vl-field-help">{copy().levelHelp}</p>
            <SegmentedControl
              label={copy().level}
              value={profile()?.proficiency ?? draftLevel()}
              options={levelOptions()}
              disabled={saveState() === "saving"}
              onChange={(value) => {
                const proficiency = value as VibeLingoSettings["proficiency"]
                if (!profile()) {
                  setDraftLevel(proficiency)
                  return
                }
                const current = settings()
                void persist({ ...current, proficiency })
              }}
            />
          </div>

          <Show when={error()}>
            <p class="vl-error" role="alert">{error()}</p>
          </Show>

          <Show when={!profile()}>
            <div class="vl-primary-row">
              <button
                type="button"
                class="vl-button"
                data-primary="true"
                disabled={saveState() === "saving"}
                onClick={() => void activate()}
              >
                {copy().start}
              </button>
            </div>
          </Show>
        </section>

        <Show when={profile()}>
          <section class="vl-section" aria-labelledby="vl-coaching-title">
            <div class="vl-section-head">
              <h2 id="vl-coaching-title" class="vl-section-title">{copy().coaching}</h2>
              <p class="vl-section-copy">{copy().coachingDescription}</p>
            </div>
            <SegmentedControl
              label={copy().coaching}
              value={settings().correctionMode}
              options={correctionOptions()}
              disabled={saveState() === "saving"}
              onChange={(value) => {
                const current = settings()
                void persist({
                  ...current,
                  correctionMode: value as VibeLingoSettings["correctionMode"],
                })
              }}
            />
            <SettingSwitch
              label={copy().naturalness}
              description={copy().naturalnessDescription}
              checked={settings().naturalnessSuggestionsEnabled}
              disabled={saveState() === "saving" || settings().correctionMode === "off"}
              onLabel={copy().on}
              offLabel={copy().offState}
              onChange={(naturalnessSuggestionsEnabled) => {
                const current = settings()
                void persist({ ...current, naturalnessSuggestionsEnabled })
              }}
            />
            <SettingSwitch
              label={copy().tracking}
              description={copy().trackingDescription}
              checked={settings().trackingEnabled}
              disabled={saveState() === "saving"}
              onLabel={copy().on}
              offLabel={copy().offState}
              onChange={(trackingEnabled) => {
                const current = settings()
                void persist({ ...current, trackingEnabled })
              }}
            />
            <SettingSwitch
              label={copy().recurring}
              description={copy().recurringDescription}
              checked={settings().recurringFocusEnabled}
              disabled={saveState() === "saving"}
              onLabel={copy().on}
              offLabel={copy().offState}
              onChange={(recurringFocusEnabled) => {
                const current = settings()
                void persist({ ...current, recurringFocusEnabled })
              }}
            />
          </section>

          <section class="vl-section" aria-labelledby="vl-models-title">
            <div class="vl-section-head">
              <h2 id="vl-models-title" class="vl-section-title">{copy().models}</h2>
              <p class="vl-section-copy">{copy().modelsDescription}</p>
            </div>
            <ModelRoleRow
              label={copy().detectionModel}
              description={copy().detectionModelDescription}
              value={settings().languageDetectionModelRole}
              locale={locale()}
              disabled={saveState() === "saving"}
              onChange={(languageDetectionModelRole) =>
                void persist({ ...settings(), languageDetectionModelRole })}
            />
            <ModelRoleRow
              label={copy().analysisModel}
              description={copy().analysisModelDescription}
              value={settings().learningAnalysisModelRole}
              locale={locale()}
              disabled={saveState() === "saving"}
              onChange={(learningAnalysisModelRole) =>
                void persist({ ...settings(), learningAnalysisModelRole })}
            />
            <ModelRoleRow
              label={copy().translationModel}
              description={copy().translationModelDescription}
              value={settings().translationModelRole}
              locale={locale()}
              disabled={saveState() === "saving"}
              onChange={(translationModelRole) =>
                void persist({ ...settings(), translationModelRole })}
            />
            <ModelRoleRow
              label={copy().reviewModel}
              description={copy().reviewModelDescription}
              value={settings().reviewModelRole}
              locale={locale()}
              disabled={saveState() === "saving"}
              onChange={(reviewModelRole) => void persist({ ...settings(), reviewModelRole })}
            />
          </section>

          <section class="vl-section" aria-labelledby="vl-data-title">
            <div class="vl-section-head">
              <h2 id="vl-data-title" class="vl-section-title">{copy().data}</h2>
              <p class="vl-section-copy">{copy().dataDescription}</p>
            </div>
            <SettingSwitch
              label={copy().translationHistory}
              description={copy().translationHistoryDescription}
              checked={settings().translationHistoryEnabled}
              disabled={saveState() === "saving"}
              onLabel={copy().on}
              offLabel={copy().offState}
              onChange={(translationHistoryEnabled) =>
                void persist({ ...settings(), translationHistoryEnabled })}
            />
            <Show
              when={summary() && (
                summary()!.analyzedMessages > 0 ||
                summary()!.totalPatternCount > 0
              )}
              fallback={<p class="vl-empty">{copy().noHistory}</p>}
            >
              <div class="vl-data-summary">
                <span><strong>{summary()!.analyzedMessages}</strong> {copy().messages}</span>
                <span class="vl-data-separator" aria-hidden="true">·</span>
                <span><strong>{summary()!.findingsLast30Days}</strong> {copy().findings}</span>
                <span class="vl-data-separator" aria-hidden="true">·</span>
                <span><strong>{summary()!.recurringPatternCount}</strong> {copy().recurringPatterns}</span>
              </div>
            </Show>
            <div class="vl-data-actions">
              <button
                type="button"
                class="vl-button"
                disabled={
                  clearing() ||
                  !summary() ||
                  (summary()!.analyzedMessages === 0 && summary()!.totalPatternCount === 0)
                }
                onClick={() => void clearData("target")}
              >
                {copy().clearTarget}
              </button>
              <button
                type="button"
                class="vl-button"
                data-danger="true"
                disabled={clearing()}
                onClick={() => void clearData("all")}
              >
                {copy().clearAll}
              </button>
            </div>
          </section>
        </Show>
      </Show>
    </main>
  )
}

export default SettingsView

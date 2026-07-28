import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js"
import type { PluginSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import type {
  LearningProfilesOutput,
  PatternPresentationsOutput,
} from "../application/dashboard-contracts"
import {
  DEFAULT_SETTINGS,
  VibeLingoSettingsSchema,
  configuredProfile,
  type LearningProfile,
  type VibeLingoSettings,
} from "../settings"
import { localeForSettings, type UiLocale } from "./i18n"
import {
  parseDashboardRoute,
  routeParams,
  type DashboardRoute,
} from "./router"

export type SurfaceInput = PluginSurfaceContext | { context: PluginSurfaceContext }

export function resolveSurfaceContext(input: SurfaceInput): PluginSurfaceContext {
  return "context" in input ? input.context : input
}

type HistoricalProfile = LearningProfilesOutput["profiles"][number]
type Presentation = PatternPresentationsOutput["items"][number]

export type DashboardModel = {
  context: PluginSurfaceContext
  settings: Accessor<VibeLingoSettings>
  profile: Accessor<LearningProfile | undefined>
  profiles: Accessor<HistoricalProfile[]>
  locale: Accessor<UiLocale>
  timeZone: string
  route: Accessor<DashboardRoute>
  loading: Accessor<boolean>
  loadError: Accessor<string | undefined>
  refreshVersion: Accessor<number>
  navigate(route: DashboardRoute): void
  refresh(): void
  reloadProfiles(): Promise<void>
  switchProfile(profile: HistoricalProfile): Promise<boolean>
  present(patternKeys: string[]): Promise<void>
  presentation(patternKey: string): Presentation | undefined
}

const DashboardContext = createContext<DashboardModel>()

export function useDashboard(): DashboardModel {
  const value = useContext(DashboardContext)
  if (!value) throw new Error("VibeLingo dashboard context is unavailable")
  return value
}

export const DashboardProvider: ParentComponent<{ context: PluginSurfaceContext }> = (props) => {
  const [settings, setSettings] = createSignal(DEFAULT_SETTINGS)
  const [profiles, setProfiles] = createSignal<HistoricalProfile[]>([])
  const [route, setRoute] = createSignal(parseDashboardRoute(
    typeof window === "undefined" ? "" : window.location.search,
  ))
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadError] = createSignal<string>()
  const [refreshVersion, setRefreshVersion] = createSignal(0)
  const [presentations, setPresentations] = createSignal<Record<string, Presentation>>({})
  const pendingPresentations = new Set<string>()
  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  const profile = createMemo(() => configuredProfile(settings()))
  const locale = createMemo(() => localeForSettings(settings()))
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    } catch {
      return "UTC"
    }
  })()

  function refresh() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => setRefreshVersion((value) => value + 1), 80)
  }

  async function reloadProfiles() {
    const result = await props.context.operations.query<LearningProfilesOutput>(
      "learning-profiles",
      {},
    )
    setProfiles(result.profiles)
  }

  function navigate(next: DashboardRoute) {
    setRoute(next)
    props.context.host.openPluginPage("learning", routeParams(next))
  }

  async function switchProfile(nextProfile: HistoricalProfile): Promise<boolean> {
    const previous = settings()
    const next = VibeLingoSettingsSchema.parse({
      ...previous,
      nativeLanguage: nextProfile.nativeLanguage,
      targetLanguage: nextProfile.targetLanguage,
      proficiency: nextProfile.proficiency,
    })
    setSettings(next)
    try {
      await props.context.settings.replace(next)
      setPresentations({})
      refresh()
      return true
    } catch {
      setSettings(previous)
      props.context.host.notify(
        locale() === "zh-CN" ? "学习档案未能切换。" : "The learning profile could not be changed.",
        { kind: "error" },
      )
      return false
    }
  }

  async function present(patternKeys: string[]): Promise<void> {
    const active = profile()
    if (!active) return
    const requested = [...new Set(patternKeys)]
      .filter((key) => !presentations()[key] && !pendingPresentations.has(key))
      .slice(0, 20)
    if (requested.length === 0) return
    requested.forEach((key) => pendingPresentations.add(key))
    try {
      const result = await props.context.operations.command<PatternPresentationsOutput>(
        "pattern-presentations",
        {
          targetLanguage: active.targetLanguage,
          patternKeys: requested,
        },
      )
      const current = profile()
      if (
        current?.targetLanguage !== active.targetLanguage
        || current.nativeLanguage !== active.nativeLanguage
      ) return
      setPresentations((previous) => ({
        ...previous,
        ...Object.fromEntries(result.items.map((item) => [item.patternKey, item])),
      }))
    } catch {
      // Canonical metadata remains visible; localization is deliberately fail-soft.
    } finally {
      requested.forEach((key) => pendingPresentations.delete(key))
    }
  }

  function presentation(patternKey: string) {
    return presentations()[patternKey]
  }

  onMount(() => {
    const onPopState = () => setRoute(parseDashboardRoute(window.location.search))
    window.addEventListener("popstate", onPopState)
    const stopSettings = props.context.settings.subscribe((values) => {
      const parsed = VibeLingoSettingsSchema.safeParse(values)
      if (!parsed.success) return
      const previous = profile()
      setSettings(parsed.data)
      const next = configuredProfile(parsed.data)
      if (
        previous?.targetLanguage !== next?.targetLanguage
        || previous?.nativeLanguage !== next?.nativeLanguage
      ) {
        setPresentations({})
        void reloadProfiles().catch(() => undefined)
      }
      refresh()
    })
    const onLearningEvent = (event: unknown) => {
      const targetLanguage = event && typeof event === "object" && "targetLanguage" in event
        ? String(event.targetLanguage)
        : undefined
      if (targetLanguage === "*" || !targetLanguage || targetLanguage === profile()?.targetLanguage) {
        refresh()
      }
    }
    const stopLearning = props.context.events.subscribe("learning.changed", onLearningEvent)
    const stopReview = props.context.events.subscribe("review.changed", onLearningEvent)

    void Promise.all([
      props.context.settings.get(),
      props.context.operations.query<LearningProfilesOutput>("learning-profiles", {}),
    ]).then(
      ([values, profileResult]) => {
        const parsed = VibeLingoSettingsSchema.safeParse(values)
        if (parsed.success) setSettings(parsed.data)
        setProfiles(profileResult.profiles)
        setLoadError(undefined)
      },
      (error) => setLoadError(error instanceof Error ? error.message : String(error)),
    ).finally(() => setLoading(false))

    onCleanup(() => {
      clearTimeout(refreshTimer)
      window.removeEventListener("popstate", onPopState)
      stopSettings()
      stopLearning()
      stopReview()
    })
  })

  const model: DashboardModel = {
    context: props.context,
    settings,
    profile,
    profiles,
    locale,
    timeZone,
    route,
    loading,
    loadError,
    refreshVersion,
    navigate,
    refresh,
    reloadProfiles,
    switchProfile,
    present,
    presentation,
  }

  createEffect(() => {
    profile()?.targetLanguage
    setPresentations({})
  })

  return (
    <DashboardContext.Provider value={model}>
      {props.children}
    </DashboardContext.Provider>
  )
}

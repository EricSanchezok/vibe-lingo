import {
  Match,
  Show,
  Switch,
  createSignal,
  type Component,
} from "solid-js"
import { configuredProfile } from "../settings"
import {
  DashboardProvider,
  resolveSurfaceContext,
  type SurfaceInput,
  useDashboard,
} from "./app-context"
import { ProfileMenu } from "./components"
import { copy, profileLabel } from "./i18n"
import { SettingsView } from "./settings"
import { dashboardStyles } from "./styles"
import { JourneyView, RecordView } from "./views/journey"
import { OverviewView } from "./views/overview"
import { PatternDetailView, PatternsView } from "./views/patterns"
import { ReviewView } from "./views/review"
import { TranslationsView } from "./views/translations"

const DashboardApp: Component = () => {
  const dashboard = useDashboard()
  const [profileMenuOpen, setProfileMenuOpen] = createSignal(false)
  let profileButton: HTMLButtonElement | undefined
  const profile = dashboard.profile
  const route = dashboard.route

  return (
    <div class="vld-app">
      <style>{dashboardStyles}</style>
      <div class="vld-shell">
        <header class="vld-topbar">
          <div>
            <h1 class="vld-brand">VibeLingo</h1>
            <Show when={profile()}>
              <nav class="vld-tabs" aria-label={dashboard.locale() === "zh-CN" ? "VibeLingo 页面" : "VibeLingo pages"}>
                <button
                  class="vld-tab"
                  data-active={route().view === "overview" || route().view === "journey" || route().view === "record"}
                  type="button"
                  onClick={() => dashboard.navigate({ view: "overview" })}
                >
                  {copy(dashboard.locale(), "overview")}
                </button>
                <button
                  class="vld-tab"
                  data-active={route().view === "review"}
                  type="button"
                  onClick={() => dashboard.navigate({ view: "review" })}
                >
                  {copy(dashboard.locale(), "review")}
                </button>
                <button
                  class="vld-tab"
                  data-active={route().view === "patterns" || route().view === "pattern"}
                  type="button"
                  onClick={() => dashboard.navigate({ view: "patterns" })}
                >
                  {copy(dashboard.locale(), "patterns")}
                </button>
                <button
                  class="vld-tab"
                  data-active={route().view === "translations"}
                  type="button"
                  onClick={() => dashboard.navigate({ view: "translations" })}
                >
                  {copy(dashboard.locale(), "translations")}
                </button>
              </nav>
            </Show>
          </div>
          <Show when={profile()}>
            {(active) => (
              <div class="vld-top-actions">
                <button
                  ref={profileButton}
                  class="vld-profile-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen()}
                  onClick={() => setProfileMenuOpen((open) => !open)}
                >
                  <span class="vld-profile-text">{profileLabel(dashboard.locale(), active())}</span>
                  <span class="vld-profile-chevron" aria-hidden="true">⌄</span>
                </button>
                <button
                  class="vld-secondary vld-header-settings"
                  type="button"
                  aria-label={copy(dashboard.locale(), "settings")}
                  title={copy(dashboard.locale(), "settings")}
                  onClick={() => dashboard.navigate({ view: "settings" })}
                >
                  {copy(dashboard.locale(), "settings")}
                </button>
              </div>
            )}
          </Show>
        </header>

        <main class="vld-main">
          <Show
            when={!dashboard.loading()}
            fallback={
              <div class="vld-panel vld-panel-pad vld-skeleton" aria-busy="true">
                <div class="vld-skeleton-line" />
                <div class="vld-skeleton-line" />
                <div class="vld-skeleton-line" />
              </div>
            }
          >
            <Show
              when={!dashboard.loadError()}
              fallback={
                <div class="vld-error" role="alert">
                  {copy(dashboard.locale(), "loadFailed")}
                </div>
              }
            >
              <Show
                when={configuredProfile(dashboard.settings())}
                fallback={
                  <div class="vld-settings-wrap">
                    <div class="vld-page-head">
                      <div>
                        <p class="vld-eyebrow">{copy(dashboard.locale(), "settings")}</p>
                        <h2 class="vld-page-title">{copy(dashboard.locale(), "setupTitle")}</h2>
                        <p class="vld-page-copy">{copy(dashboard.locale(), "setupHelp")}</p>
                      </div>
                    </div>
                    <SettingsView {...dashboard.context} embedded />
                  </div>
                }
              >
                <Switch>
                  <Match when={route().view === "overview"}><OverviewView /></Match>
                  <Match when={route().view === "review"}><ReviewView reviewId={route().reviewId} /></Match>
                  <Match when={route().view === "patterns"}><PatternsView /></Match>
                  <Match when={route().view === "translations"}><TranslationsView /></Match>
                  <Match when={route().view === "pattern" && route().patternKey}>
                    <PatternDetailView patternKey={route().patternKey!} />
                  </Match>
                  <Match when={route().view === "journey"}><JourneyView /></Match>
                  <Match when={route().view === "record" && route().eventId}>
                    <RecordView eventId={route().eventId!} />
                  </Match>
                  <Match when={route().view === "settings"}>
                    <div class="vld-settings-wrap">
                      <button class="vld-back" type="button" onClick={() => dashboard.navigate({ view: "overview" })}>
                        <span aria-hidden="true">←</span> {copy(dashboard.locale(), "overview")}
                      </button>
                      <p class="vld-settings-note">{copy(dashboard.locale(), "manualReviewNote")}</p>
                      <SettingsView {...dashboard.context} embedded />
                    </div>
                  </Match>
                </Switch>
              </Show>
            </Show>
          </Show>
        </main>
      </div>
      <Show when={profileMenuOpen()}>
        <ProfileMenu anchor={profileButton} onClose={() => setProfileMenuOpen(false)} />
      </Show>
    </div>
  )
}

const App: Component<SurfaceInput> = (input) => {
  const context = resolveSurfaceContext(input)
  return (
    <DashboardProvider context={context}>
      <DashboardApp />
    </DashboardProvider>
  )
}

export default App

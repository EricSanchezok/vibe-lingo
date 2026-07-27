import type { PluginSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import {
  DEFAULT_SETTINGS,
  VibeLingoSettingsSchema,
  configuredProfile,
  type VibeLingoSettings,
} from "../settings"
import type { ClearLearningDataResult, LearningSummary } from "../types"

export type SettingsControllerState = {
  settings: VibeLingoSettings
  summary?: LearningSummary
  loading: boolean
  clearing: boolean
  saveState: "idle" | "saving" | "saved" | "error"
  error?: string
}

export type SettingsControllerCopy = {
  loadFailure(): string
  saveFailure(): string
  dataFailure(): string
  deleted(result: ClearLearningDataResult): string
}

export function createSettingsController(
  context: PluginSurfaceContext,
  copy: SettingsControllerCopy,
) {
  let state: SettingsControllerState = {
    settings: DEFAULT_SETTINGS,
    loading: true,
    clearing: false,
    saveState: "idle",
  }
  let stopSettings: (() => void) | undefined
  let disposed = false
  let savedTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<(next: SettingsControllerState) => void>()

  function update(patch: Partial<SettingsControllerState>) {
    if (disposed) return
    state = { ...state, ...patch }
    for (const listener of listeners) listener(state)
  }

  async function loadSummary(targetLanguage: string) {
    const summary = await context.operations.query<LearningSummary>("learning-summary", {
      targetLanguage,
    })
    update({ summary })
  }

  async function applyExternal(values: Record<string, unknown>) {
    const parsed = VibeLingoSettingsSchema.safeParse(values)
    if (!parsed.success) return
    const isOwnSave =
      state.saveState === "saving" &&
      Object.entries(parsed.data).every(
        ([key, value]) => state.settings[key as keyof VibeLingoSettings] === value,
      )
    update({ settings: parsed.data, error: undefined })
    if (isOwnSave) return
    const profile = configuredProfile(parsed.data)
    if (profile) await loadSummary(profile.targetLanguage)
    else update({ summary: undefined })
  }

  return {
    state: () => state,

    subscribe(listener: (next: SettingsControllerState) => void) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },

    async start() {
      stopSettings ??= context.settings.subscribe((values) => {
        void applyExternal(values).catch(() => undefined)
      })
      try {
        await applyExternal(await context.settings.get())
      } catch {
        update({ error: copy.loadFailure() })
      } finally {
        update({ loading: false })
      }
    },

    async replace(next: VibeLingoSettings): Promise<boolean> {
      if (state.saveState === "saving") return false
      clearTimeout(savedTimer)
      const previous = state.settings
      update({ settings: next, saveState: "saving", error: undefined })
      try {
        await context.settings.replace(next)
        const profile = configuredProfile(next)
        if (profile) await loadSummary(profile.targetLanguage)
        else update({ summary: undefined })
        update({ saveState: "saved" })
        savedTimer = setTimeout(() => update({ saveState: "idle" }), 1_800)
        return true
      } catch {
        update({
          settings: previous,
          saveState: "error",
          error: copy.saveFailure(),
        })
        context.host.notify(copy.saveFailure(), { kind: "error" })
        return false
      }
    },

    async clear(
      input: { scope: "target"; targetLanguage: string } | { scope: "all" },
      confirmation: { title: string; message: string; confirmLabel: string },
    ): Promise<boolean> {
      if (!(await context.host.confirm(confirmation))) return false
      update({ clearing: true, error: undefined })
      try {
        const result = await context.operations.command<ClearLearningDataResult>(
          "clear-learning-data",
          input,
        )
        const profile = configuredProfile(state.settings)
        if (profile) await loadSummary(profile.targetLanguage)
        context.host.notify(copy.deleted(result), { kind: "success" })
        return true
      } catch {
        update({ error: copy.dataFailure() })
        context.host.notify(copy.dataFailure(), { kind: "error" })
        return false
      } finally {
        update({ clearing: false })
      }
    },

    dispose() {
      disposed = true
      clearTimeout(savedTimer)
      stopSettings?.()
      stopSettings = undefined
      listeners.clear()
    },
  }
}

export type SettingsController = ReturnType<typeof createSettingsController>

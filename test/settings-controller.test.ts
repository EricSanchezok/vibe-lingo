import { describe, expect, test } from "bun:test"
import type { PluginSurfaceContext } from "@ericsanchezok/synergy-plugin/ui"
import { createSettingsController } from "../src/ui/settings-controller"
import { DEFAULT_SETTINGS, type VibeLingoSettings } from "../src/settings"

const english: VibeLingoSettings = {
  ...DEFAULT_SETTINGS,
  nativeLanguage: "zh-Hans",
  targetLanguage: "en",
}

function surface(
  options: {
    failSave?: boolean
    failSummary?: boolean
    confirm?: boolean
  } = {},
) {
  let values: Record<string, unknown> = english
  let subscriber: ((next: Record<string, unknown>) => void) | undefined
  const calls = {
    summaries: [] as Array<{
      targetLanguage: string
      scope: "all" | "current"
    }>,
    commands: [] as unknown[],
    notifications: [] as string[],
  }
  const context = {
    pluginId: "vibe-lingo",
    scopeId: "scope-test",
    surface: { kind: "ui.settings", id: "settings" },
    operations: {
      async query(_id: string, input: unknown) {
        if (options.failSummary) throw new Error("summary failed")
        const summaryInput = input as {
          targetLanguage: string
          scope: "all" | "current"
        }
        calls.summaries.push(summaryInput)
        const { targetLanguage } = summaryInput
        return {
          analyzedMessages: targetLanguage === "en" ? 4 : 2,
          findingsLast30Days: 1,
          totalPatternCount: 1,
          recurringPatternCount: 0,
        }
      },
      async command(_id: string, input: unknown) {
        calls.commands.push(input)
        return {
          ok: true,
          revision: 0,
          data: {
            deletedMessages: 2,
            deletedOccurrences: 1,
            deletedPatterns: 1,
            deletedReviews: 0,
            deletedEvents: 0,
          },
        }
      },
    },
    events: { subscribe: () => () => undefined },
    settings: {
      async get() {
        return values
      },
      async replace(next: Record<string, unknown>) {
        if (options.failSave) throw new Error("save failed")
        values = next
        subscriber?.(next)
      },
      subscribe(listener: (next: Record<string, unknown>) => void) {
        subscriber = listener
        return () => {
          subscriber = undefined
        }
      },
    },
    host: {
      openSession() {},
      openPluginPage() {},
      openWorkbenchPanel() {},
      openResource() {},
      notify(message: string) {
        calls.notifications.push(message)
      },
      async confirm() {
        return options.confirm ?? true
      },
    },
  } as PluginSurfaceContext
  return {
    context,
    calls,
    publish(next: VibeLingoSettings) {
      values = next
      subscriber?.(next)
    },
  }
}

const copy = {
  loadFailure: () => "load failed",
  saveFailure: () => "save failed",
  dataFailure: () => "data failed",
  deleted: () => "deleted",
}

describe("trusted settings controller", () => {
  test("loads, follows external settings, and switches summary namespace", async () => {
    const host = surface()
    const controller = createSettingsController(host.context, copy)
    expect(controller.state().loading).toBe(true)
    await controller.start()
    expect(controller.state()).toMatchObject({
      loading: false,
      settings: { targetLanguage: "en" },
      summary: { analyzedMessages: 4 },
    })
    expect(
      await controller.replace({
        ...english,
        nativeLanguage: "en",
        targetLanguage: "es",
      }),
    ).toBe(true)
    expect(controller.state()).toMatchObject({
      saveState: "saved",
      settings: { targetLanguage: "es" },
      summary: { analyzedMessages: 2 },
    })
    host.publish({
      ...english,
      nativeLanguage: "en",
      targetLanguage: "es",
      proficiency: "advanced",
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(controller.state()).toMatchObject({
      settings: { targetLanguage: "es", proficiency: "advanced" },
      summary: { analyzedMessages: 2 },
    })
    expect(host.calls.summaries).toEqual([
      { targetLanguage: "en", scope: "all" },
      { targetLanguage: "es", scope: "all" },
      { targetLanguage: "es", scope: "all" },
    ])
    controller.dispose()
  })

  test("keeps loaded settings when the learning summary fails", async () => {
    const host = surface({ failSummary: true })
    const controller = createSettingsController(host.context, copy)

    await controller.start()

    expect(controller.state()).toMatchObject({
      loading: false,
      settings: { targetLanguage: "en" },
      error: "data failed",
    })
    expect(controller.state().summary).toBeUndefined()
    controller.dispose()
  })

  test("optimistically saves and rolls back on failure", async () => {
    const host = surface({ failSave: true })
    const controller = createSettingsController(host.context, copy)
    await controller.start()
    const changed = await controller.replace({
      ...english,
      correctionMode: "strict",
    })
    expect(changed).toBe(false)
    expect(controller.state()).toMatchObject({
      saveState: "error",
      settings: { correctionMode: "focused" },
      error: "save failed",
    })
    expect(host.calls.notifications).toEqual(["save failed"])
    controller.dispose()
  })

  test("honors host confirmation and refreshes after destructive cleanup", async () => {
    const host = surface({ confirm: true })
    const controller = createSettingsController(host.context, copy)
    await controller.start()
    expect(
      await controller.clear(
        { scope: "target", targetLanguage: "en" },
        { title: "Delete?", message: "Permanent", confirmLabel: "Delete" },
      ),
    ).toBe(true)
    expect(host.calls.commands).toEqual([
      { scope: "target", targetLanguage: "en" },
    ])
    expect(host.calls.notifications).toContain("deleted")
    expect(controller.state().clearing).toBe(false)
    controller.dispose()

    const cancelledHost = surface({ confirm: false })
    const cancelled = createSettingsController(cancelledHost.context, copy)
    await cancelled.start()
    expect(
      await cancelled.clear(
        { scope: "all" },
        { title: "Delete?", message: "Permanent", confirmLabel: "Delete" },
      ),
    ).toBe(false)
    expect(cancelledHost.calls.commands).toEqual([])
    cancelled.dispose()
  })
})

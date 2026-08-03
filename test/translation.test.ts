import { afterEach, describe, expect, mock, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { createServices } from "../src/application/services"
import { TranslationService } from "../src/application/translation-service"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { TranslationRepository } from "../src/infrastructure/translation-repository"
import { renderTranslationHistory } from "../src/translation-history"
import { invocationContext } from "./helpers"

const directories: string[] = []
const profile = {
  nativeLanguage: "zh-Hans",
  targetLanguage: "en",
  proficiency: "intermediate" as const,
}

function setup() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "vibe-lingo-translation-"),
  )
  directories.push(directory)
  const database = new VibeLingoDatabase(
    path.join(directory, "vibe-lingo.sqlite"),
  )
  const repository = new TranslationRepository(database)
  return { database, repository }
}

function selection(text: string, overrides: Record<string, unknown> = {}) {
  return {
    selectionId: crypto.randomUUID(),
    text,
    source: "document" as const,
    origin: "assistant_message" as const,
    editable: false,
    wholeContainer: false,
    ...overrides,
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe("translation service", () => {
  test("uses the full plugin Agent runtime budget", async () => {
    const { repository } = setup()
    let timeoutMs: number | undefined
    const service = new TranslationService(repository)
    const result = await service.translate(
      {
        profile,
        selection: selection("hello"),
        destination: "adaptive",
        historyEnabled: false,
        modelRole: "mini",
      },
      invocationContext({
        agent: {
          async call(input) {
            timeoutMs = input.timeoutMs
            return { text: JSON.stringify({ translation: "你好", sourceLanguage: "en" }) }
          },
        },
      }),
    )

    expect(result.status).toBe("translated")
    expect(timeoutMs).toBe(120_000)
  })

  test("accepts the minimal translator contract and infers a missing source tag for distinct scripts", async () => {
    const { repository } = setup()
    const callTranslator = mock(async () =>
      JSON.stringify({
        translation: "你好",
      }),
    )
    const service = new TranslationService(repository, { callTranslator })
    const result = await service.translate(
      {
        profile,
        selection: selection("hello"),
        destination: "adaptive",
        historyEnabled: false,
        modelRole: "mini",
      },
      invocationContext(),
    )

    expect(result).toMatchObject({
      status: "translated",
      sourceLanguage: "en",
      destinationLanguage: "zh-Hans",
      translatedText: "你好",
    })
    expect(callTranslator).toHaveBeenCalledTimes(1)
  })

  test("repairs one malformed translator response with the same configured role", async () => {
    const { repository } = setup()
    const callTranslator = mock()
      .mockResolvedValueOnce('{"translation":"你好"}')
      .mockResolvedValueOnce(
        JSON.stringify({
          translation: "こんにちは",
          sourceLanguage: "en",
        }),
      )
    const service = new TranslationService(repository, { callTranslator })
    const result = await service.translate(
      {
        profile: {
          nativeLanguage: "zh-Hans",
          targetLanguage: "ja",
          proficiency: "intermediate",
        },
        selection: selection("hello"),
        destination: "target",
        historyEnabled: false,
        modelRole: "thinking",
      },
      invocationContext(),
    )

    expect(result.status).toBe("translated")
    expect(callTranslator).toHaveBeenCalledTimes(2)
    expect(callTranslator.mock.calls[1]?.[1]).toBe("thinking")
    expect(callTranslator.mock.calls[1]?.[0]).toContain(
      "repair_translation_output",
    )
  })

  test("hides schema details after a failed bounded repair", async () => {
    const { repository } = setup()
    const callTranslator = mock(async () => '{"unexpected":true}')
    const service = new TranslationService(repository, { callTranslator })

    await expect(
      service.translate(
        {
          profile,
          selection: selection("hello"),
          destination: "adaptive",
          historyEnabled: false,
          modelRole: "mini",
        },
        invocationContext(),
      ),
    ).rejects.toThrow(
      "VibeLingo could not complete the translation. Please retry.",
    )
    expect(callTranslator).toHaveBeenCalledTimes(2)
  })

  test("handles the minimal not-translatable response without retrying", async () => {
    const { repository } = setup()
    const callTranslator = mock(async () =>
      JSON.stringify({ translation: null, sourceLanguage: null }),
    )
    const service = new TranslationService(repository, { callTranslator })
    const result = await service.translate(
      {
        profile,
        selection: selection("1234"),
        destination: "adaptive",
        historyEnabled: false,
        modelRole: "mini",
      },
      invocationContext(),
    )

    expect(result).toEqual({
      status: "not_translatable",
      reason: "The selection contains no translatable natural language.",
    })
    expect(callTranslator).toHaveBeenCalledTimes(1)
  })

  test("normalizes cache identity and persists the full normalized source text", async () => {
    const { database, repository } = setup()
    let calls = 0
    const service = new TranslationService(repository, {
      callTranslator: async () => {
        calls += 1
        return JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: "你好",
          sensitive: false,
        })
      },
    })
    const context = invocationContext()
    const first = await service.translate(
      {
        profile,
        selection: selection("  hello\r\nworld  "),
        destination: "adaptive",
        historyEnabled: true,
        modelRole: "mini",
      },
      context,
    )
    const second = await service.translate(
      {
        profile,
        selection: selection("hello\nworld"),
        destination: "adaptive",
        historyEnabled: true,
        modelRole: "thinking",
      },
      context,
    )

    expect(first).toMatchObject({
      status: "translated",
      cache: "miss",
      persistence: "saved",
    })
    expect(second).toMatchObject({
      status: "translated",
      cache: "persistent_hit",
    })
    expect(calls).toBe(1)
    const stored = database
      .connection()
      .query<{ source_text: string; translated_text: string }, []>(
        "SELECT source_text, translated_text FROM translations",
      )
      .all()
    expect(stored).toEqual([{
      source_text: "hello\nworld",
      translated_text: "你好",
    }])
  })

  test("uses one model call for concurrent identical misses", async () => {
    const { repository } = setup()
    let resolve!: (value: string) => void
    const response = new Promise<string>((done) => {
      resolve = done
    })
    const callTranslator = mock(async () => response)
    const service = new TranslationService(repository, { callTranslator })
    const input = {
      profile,
      selection: selection("same selection"),
      destination: "adaptive" as const,
      historyEnabled: true,
      modelRole: "mini" as const,
    }
    const first = service.translate(input, invocationContext())
    const second = service.translate(
      { ...input, selection: selection("same selection") },
      invocationContext(),
    )
    await Promise.resolve()
    expect(callTranslator).toHaveBeenCalledTimes(1)
    resolve(
      JSON.stringify({
        status: "translated",
        detectedSourceLanguage: "en",
        destinationLanguage: "zh-Hans",
        translatedText: "相同选区",
        sensitive: false,
      }),
    )
    expect((await first).status).toBe("translated")
    expect((await second).status).toBe("translated")
  })

  test("persists selected credentials and reuses them from the durable cache", async () => {
    const { database, repository } = setup()
    const callTranslator = mock(async () =>
      JSON.stringify({
        status: "translated",
        detectedSourceLanguage: "en",
        destinationLanguage: "zh-Hans",
        translatedText: "敏感值",
        sensitive: true,
      }),
    )
    const service = new TranslationService(repository, { callTranslator })
    const input = {
      profile,
      selection: selection("api_key=abcdefghijklmnopqrstuvwxyz123456"),
      destination: "adaptive" as const,
      historyEnabled: true,
      modelRole: "mini" as const,
    }
    const first = await service.translate(input, invocationContext())
    const second = await service.translate(input, invocationContext())
    expect(first).toMatchObject({
      cache: "miss",
      persistence: "saved",
    })
    expect(second).toMatchObject({
      cache: "persistent_hit",
      persistence: "saved",
    })
    expect(callTranslator).toHaveBeenCalledTimes(1)
    expect(
      database
        .connection()
        .query<{ source_text: string }, []>(
          "SELECT source_text FROM translations",
        )
        .get(),
    ).toEqual({ source_text: "api_key=abcdefghijklmnopqrstuvwxyz123456" })
  })

  test("persists the complete source for a whole chat-message selection", async () => {
    const { database, repository } = setup()
    const service = new TranslationService(repository, {
      callTranslator: async () =>
        JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: "整条消息",
          sensitive: false,
        }),
    })
    await service.translate(
      {
        profile,
        selection: selection("the entire assistant message", {
          wholeContainer: true,
        }),
        destination: "adaptive",
        historyEnabled: true,
        modelRole: "mini",
      },
      invocationContext(),
    )
    expect(
      database
        .connection()
        .query<{ source_text: string }, []>(
          "SELECT source_text FROM translations",
        )
        .get(),
    ).toEqual({ source_text: "the entire assistant message" })
  })

  test("reuses existing persistent cache while history is disabled without recording a use", async () => {
    const { repository } = setup()
    const callTranslator = mock(async () =>
      JSON.stringify({
        status: "translated",
        detectedSourceLanguage: "en",
        destinationLanguage: "zh-Hans",
        translatedText: "保留缓存",
        sensitive: false,
      }),
    )
    const service = new TranslationService(repository, { callTranslator })
    const input = {
      profile,
      selection: selection("keep cache"),
      destination: "adaptive" as const,
      modelRole: "mini" as const,
    }
    await service.translate(
      { ...input, historyEnabled: true },
      invocationContext(),
    )
    const before = repository.summary("en")
    const hit = await service.translate(
      { ...input, historyEnabled: false },
      invocationContext(),
    )
    expect(hit).toMatchObject({
      cache: "persistent_hit",
      persistence: "saved",
    })
    expect(repository.summary("en")).toEqual(before)
    expect(callTranslator).toHaveBeenCalledTimes(1)
  })

  test("keeps a usable result when cache reads or occurrence writes fail", async () => {
    const { repository } = setup()
    let calls = 0
    const service = new TranslationService(repository, {
      callTranslator: async () =>
        JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: `仍可使用-${++calls}`,
          sensitive: false,
        }),
    })
    const input = {
      profile,
      selection: selection("cache failure"),
      destination: "adaptive" as const,
      historyEnabled: true,
      modelRole: "mini" as const,
    }
    await service.translate(input, invocationContext())
    service.clearMemory()
    const originalRecordHit = repository.recordHit.bind(repository)
    repository.recordHit = () => {
      throw new Error("busy")
    }
    expect(await service.translate(input, invocationContext())).toMatchObject({
      status: "translated",
      cache: "persistent_hit",
      persistence: "write_failed",
      translatedText: "仍可使用-1",
    })
    repository.recordHit = originalRecordHit
    const originalFind = repository.find.bind(repository)
    repository.find = () => {
      throw new Error("busy")
    }
    expect(
      await service.translate(
        {
          ...input,
          selection: selection("different cache failure"),
        },
        invocationContext(),
      ),
    ).toMatchObject({
      status: "translated",
      cache: "miss",
      translatedText: "仍可使用-2",
    })
    repository.find = originalFind
  })

  test("repairs invalid persistent artifacts with one fresh translation", async () => {
    const { database, repository } = setup()
    let version = 0
    const service = new TranslationService(repository, {
      callTranslator: async () =>
        JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: `修复-${++version}`,
          sensitive: false,
        }),
    })
    const input = {
      profile,
      selection: selection("repair cache"),
      destination: "adaptive" as const,
      historyEnabled: true,
      modelRole: "mini" as const,
    }
    await service.translate(input, invocationContext())
    database
      .connection()
      .query("UPDATE translations SET translated_text = ''")
      .run()
    service.clearMemory()
    const repaired = await service.translate(input, invocationContext())
    expect(repaired).toMatchObject({ cache: "miss", translatedText: "修复-2" })
    expect(
      repository.list({ profileTargetLanguage: "en", limit: 20 }).items,
    ).toHaveLength(1)
  })

  test("keeps cache identity isolated by destination and language profile", async () => {
    const { repository } = setup()
    const callTranslator = mock(async (prompt: string) => {
      const value = JSON.parse(prompt)
      const destinationLanguage =
        value.destinationPolicy === "native" ? "zh-Hans" : "en"
      return JSON.stringify({
        status: "translated",
        detectedSourceLanguage:
          value.destinationPolicy === "native" ? "en" : "zh-Hans",
        destinationLanguage,
        translatedText: destinationLanguage === "en" ? "hello" : "你好",
        sensitive: false,
      })
    })
    const service = new TranslationService(repository, { callTranslator })
    const base = {
      profile,
      selection: selection("hello"),
      historyEnabled: true,
      modelRole: "mini" as const,
    }
    await service.translate(
      { ...base, destination: "native" },
      invocationContext(),
    )
    await service.translate(
      { ...base, destination: "target" },
      invocationContext(),
    )
    expect(callTranslator).toHaveBeenCalledTimes(2)
    expect(
      repository.list({ profileTargetLanguage: "en", limit: 20 }).items,
    ).toHaveLength(2)
  })

  test("supports escaped search, opaque paging, deletion, and transactional clears", async () => {
    const { repository } = setup()
    const service = new TranslationService(repository, {
      now: (() => {
        let now = 100
        return () => ++now
      })(),
      callTranslator: async (prompt) => {
        const source = JSON.parse(prompt).selection as string
        return JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: `译文 ${source}`,
          sensitive: false,
        })
      },
    })
    for (const source of ["100% ready", "under_score", "third"]) {
      await service.translate(
        {
          profile,
          selection: selection(source),
          destination: "adaptive",
          historyEnabled: true,
          modelRole: "mini",
        },
        invocationContext(),
      )
    }
    expect(repository.list({ query: "100%", limit: 20 }).items).toHaveLength(1)
    expect(repository.list({ query: "under_", limit: 20 }).items).toHaveLength(
      1,
    )
    const first = repository.list({ limit: 2 })
    const second = repository.list({ cursor: first.nextCursor, limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(second.items).toHaveLength(1)
    expect(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
    ).toBe(3)
    expect(repository.delete(second.items[0]!.id)).toBe(true)
    expect(repository.clear({ scope: "target", targetLanguage: "en" })).toEqual(
      {
        deletedTranslations: 2,
      },
    )
    expect(repository.clear({ scope: "all" })).toEqual({
      deletedTranslations: 0,
    })
  })

  test("does not invalidate cache for a role change and bypass explicitly refreshes it", async () => {
    const { repository } = setup()
    let version = 0
    const callTranslator = mock(async (_input: unknown, modelRole: string) =>
      JSON.stringify({
        status: "translated",
        detectedSourceLanguage: "en",
        destinationLanguage: "zh-Hans",
        translatedText: `${modelRole}-${++version}`,
        sensitive: false,
      }),
    )
    const service = new TranslationService(repository, { callTranslator })
    const base = {
      profile,
      selection: selection("refresh me"),
      destination: "adaptive" as const,
      historyEnabled: true,
    }
    await service.translate({ ...base, modelRole: "mini" }, invocationContext())
    const hit = await service.translate(
      { ...base, modelRole: "thinking" },
      invocationContext(),
    )
    const refreshed = await service.translate(
      {
        ...base,
        modelRole: "thinking",
        bypassCache: true,
      },
      invocationContext(),
    )
    expect(hit.status === "translated" && hit.translatedText).toBe("mini-1")
    expect(refreshed.status === "translated" && refreshed.translatedText).toBe(
      "thinking-2",
    )
    expect(callTranslator).toHaveBeenCalledTimes(2)
  })

  test("keeps translation data separate from learning evidence", async () => {
    const { database, repository } = setup()
    const services = createServices(database)
    const service = new TranslationService(repository, {
      callTranslator: async () =>
        JSON.stringify({
          status: "translated",
          detectedSourceLanguage: "en",
          destinationLanguage: "zh-Hans",
          translatedText: "只是翻译",
          sensitive: false,
        }),
    })
    await service.translate(
      {
        profile,
        selection: selection("translation only"),
        destination: "adaptive",
        historyEnabled: true,
        modelRole: "mini",
      },
      invocationContext(),
    )
    expect(services.learning.profileList()).toEqual([])
    expect(
      database
        .connection()
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM learning_patterns",
        )
        .get()?.count,
    ).toBe(0)
    expect(
      repository.list({ profileTargetLanguage: "en", limit: 20 }).items,
    ).toHaveLength(1)
    expect(
      services.learning.clearLearningData({
        scope: "target",
        targetLanguage: "en",
      }).deletedTranslations,
    ).toBe(1)
    expect(
      repository.list({ profileTargetLanguage: "en", limit: 20 }).items,
    ).toHaveLength(0)
  })

  test("renders stored history without letting translation Markdown escape its content block", () => {
    const output = renderTranslationHistory("en", [
      {
        id: crypto.randomUUID(),
        profileTargetLanguage: "en",
        nativeLanguage: "zh-Hans",
        destinationPolicy: "adaptive",
        detectedSourceLanguage: "en",
        destinationLanguage: "zh-Hans",
        sourceHash: "hash",
        sourceText: "`source`\nheading",
        sourceCharCount: 16,
        translatedText: "# injected\n```danger```",
        contractVersion: 1,
        createdAt: 1,
        updatedAt: 1,
        lastUsedAt: 1,
        useCount: 1,
      },
    ])
    expect(output).toContain("Source: ˋsourceˋ heading")
    expect(output).toContain("    # injected\n    ```danger```")
    expect(output).not.toContain("\n# injected")
  })
})

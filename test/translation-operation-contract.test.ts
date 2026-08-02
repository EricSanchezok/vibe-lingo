import { describe, expect, test } from "bun:test"
import { schemaToJsonSchema } from "@ericsanchezok/synergy-plugin"
import plugin from "../src"
import { toTranslationListItem } from "../src/translation-operations"

describe("translation operation contract", () => {
  test("accepts the selection-only payload supplied by text actions", () => {
    const operation = plugin.contributions.find(
      (candidate) => candidate.kind === "operation" && candidate.id === "translate-selection",
    )
    if (!operation || operation.kind !== "operation") {
      throw new Error("translate-selection operation is missing")
    }

    expect(schemaToJsonSchema(operation.input)).toMatchObject({
      required: ["selection"],
      properties: {
        destination: { default: "adaptive" },
        bypassCache: { default: false },
      },
    })
  })

  test("projects repository rows to the strict public history item", () => {
    const item = toTranslationListItem({
      id: "77777777-7777-4777-8777-777777777777",
      profileTargetLanguage: "en",
      nativeLanguage: "zh-Hans",
      destinationPolicy: "adaptive",
      detectedSourceLanguage: "en",
      destinationLanguage: "zh-Hans",
      sourceHash: "internal-cache-identity",
      sourceText: "hello",
      sourceCharCount: 5,
      translatedText: "你好",
      contractVersion: 1,
      createdAt: 1,
      updatedAt: 1,
      lastUsedAt: 1,
      useCount: 1,
    })

    expect(item).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      profileTargetLanguage: "en",
      nativeLanguage: "zh-Hans",
      destinationPolicy: "adaptive",
      detectedSourceLanguage: "en",
      destinationLanguage: "zh-Hans",
      sourceText: "hello",
      sourceCharCount: 5,
      translatedText: "你好",
      createdAt: 1,
      updatedAt: 1,
      lastUsedAt: 1,
      useCount: 1,
    })
    expect(item).not.toHaveProperty("sourceHash")
    expect(item).not.toHaveProperty("contractVersion")
  })
})

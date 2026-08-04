import { describe, expect, test } from "bun:test"
import {
  REVIEW_BUILDER_PROMPT,
  REVIEW_EVALUATOR_PROMPT,
} from "../src/application/review-contracts"
import { PATTERN_PRESENTER_PROMPT } from "../src/application/presentation-contracts"
import { modelLanguageDescriptor } from "../src/application/model-language"

describe("model language contract", () => {
  test("describes arbitrary BCP-47 language, script, and region variants", () => {
    expect(modelLanguageDescriptor("ja")).toEqual({ tag: "ja", name: "Japanese" })
    expect(modelLanguageDescriptor("pt-br")).toEqual({
      tag: "pt-BR",
      name: "Brazilian Portuguese",
    })
    expect(modelLanguageDescriptor("sr-cyrl")).toEqual({
      tag: "sr-Cyrl",
      name: "Serbian (Cyrillic)",
    })
    expect(modelLanguageDescriptor("sr-latn")).toEqual({
      tag: "sr-Latn",
      name: "Serbian (Latin)",
    })
  })

  test("uses one generic prompt rule without language-specific branches", () => {
    for (const prompt of [
      REVIEW_BUILDER_PROMPT,
      REVIEW_EVALUATOR_PROMPT,
      PATTERN_PRESENTER_PROMPT,
    ]) {
      expect(prompt).toContain("full BCP-47")
      expect(prompt).toContain("script and regional variant")
      expect(prompt).not.toMatch(/zh-Hans|zh-Hant|pt-BR|sr-Cyrl|sr-Latn/)
    }
  })
})

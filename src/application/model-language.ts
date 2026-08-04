import { canonicalLanguageTag, languageDisplayName } from "../language"

export type ModelLanguageDescriptor = {
  tag: string
  name: string
}

export function modelLanguageDescriptor(value: string): ModelLanguageDescriptor {
  const tag = canonicalLanguageTag(value) ?? value.trim()
  return {
    tag,
    name: languageDisplayName(tag, "en"),
  }
}

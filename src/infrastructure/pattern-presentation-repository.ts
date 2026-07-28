import { VibeLingoDatabase } from "./database"

export type PatternPresentationSource = {
  patternKey: string
  label: string
  rule: string
}

export type StoredPatternPresentation = PatternPresentationSource & {
  nativeLanguage: string
  generatedAt: number
}

export class PatternPresentationRepository {
  constructor(readonly database: VibeLingoDatabase) {}

  find(
    targetLanguage: string,
    nativeLanguage: string,
    sources: PatternPresentationSource[],
  ): Map<string, StoredPatternPresentation> {
    if (sources.length === 0) return new Map()
    const sourceByKey = new Map(sources.map((source) => [source.patternKey, source]))
    const placeholders = sources.map(() => "?").join(",")
    const rows = this.database.connection().query<{
      pattern_key: string
      source_label: string
      source_rule: string
      display_label: string
      display_rule: string
      generated_at: number
    }, Array<string>>(
      `SELECT pattern_key, source_label, source_rule, display_label, display_rule, generated_at
       FROM pattern_presentations
       WHERE target_language = ? AND native_language = ? AND pattern_key IN (${placeholders})`,
    ).all(targetLanguage, nativeLanguage, ...sources.map((source) => source.patternKey))

    const result = new Map<string, StoredPatternPresentation>()
    for (const row of rows) {
      const source = sourceByKey.get(row.pattern_key)
      if (!source || source.label !== row.source_label || source.rule !== row.source_rule) continue
      result.set(row.pattern_key, {
        patternKey: row.pattern_key,
        label: row.display_label,
        rule: row.display_rule,
        nativeLanguage,
        generatedAt: Number(row.generated_at),
      })
    }
    return result
  }

  save(
    targetLanguage: string,
    nativeLanguage: string,
    values: Array<PatternPresentationSource & {
      sourceLabel: string
      sourceRule: string
    }>,
    generatedAt = Date.now(),
  ): void {
    if (values.length === 0) return
    const database = this.database.connection()
    const statement = database.query(
      `INSERT INTO pattern_presentations
       (target_language, pattern_key, native_language, source_label, source_rule,
        display_label, display_rule, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(target_language, pattern_key, native_language) DO UPDATE SET
         source_label = excluded.source_label,
         source_rule = excluded.source_rule,
         display_label = excluded.display_label,
         display_rule = excluded.display_rule,
         generated_at = excluded.generated_at`,
    )
    const transaction = database.transaction(() => {
      for (const value of values) {
        statement.run(
          targetLanguage,
          value.patternKey,
          nativeLanguage,
          value.sourceLabel,
          value.sourceRule,
          value.label,
          value.rule,
          generatedAt,
        )
      }
    })
    transaction.immediate()
  }
}

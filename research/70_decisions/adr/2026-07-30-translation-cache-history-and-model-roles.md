# ADR: Translation Cache, History Privacy, and Workload Model Roles

## Status

Accepted

## Context

Selected-text translation should feel immediate on repeated use and should leave a useful history. Storing only a hash and timestamp cannot serve a cached translation because the translated artifact would be unavailable; storing the complete selected source would violate VibeLingo's privacy direction. Different language workloads also have different latency/quality needs, but choosing provider-specific model IDs would tightly couple the plugin to host configuration.

## Decision

VibeLingo stores the complete validated translated artifact, bounded to 8,000 Unicode code points, but never stores the complete selected source or raw model JSON.

Persistent cache identity is:

```text
SHA-256(
  normalized selection
  + native language
  + profile target language
  + destination policy
  + translation contract version
)
```

Normalization is limited to Unicode NFC, CRLF-to-LF conversion, and trimming outer whitespace. Internal whitespace, casing, and line breaks remain meaningful. Ordinary history may keep a sanitized source preview of at most 160 code points; whole user/assistant messages keep no preview. Sensitive source or output is excluded from SQLite and uses a five-minute process-local cache. Other non-persisted results use a 30-minute process-local cache. The LRU holds at most 100 entries.

History being disabled stops new persistent records and occurrences but does not disable reuse of already saved cache entries. Translation never creates target-language attempts, patterns, natural-use evidence, or review items.

Four settings select public Synergy model roles by workload:

- language detection;
- learning analysis;
- translation;
- review and pattern presentation.

Calls may request only an allowed Synergy role, never a provider/model ID. The role is deliberately absent from the translation cache key; the user can explicitly bypass cache to refresh an artifact.

## Rationale

The translated artifact is the reusable value, so retaining it is necessary to eliminate repeat model calls. Omitting complete source text preserves the stronger privacy invariant. A language/profile/direction/contract key prevents semantic cross-contamination, while excluding model role preserves useful cache across model-configuration changes. Workload roles give users meaningful control without leaking provider topology into the plugin.

## Consequences

- History can display full translations even when the source preview is unavailable.
- SHA-256 is an identity mechanism, not encryption or anonymization.
- Search can cover only saved previews and translations, not omitted full source text.
- Force refresh spends a new model call and atomically updates the cache.
- v0.7 uses destructive schema v8 and retains no earlier database compatibility path.

## Evidence

- `research/40_integration-patterns/privacy-and-consent/`
- `/Users/eric/projects/vibe-lingo/src/application/translation-service.ts`
- `/Users/eric/projects/vibe-lingo/src/infrastructure/translation-repository.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/host-services-runtime.ts`

## Revisit Trigger

Revisit if users need encrypted-at-rest source retention, opt-in phrase learning, provider-specific reproducibility, or measured cache staleness shows that contract-version invalidation is insufficient.

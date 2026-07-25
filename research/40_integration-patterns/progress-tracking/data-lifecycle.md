# Data Lifecycle & Privacy

## Overview

VibeLingo's data has a complete lifecycle: create → update → archive → delete. Every piece of data follows a defined path, and every step preserves user privacy. This document codifies the lifecycle for all data types and the privacy guarantees VibeLingo provides.

## Data Inventory

| Data Type | Storage | PII Risk | Retention | User Control |
|-----------|---------|----------|-----------|-------------|
| Vocabulary entries | Notes: `vibe-lingo-vocab-{lang}` | Low (words only, no identity) | Forever (user-controlled) | Browse, edit, delete, export |
| Error patterns | Notes: `vibe-lingo-errors-{lang}` | Low (aggregated stats) | Forever | Browse, delete, opt-out |
| Session summaries | Notes: `vibe-lingo-sessions-{lang}` | Low (counts only) | 90 days rolling | Delete, opt-out |
| Review state | Notes (embedded in vocab) | None | Forever | Manage via review |
| User preferences | Memory | Very low (language, level) | Forever | Edit anytime |
| Plugin config | PluginConfigAccessor | Very low (settings) | Forever | Edit anytime |
| Session analysis cache | PluginCacheStore | Medium (raw turn data) | 1 hour TTL | N/A (never persisted) |
| Raw user messages | NEVER stored | — | N/A | N/A |
| Raw agent responses | NEVER stored | — | N/A | N/A |

## Lifecycle by Data Type

### Vocabulary Entry Lifecycle

```
┌─────────┐     ┌────────┐     ┌──────────┐     ┌────────┐
│ CAPTURE │────→│ ACTIVE │────→│ LEARNED  │────→│ FOREVER│
└─────────┘     └───┬────┘     └──────────┘     └────────┘
                    │
                    │ (90d no review + no encounters)
                    ▼
              ┌──────────┐     ┌─────────┐
              │ ARCHIVED │────→│ DELETED │ (user only)
              └────┬─────┘     └─────────┘
                   │
                   │ (re-encountered)
                   ▼
              ┌────────┐
              │ ACTIVE │ (re-activated)
              └────────┘
```

**CAPTURE** → Word detected in `session.turn.after` analysis:
- Must pass capture rate-limiting (max 20/session, min 2 encounters)
- Initialized with FSRS state, complexity, context

**ACTIVE** → Regularly reviewed, encounter count increases:
- FSRS schedules reviews at decaying intervals
- Word appears in review sessions
- State updated on each review (D, S, R evolve)

**LEARNED** → Promoted when Stability ≥ 90 days:
- Removed from active review rotation
- Still tracked for encounter count (if user sees word again, it's noted)
- Can re-activate if user manually requests review

**ARCHIVED** → 90 days without review AND without encounter:
- Moved to archive section in note
- Not scheduled for review
- Can be re-activated by re-encounter or manual action
- Archived ≠ deleted — data preserved for potential future use

**DELETED** → User-initiated only:
- Remove row from note entirely
- No recovery (adds friction to prevent accidental deletion)
- Confirmation required

### Error Pattern Lifecycle

```
┌──────────┐     ┌────────┐     ┌──────────┐
│ DISCOVER │────→│ ACTIVE │────→│ RESOLVED │
└──────────┘     └───┬────┘     └────┬─────┘
                     │               │
                     │ (3+ occurrences)│ (re-surfaces)
                     ▼               ▼
              ┌─────────────┐  ┌────────┐
              │ FOCUSED     │  │ ACTIVE │
              │ REVIEW      │  │ (again)│
              │ TRIGGERED   │  └────────┘
              └─────────────┘
```

**DISCOVER** → First 1-2 occurrences:
- Pattern is created but not yet at focused review threshold
- Priority: low or medium
- Monitored for additional occurrences

**ACTIVE** → 3+ occurrences, unresolved:
- Focused review triggered in next Polish session
- Priority: high or critical
- After focused review, if no new occurrences for 30+ days → consider RESOLVED

**RESOLVED** → User stopped making this error:
- Moved to "Resolved" section
- Still monitored (can re-activate if resurfaces)
- Provides motivational signal: "You've fixed 3 error patterns this month!"

**OPTOUT** → User can disable error tracking entirely:
- Set via plugin config: `error_tracking: false`
- No new patterns are recorded
- Existing patterns preserved but not surfaced

### Session Summary Lifecycle

```
┌─────────┐     ┌──────────┐     ┌────────┐
│ CREATE  │────→│ ROTATING │────→│ DELETE │
│ (per    │     │ 90 days  │     │ (auto) │
│ session)│     └──────────┘     └────────┘
└─────────┘
```

- After each session: append one line to rolling note
- Auto-delete entries older than 90 days
- Used only for engagement metrics (trends, usage patterns)
- Minified: `2026-07-07|es|5w|2h|1p|0e|3m` (5 words, 2 helps, 1 polish, 0 explain, 3 messages)

### Review State Lifecycle

```
Review scheduled → skipped (busy) → skipped (busy) → completed
                                                        ↓
                                                  FSRS updated
                                                  Next review scheduled
```

- Review state lives as Agenda items + embedded in vocabulary note rows
- Agenda items auto-complete or auto-cancel after execution
- Completed review results preserved in vocabulary note (review history counters)
- No separate "review history" log — data is embedded in the vocabulary entry

## Data Export

Users can export their VibeLingo data:

```ts
async function exportData(language: string): Promise<VibeLingoExport> {
  // 1. Read vocabulary note
  const vocab = await readVocabularyNote(language)
  
  // 2. Read error patterns note
  const errors = await readErrorPatternsNote(language)
  
  // 3. Read user preferences
  const prefs = await readUserPreferences()
  
  // 4. Generate export
  return {
    exported_at: new Date().toISOString(),
    plugin_version: "0.1.0",
    schema_version: 1,
    language,
    vocabulary: vocab.activeWords.concat(vocab.learnedWords).concat(vocab.archivedWords),
    error_patterns: errors.patterns,
    preferences: prefs,
    stats: vocab.stats
  }
  // Export format: JSON or CSV
}
```

Export trigger: via `lingo_export` tool or plugin settings panel.

## Data Deletion

Users can delete data at multiple granularities:

| Scope | How | Effect |
|-------|-----|--------|
| Single word | Edit vocabulary note (or `lingo_forget <word>`) | Removed from note, review queue |
| Error pattern | `lingo_clear_errors` | Clears error note |
| Language | `lingo_reset {lang}` | Deletes vocabulary + error notes for that language |
| All data | Uninstall plugin + delete config | Removes all VibeLingo data from scope |

## Privacy Guarantees

1. **Conversation data never stored**: Raw user messages and agent responses are processed in the `session.turn.after` hook and immediately discarded. Only extracted metadata (words, error patterns, counters) is persisted.

2. **Session cache auto-expires**: PluginCacheStore entries have 1-hour TTL. Nothing from conversations survives beyond the current working session.

3. **Data stays in user's Synergy scope**: All Notes, Memory, and Config data lives in the user's project or home scope. No external servers. No telemetry. No analytics.

4. **No cross-user data sharing**: The plugin has no concept of "other users." Data is strictly scoped to the current Synergy scope.

5. **Opt-out controls**: Error tracking, automatic capture, and review scheduling can all be individually disabled through plugin settings.

6. **Transparent data model**: All stored data is in human-readable Markdown (Notes) and key-value (Memory/Config). Users can inspect everything without special tools.

7. **Minimal data collection**: The plugin stores only what's necessary for language learning. No usage analytics, no behavioral tracking, no personal identifying information beyond what's inherent in vocabulary words.

## Sources

- Platform storage: `research/20_synergy-platform/memory-notes-agenda/storage-mapping.md`
- Platform constraints: `research/20_synergy-platform/constraints-and-risks/permissions-constraints-risks.md`
- Design principles: `research/40_integration-patterns/interaction-design-principles.md`
- Vocabulary model: `research/40_integration-patterns/progress-tracking/vocabulary-data-model.md`
- Error model: `research/40_integration-patterns/progress-tracking/error-pattern-model.md`
- Review model: `research/40_integration-patterns/progress-tracking/review-state-model.md`

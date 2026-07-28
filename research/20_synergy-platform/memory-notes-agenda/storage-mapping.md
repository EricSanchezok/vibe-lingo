# Memory, Notes & Agenda — Storage Mapping

## Status Update (2026-07-28)

This is a historical candidate mapping, not current Plugin API guidance for VibeLingo.

V0.3 does not use Notes, Memory, Agenda, automatic review tasks, or FSRS. The current verified integration is plugin-owned SQLite plus UI-only operations. The backend prepares a due queue and waits for an explicit future Dashboard action; it does not claim that Agenda can infer a safe task boundary or user receptivity.

See `research/70_decisions/adr/2026-07-28-evidence-learning-loop-and-review-backend.md` and `/Users/eric/projects/synergy/packages/synergy/src/plugin/hook-points.ts`.

## Summary

Synergy provides three persistence mechanisms accessible to plugins: **Notes** (structured documents), **Memory** (semantic key-value), and **Agenda** (scheduled tasks). VibeLingo maps naturally to all three: vocabulary data and error patterns to Notes, user preferences to Memory, and review scheduling to Agenda. The Notes system's hook coverage (before/after for create, update, and search) is particularly well-suited for VibeLingo's word book.

## Notes System

### Hooks
| Hook | Interface | VibeLingo Use |
|------|-----------|---------------|
| `note.create.before` | Rewrite title, content, tags before creation | Ensure vocabulary entry format, auto-tag |
| `note.create.after` | Observe created notes | Confirm word book entry persisted |
| `note.update.before` | Rewrite patch before update | Validate FSRS state changes |
| `note.update.after` | Observe updated notes | Track review history |
| `note.search.before` | Rewrite search filters | Query vocabulary by tag/language/status |
| `note.search.after` | Filter/reorder results | Sort by next-review-date, difficulty |

### SDK API
- `client.note.create()` / `note.update()` / `note.search()` / `note.read()` / `note.list()` / `note.archive()`
- Notes support: title, content (markdown), tags, scope (project/global/home), pinned, kind (note/blueprint)
- **Blueprint support**: Notes with `kind: "blueprint"` become executable — not directly relevant to VibeLingo but interesting for future extensions

### VibeLingo Vocabulary Storage Design

One note per vocabulary word would create too many notes. Better approach:

**Single note per user per target language**: `vibe-lingo-vocabulary-{lang}` as a structured markdown document.

```
# VibeLingo Vocabulary — Spanish

Last reviewed: 2026-07-07

## Active (in review)
| Word | Translation | D | S | R | Next Review | Encounters | Context |
|------|-------------|---|---|---|-------------|------------|---------|
| implementar | to implement | 4 | 2.5d | 0.85 | 2026-07-09 | 3 | "implementar la función asíncrona" |
| depuración | debugging | 6 | 1d | 0.72 | 2026-07-08 | 5 | "necesito ayuda con la depuración" |

## Learned (retired from review)
| Word | Translation | Final S | Retired |
|------|-------------|---------|---------|
| función | function | 90d | 2026-06-15 |

## Error Patterns
| Pattern | Example | Count | Last Seen |
|---------|---------|-------|-----------|
| ser/estar confusion | "soy cansado" → "estoy cansado" | 7 | 2026-07-06 |
| subjunctive avoidance | "espero que viene" → "espero que venga" | 3 | 2026-07-05 |
```

**Alternative**: Use the note system more granularly — one note per vocabulary word with tags for filtering. This scales better for large vocabularies and allows note.search.after filtering by `Next Review` tag.

## Memory System

### Hooks
| Hook | Interface | VibeLingo Use |
|------|-----------|---------------|
| `library.memory.search.before` | Rewrite query, categories, recallModes | Pre-filter language-learning memories |
| `library.memory.search.after` | Filter/reorder results | Sort by relevance to current session |

### SDK API (via client)
- Memory API: search, write, get, edit — accessed through the `SynergyClient`
- Memory has `category` (user/self/relationship/interaction/workflow/coding/writing) and `recallMode` (always/contextual/search_only)

### VibeLingo Use

Memory is ideal for **user preferences and lightweight state** that should persist across sessions:

```ts
// Store target language preference
client.memory.write({
  title: "VibeLingo target language",
  content: "Spanish (es), level: intermediate",
  category: "workflow",
  recallMode: "always"
})

// Store learning frequency preference
client.memory.write({
  title: "VibeLingo intervention frequency",
  content: "low — only when I explicitly ask or at session boundaries",
  category: "workflow", 
  recallMode: "contextual"
})

// Query relevant memories before taking action
const prefs = await client.memory.search({
  query: "VibeLingo language learning preferences",
  categories: ["workflow"],
  topK: 5
})
```

## Agenda System

### Hooks
| Hook | Interface | VibeLingo Use |
|------|-----------|---------------|
| `agenda.run.before` | Skip or rewrite agenda execution | Defer review if user is in deep work |
| `agenda.run.after` | Observe successful runs | Track review completion |
| `agenda.run.error` | Observe failed runs | Handle review errors gracefully |

### SDK API
- `client.agenda.create()` / `agenda.update()` / `agenda.cancel()` / `agenda.trigger()` / `agenda.list()`
- `agenda_schedule` creates recurring tasks; `agenda_watch` creates one-time wake-ups

### VibeLingo Review Scheduling

```
FSRS calculates next review date → Agenda schedules a task for that date
                                   ↓
                      agenda.run.before hook checks:
                      - Is user in deep work? → skip, reschedule
                      - Is user at session boundary? → trigger review
                                   ↓
                      Review session fires:
                      - 5-10 word active recall quiz
                      - Results update FSRS state in vocabulary note
                      - Next review scheduled based on new Stability
```

Key advantage: The plugin can use `agenda.run.before` hook to contextually skip reviews when the user is deep in flow — addressing the interruption risk identified in SLA research.

## Additional Storage

### PluginConfigAccessor
```ts
ctx.config.set({ targetLanguage: "es", proficiencyLevel: "intermediate", interventionFrequency: "low" })
ctx.config.get() // → full config object
```
Best for: plugin settings that are set once and rarely change.

### PluginCacheStore
```ts
ctx.cache.set("session-context", { lastLanguage: "es", wordCount: 42 }, 3600000) // 1h TTL
ctx.cache.get("session-context")
```
Best for: session-scoped caching of analysis results (don't re-analyze the same message twice).

### PluginAuthStore
```ts
ctx.auth.set("api-key", "...") // WARNING: stored as plaintext
```
Best for: API keys if VibeLingo needs external services. **Privacy-sensitive — only store what's essential.**

## Storage Architecture Diagram

```
┌─────────────────────────────────────────────┐
│                 VibeLingo Plugin              │
├─────────────────────────────────────────────┤
│  User Prefs        Vocabulary & Errors        │
│  ┌─────────┐      ┌──────────────────┐       │
│  │ Memory  │      │     Notes        │       │
│  │ (key-value)     │  (structured md) │       │
│  │         │      │                  │       │
│  │ target  │      │  word book note  │       │
│  │ lang    │      │  error patterns  │       │
│  │ level   │      │  review history  │       │
│  │ freq    │      │  progress stats  │       │
│  └─────────┘      └──────────────────┘       │
│                                             │
│  Config              Agenda                  │
│  ┌─────────┐      ┌──────────────────┐       │
│  │ settings│      │  review schedule │       │
│  │ (stable)│      │  daily/weekly    │       │
│  └─────────┘      │  at boundaries  │       │
│                    └──────────────────┘       │
│                                             │
│  Cache                                       │
│  ┌─────────┐                                │
│  │ session │  session-scoped analysis cache   │
│  │ TTL: 1h │                                │
│  └─────────┘                                │
└─────────────────────────────────────────────┘
```

## Privacy Considerations

- **Memory contents are injected into agent context**: `recallMode: "always"` memories appear in every session. Be mindful of what goes into memory.
- **Notes are project-scoped by default**: Vocabulary notes stay within the project scope unless explicitly made global.
- **No conversation storage needed**: VibeLingo extracts vocabulary from messages without storing raw conversation content — this is a key privacy design constraint.
- **Config/auth stored as plaintext on disk**: Avoid storing sensitive user data in config. Use only for non-sensitive preferences.

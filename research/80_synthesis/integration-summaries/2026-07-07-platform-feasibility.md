# Platform Feasibility: VibeLingo on Synergy

## Bottom Line

VibeLingo's three core features are **fully feasible** on the Synergy plugin platform. The hook system provides all necessary interception points, and the storage systems (Notes + Memory + Agenda) map cleanly to vocabulary persistence and review scheduling. The recommended architecture is: **stable hooks for core functionality + explicit tools for user interaction + experimental hooks deferred as optional enhancements**.

## Feasibility Matrix

| VibeLingo Feature | Feasibility | Key Mechanism | Risk Level |
|---|---|---|---|
| Input Assistance (help me say...) | ✅ Fully feasible | `tool("lingo_help")` — explicit, reliable | Low |
| Expression Polish (inline) | ✅ Fully feasible | `tool("lingo_polish")` + optional `chat.message` pre-processing | Low |
| Comprehension Support (explain/translate) | ✅ Feasible | `tool("lingo_explain")` — explicit; `experimental.chat.messages.transform` as optional inline enhancement | Medium |
| Automatic Vocabulary Capture | ✅ Fully feasible | `session.turn.after` → analyze → `note.create` | Low |
| Word Book (persistent vocabulary) | ✅ Fully feasible | Notes (structured markdown) + UI Panel (web app) | Low |
| Spaced Repetition Review | ✅ Fully feasible | Agenda scheduling + FSRS algorithm + `agenda.run.before` context check | Low |
| Progress Tracking | ✅ Fully feasible | Notes for stats + Memory for preferences | Low |
| Inline Agent Behavior Tuning | ⚠️ Feasible but fragile | `experimental.chat.system.transform` — inject language-learning prompts | Medium |
| Inline Response Translation | ⚠️ Feasible but fragile | `experimental.chat.messages.transform` — rewrite history | Medium |
| Cross-Surface Support | ✅ Automatic | Hooks fire regardless of surface (web/Feishu/TUI) | Low |

## Architecture Recommendation

### Core Architecture (Stable APIs)

```
                 User Message
                      ↓
              ┌──────────────┐
              │ chat.message  │ → Detect target language
              │   (hook)      │ → Add subtle annotation (optional)
              └──────┬───────┘
                     ↓
              Agent Processes
                     ↓
              Agent Calls VibeLingo Tools:
              ┌──────────────────┐
              │  lingo_help      │ → Input assistance
              │  lingo_polish    │ → Expression refinement
              │  lingo_explain   │ → Comprehension support
              └──────────────────┘
                     ↓
              Agent Responds
                     ↓
         ┌────────────────────┐
         │ session.turn.after │ → Analyze for vocabulary
         │     (hook)         │ → Capture new words
         │                    │ → Detect error patterns
         │                    │ → Update progress stats
         └────────┬───────────┘
                  ↓
         ┌────────────────────┐
         │  Storage Layer     │
         │  ┌──────────────┐  │
         │  │ Notes        │  │ → Word book (structured MD)
         │  │ Memory       │  │ → User preferences
         │  │ Agenda       │  │ → Review scheduling
         │  │ Config       │  │ → Plugin settings
         │  │ Cache        │  │ → Session context
         │  └──────────────┘  │
         └────────────────────┘
```

### Interaction Flow (Primary Use Cases)

#### Use Case 1: Input Assistance
```
User: @vibe-lingo help "我需要把返回值改成异步的"
  → Agent calls tool: lingo_help({query: "我需要把返回值改成异步的"})
  → Plugin returns: "Here are two ways: 
      1. 'I need to make the return value asynchronous.'
      2. 'I need to convert the return type to async.'"
  → Agent presents result to user
  → session.turn.after: capture "asynchronous" → vocabulary note
```

#### Use Case 2: Expression Polish
```
User: Can you making the code more faster?
  → chat.message hook: detect non-native English, annotate
  → Agent responds (normal flow)
  → User (dissatisfied): @vibe-lingo polish
  → Agent calls tool: lingo_polish({text: "Can you making the code more faster?"})
  → Plugin returns: "Suggestion: 'Can you make the code faster?'
       making → make (after modal 'can')
       more faster → faster (faster already means more fast)"
  → Agent presents result
  → session.turn.after: capture error pattern "modal + -ing" → error tracking
```

#### Use Case 3: Comprehension Support
```
Agent: The issue is a race condition caused by mutable shared state across async boundaries.
User: @vibe-lingo explain "race condition" and "mutable shared state"
  → Agent calls tool: lingo_explain({terms: ["race condition", "mutable shared state"]})
  → Plugin returns:
      "race condition (竞态条件): when multiple operations compete and the result 
       depends on timing rather than logical order.
       mutable shared state (可变共享状态): data that multiple parts of code can 
       modify simultaneously, leading to unpredictable behavior."
  → session.turn.after: capture "race condition", "mutable" → vocabulary notes
```

### Experimental Enhancements (Phase 2+)

Once the core tool-based approach is stable, experimental hooks can add finesse:

1. **`experimental.chat.system.transform`**: Inject "when the user writes in Spanish, respond in Spanish but keep it at B1 level" → improves input quality
2. **`experimental.chat.messages.transform`**: Add inline translations to agent responses without user needing to ask → passive comprehension support
3. **`experimental.session.compacting`**: Preserve learned vocabulary context during compaction → prevent learning loss

## What VibeLingo CANNOT Do (and Workarounds)

| Limitation | Impact | Workaround |
|---|---|---|
| Cannot modify agent response after it's sent | No inline translation of agent output | Use tool-based approach: user asks `lingo_explain`, or use experimental messages.transform |
| Cannot inject inline UI into conversation | No "Polish" button next to each message | Use message slots (static) or rely on explicit commands (@vibe-lingo polish) |
| Cannot force agent to call plugin tools | Agent may ignore VibeLingo tools | Register tools at high priority + system prompt injection (experimental) encourages usage |
| Cannot run on user keystrokes | No real-time "as you type" assistance | Post-message assistance only; acceptable per SLA research (immediate post-composition feedback works well) |

## Storage Strategy

| Data | Storage | Rationale |
|------|---------|-----------|
| Word book (active vocabulary) | Notes: `vibe-lingo-vocabulary-{lang}` | Structured, searchable via note tags, user-visible/editable |
| Error patterns | Notes: `vibe-lingo-errors-{lang}` | Pattern tracking for focused feedback |
| User preferences | Memory: category="workflow", recallMode="always"/"contextual" | Lightweight, injected into sessions for consistent behavior |
| Plugin settings | PluginConfigAccessor | Simple key-value, rarely changes |
| Review schedule | Agenda items | Native scheduling with context-aware skip capability |
| Session analysis cache | PluginCacheStore with TTL | Avoid re-analyzing same messages |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Experimental hooks removed in future Synergy | Medium | Medium | Core functions use stable hooks only; experimental hooks are optional |
| Permission rejection by users | Medium | High | Minimal surface; clear trust narrative; core tools work without session:read |
| Agent doesn't call VibeLingo tools | Low-Medium | Medium | System prompt injection + high visibility tool registration |
| Vocabulary note grows too large | Medium | Low | Partition by date; archive old entries; pagination in search |
| Hook latency impacts user experience | Low | Medium | Keep hook logic O(1) per message; defer heavy processing to session.turn.after |

## Recommended Implementation Priority

1. **Phase 1 (MVP)**: lingo_help + lingo_polish + lingo_explain tools → session.turn.after vocabulary capture → Notes-based word book
2. **Phase 2 (Persistence)**: Agenda-based review scheduling → FSRS integration → word book UI panel
3. **Phase 3 (Finesse)**: chat.message pre-processing → experimental hooks for inline enhancement → progress dashboard

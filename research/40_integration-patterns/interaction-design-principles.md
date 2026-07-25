# VibeLingo Interaction Design Principles

> Authors: SLA research + Synergy platform analysis + Competitive landscape
> Date: 2026-07-07

## Design System Overview

VibeLingo is invisible by default, available on demand. It has no separate UI, no study mode, no gamification. All interactions flow through the agent conversation — either as explicit tool invocations or as subtle, passive background processes. This document codifies the design rules that ensure every interaction is SLA-grounded, platform-feasible, and user-respecting.

## The Four Golden Rules

### Rule 1: In-Flow, Not Side-Quest

Every VibeLingo interaction happens within the agent conversation. The plugin has no separate "learning app" mode. The user never needs to switch context — help arrives where they are already working.

**SLA basis**: Incidental learning (Webb et al., 2023 — 9-18% per session) is maximized when language use is authentic, not simulated. The agent conversation IS authentic communication. Separating learning from work would reduce involvement load (Hulstijn & Laufer, 2001) and weaken motivation (integrated regulation in SDT).

**Platform basis**: Plugin tools output appears inline in conversation. Message slots provide static UI hooks. No dynamic inline UI — all interaction through agent-mediated tools.

**Anti-pattern avoided**: LingQ/Duolingo "switch to learning app" model.

### Rule 2: User Leads, Plugin Supports

The plugin never interrupts, corrects, or suggests unprompted. The user initiates every assistance request. The default posture is: user tries first, plugin helps when asked. Background processes (vocabulary capture, review scheduling) are silent and deferrable.

**SLA basis**: Autonomy (SDT — Deci & Ryan, 2000). Corrective feedback timing research: immediate correction during composition is effective; correction during non-language tasks is disruptive. Dual-mode approach respects user agency.

**Platform basis**: Plugin cannot inject UI dynamically or force agent behavior. Tools are agent-invoked, not plugin-pushed. This architectural constraint aligns with the design principle.

**Anti-pattern avoided**: Grammarly's "always underline everything" model. Clippy syndrome.

### Rule 3: Teach Through Use, Not Through Lessons

Every assistance moment leaves the user slightly better. The Polish tool doesn't just fix — it explains WHY. The Help tool doesn't just translate — it shows HOW to structure the expression. Comprehension support explains terms, not just translates them. Micro-reviews test active recall, not passive recognition.

**SLA basis**: Metalinguistic feedback outperforms recasts (Lyster & Saito, 2010: prompts d=0.83 vs recasts d=0.53). Noticing Hypothesis (Schmidt, 1990): conscious attention to form is necessary for acquisition. The "show me why" preference is evidence-backed.

**Platform basis**: Tool output can include structured explanations + alternatives. No length limit on tool output — can include context-rich explanations.

**Anti-pattern avoided**: Grammarly "fix without teach." Duolingo "learn by doing without understanding."

### Rule 4: Remember Everything, Burden Nothing

Vocabulary, error patterns, and progress are captured automatically and persistently. The word book builds itself. Review happens at natural boundaries, not on a schedule that competes with work. The user can browse, edit, and export their data — but never HAS to. Missed reviews slide gracefully; the system adapts.

**SLA basis**: Spacing effect (Cepeda et al., 2006) requires review, but delivery must respect the user's primary task. FSRS algorithm handles adaptive scheduling. Incidental vocabulary acquisition requires multiple exposures (10-15) across sessions — persistence is non-negotiable.

**Platform basis**: Notes for word book, Memory for preferences, Agenda for scheduling. `agenda.run.before` enables context-aware review skipping. All data stays in user's Synergy scope — no external servers.

**Anti-pattern avoided**: Anki's review burden anxiety. LingQ's manual word marking. Duolingo's forced streak.

## Interaction Mode Decision Tree

```
User types a message in target language
    │
    ├─ User gets stuck mid-typing, can't express something
    │   → lingo_help (Pattern: Input Assistance)
    │
    ├─ User finishes typing, but feels expression is awkward/wrong
    │   → lingo_polish (Pattern: Expression Polish)
    │
    ├─ Agent responds, user doesn't fully understand
    │   → lingo_explain (Pattern: Comprehension Support)
    │
    └─ [Background] session.turn.after fires
        → Capture vocabulary (Pattern: Vocabulary Capture)
        → Update progress stats
```

```
Time passes / session boundaries
    │
    ├─ Agenda fires review task
    │   → agenda.run.before checks context
    │       ├─ User in deep work → skip, reschedule
    │       └─ User at boundary / idle → trigger micro-review
    │           → 5-10 word active recall quiz
    │           → Update FSRS state
    │           → Schedule next review
```

## Tool Architecture

VibeLingo registers three explicit tools + operates background hooks:

### Explicit Tools (Agent-Invoked)

| Tool | Exposure | Trigger | Output |
|------|----------|---------|--------|
| `lingo_help` | resident | User asks "help me say X in [lang]" | Natural expression(s) with structure notes |
| `lingo_polish` | resident | User asks "polish this" / "is this correct?" | Corrected text + explanation + alternatives |
| `lingo_explain` | resident | User asks "what does X mean?" | Definition + context + related terms |

### Background Hooks (Automatic)

| Hook | Purpose | Behavior |
|------|---------|----------|
| `chat.message` | Lightweight pre-processing | Detect target language in user message, add subtle metadata. No modification of message content. |
| `session.turn.after` | Vocabulary capture + progress tracking | Analyze completed conversation turn. Extract new/challenged vocabulary. Update word book. Detect error patterns. Update engagement stats. |

### Storage Backend

| Data | Store | Structure |
|------|-------|-----------|
| Active vocabulary | Notes: `vibe-lingo-vocab-{lang}` | Markdown table with FSRS state per word |
| Error patterns | Notes: `vibe-lingo-errors-{lang}` | Markdown list with pattern + count + last seen |
| User preferences | Memory: category="workflow" | Target language, proficiency level, review frequency |
| Plugin settings | PluginConfigAccessor | Stable config: language, level, intervention frequency |
| Session cache | PluginCacheStore (TTL: 1h) | Avoid re-analyzing same messages |

## Proficiency Adaptation

The plugin adapts its assistance to the user's self-declared proficiency level:

| Level | Input Assistance | Expression Polish | Comprehension | Review |
|-------|-----------------|-------------------|---------------|--------|
| **Beginner** | Full translation + word-by-word breakdown | Direct correction + simple rule explanation | Full translation available | Mostly recognition tasks |
| **Intermediate** | Structure hints + vocabulary alternatives | Metalinguistic hint first, correction as fallback | Term-level explanation only | Mix of recognition + recall |
| **Advanced** | Subtle phrasing alternatives only | Elicitation: "can you spot the issue?" | Rarely needed | Mostly recall tasks |

### Level Detection

- User declares proficiency at install (self-assessment)
- System tracks engagement signals: help-request frequency, error rates, vocabulary complexity of user's messages
- Suggests level adjustment when patterns suggest readiness to advance
- User always controls final level setting

## Privacy & Consent Boundaries

| Data | Collection | Storage | User Control |
|------|-----------|---------|-------------|
| Vocabulary words | Automatic, opt-in | Notes in user scope | Browse, edit, delete, export |
| Error patterns | Automatic, opt-in | Notes in user scope | Browse, delete, opt-out |
| Conversation content | NEVER stored | N/A | N/A |
| User messages | Processed, extracted from, then discarded | Cache (1h TTL) | N/A (never persisted) |
| Agent responses | Processed, extracted from, then discarded | Cache (1h TTL) | N/A (never persisted) |

**Privacy principle**: Extract, don't store. VibeLingo learns vocabulary FROM conversations, never stores conversations themselves. This is both a trust guarantee and a technical constraint — the plugin has no business storing raw messages.

## Design Constraints from Platform

| Constraint | Design Implication |
|---|---|
| `session.turn.after` is observation-only | Cannot add translations to agent responses after-the-fact. Comprehension must be user-initiated via lingo_explain. |
| No dynamic inline UI | Cannot add "Polish" button to each user message. Interaction through message slots (static) or explicit @mentions. |
| Agent must invoke tools | User triggers via natural language → Agent calls tool. Cannot force agent to call VibeLingo tools. |
| Experimental hooks unstable | `chat.messages.transform` and `chat.system.transform` are Phase 2 enhancements. Core architecture uses stable hooks + tools only. |
| Plugin data stays in scope | No cross-user or cross-scope data sharing. User's word book is theirs alone. |

## Design Pattern Reference (For Each Feature Note)

Every feature design note in this directory follows the same structure:
1. **User Intent**: What the user is trying to accomplish
2. **Trigger**: How the interaction is initiated
3. **Interaction Flow**: Step-by-step sequence with tool/hook mapping
4. **SLA Foundation**: Which research findings justify this design
5. **Edge Cases**: What could go wrong, and how we handle it
6. **Interaction Diagram**: Sequence description of the flow

## Sources

- SLA synthesis: `research/80_synthesis/literature-summaries/2026-07-07-sla-teaching-strategies.md`
- Platform feasibility: `research/80_synthesis/integration-summaries/2026-07-07-platform-feasibility.md`
- Competitive synthesis: `research/80_synthesis/integration-summaries/2026-07-07-competitive-analysis.md`
- Design preferences: `research/00_index/design-preferences.md`

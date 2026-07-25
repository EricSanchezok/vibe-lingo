# VibeLingo Product Plan

> Date: 2026-07-07
> Phase: Research → Design transition
> Status: Ready for MVP definition and implementation planning

## 1. Product Vision & Positioning

### Vision

**Learn a language by living it.** VibeLingo transforms every AI agent conversation into natural language practice. While you code, research, and build with your Synergy agent, the plugin quietly captures vocabulary, polishes your expression, explains what you don't understand, and schedules just-in-time reviews — all without leaving your workflow.

### Positioning Statement

> VibeLingo is the first **agent-native language learning plugin**. Unlike Duolingo (play to learn), Anki (memorize to learn), or Grammarly (fix without learning), VibeLingo enables learning *as a byproduct of real work with an AI agent*. No separate app. No study mode. No gamification. Just real communication, supported by evidence-backed language pedagogy.

### Unique Value Proposition

| Dimension | Existing Products | VibeLingo |
|-----------|------------------|-----------|
| **Content source** | Curated lessons, imported articles | Real agent conversations (authentic, personal) |
| **Interaction partner** | App exercises, human strangers | AI agent (always available, never judges) |
| **Learning model** | Explicit study mode | Incidental, in-flow learning |
| **Persistence** | Manual flashcards, app-dependent | Automatic capture + FSRS review |
| **Motivation** | Gamification, streaks, social pressure | Intrinsic (better communication = better work) |
| **Setup** | Create account, pick course, make cards | Install → set language → done |

### Competitive Positioning (Quadrant)

```
                    Explicit Learning ←──────→ Implicit Learning
                              │                        │
     Duolingo ────────────────┼────────────────────────┤
     Anki ────────────────────┼────────────────────────┤
                              │                        │
     Grammarly ───────────────┼────────────────────────┤
                              │                   ☆ VibeLingo
                              │                        │
                    Separate  ←──────→ Embedded in Workflow
```

VibeLingo is the only product in the **Implicit + Embedded** quadrant with a pedagogical backbone (not just a correction tool).

### Target Audience

- **Primary**: Synergy users who want to improve a target language while maintaining productivity
- **Proficiency**: A2 (elementary) to B2 (upper intermediate) — beginners need more structure, advanced learners need less support
- **Languages**: Conceptually multilingual from day one; initial focus on English for Chinese speakers (largest validated market), expandable to any language pair
- **Work contexts**: Vibe coding, vibe research, technical writing, daily agent Q&A

## 2. MVP Definition (Phase 1)

### MVP Scope

**Three explicit tools + one background hook + persistent word book. No review scheduling yet.**

### MVP Features

#### Feature 1: Input Assistance (`lingo_help`)

**What**: User asks "help me say X in [target language]" → plugin returns 2-3 natural expressions with brief vocabulary notes.

| Attribute | Detail |
|-----------|--------|
| Trigger | User explicitly requests via natural language |
| SLA basis | Output Hypothesis (pushed output), Involvement Load Hypothesis (high Need+Search+Evaluation) |
| Platform | `tool("lingo_help")`, exposure: resident |
| MVP scope | Detect language auto, return expressions + notes. No proficiency adaptation yet. |
| Out of scope | Register/tone selection, multi-turn refinement |

#### Feature 2: Expression Polish (`lingo_polish`)

**What**: User asks "polish this" → plugin returns layered feedback: metalinguistic hint → correction → explanation.

| Attribute | Detail |
|-----------|--------|
| Trigger | User explicitly requests |
| SLA basis | Corrective feedback: prompts (d=0.83) > recasts (d=0.53), metalinguistic optimal |
| Platform | `tool("lingo_polish")`, exposure: resident |
| MVP scope | Three layers of feedback (hint, correction, explanation). Focused error prioritization. |
| Out of scope | Focused review triggers, pattern tracking, alternatives |

#### Feature 3: Comprehension Support (`lingo_explain`)

**What**: User asks "what does X mean?" → plugin returns surgical definition with context example and L1 translation.

| Attribute | Detail |
|-----------|--------|
| Trigger | User explicitly requests |
| SLA basis | Comprehensible Input (i+1), Noticing Hypothesis |
| Platform | `tool("lingo_explain")`, exposure: resident |
| MVP scope | Term-level explanation + L1 translation + context example |
| Out of scope | Full-message explanation, related terms, code-vs-language disambiguation |

#### Feature 4: Automatic Vocabulary Capture

**What**: `session.turn.after` silently analyzes completed conversation turns, extracts new vocabulary, writes to word book note.

| Attribute | Detail |
|-----------|--------|
| Trigger | Automatic (every completed turn) |
| SLA basis | Incidental vocabulary acquisition (9-18%/session, Webb et al. 2023), Involvement Load Hypothesis |
| Platform | `session.turn.after` hook → `note.update` |
| MVP scope | Extract words → score context → initialize FSRS state (D, S, R) → write to note. Rate-limited (20/session). |
| Out of scope | Error pattern tracking, complexity scoring, concreteness, encounter-based re-prioritization |

#### Feature 5: Persistent Word Book

**What**: One structured markdown note per language (`vibe-lingo-vocab-{lang}`) stores all captured vocabulary with FSRS state.

| Attribute | Detail |
|-----------|--------|
| Data | Per word: lemma, translation, POS, complexity, first/last seen, encounter count, context sentence, FSRS D/S/R state |
| Storage | Synergy Notes |
| MVP scope | Read/write vocabulary. User can browse and manually edit. |
| Out of scope | Review scheduling, learned/archived states, export |

### MVP Success Criteria

| Criterion | Target |
|-----------|--------|
| Plugin installs and loads without errors | 100% |
| Three tools register and respond correctly | 100% |
| Vocabulary capture writes valid entries | ≥ 90% accuracy (manual review of 50 turns) |
| Word book note is readable and user-editable | Yes |
| Plugin does not modify user messages without explicit invocation | 0 false activations |
| Plugin adds < 500ms latency to message processing | Measured |

### MVP Out of Scope

- Review scheduling / FSRS-driven micro-reviews
- Error pattern tracking / focused feedback
- chat.message hook pre-processing
- Proficiency adaptation (beginner vs. intermediate vs. advanced)
- Multi-language simultaneous support
- UI panels / message slots / settings page (web app only)
- Experimental hooks (chat.messages.transform, chat.system.transform)
- Agenda integration
- Memory-based user preferences (use PluginConfigAccessor only)
- Engagement metrics / progress statistics

### MVP Permission Requirements

```json
{
  "data": { "session": "read" },
  "tools": { "shell": false, "network": false },
  "hooks": { "promptTransform": false, "toolExecute": "own" },
  "ui": { "workbenchPanels": false, "settings": false }
}
```

Minimal permission surface. Only `data.session: "read"` is required (to read conversation in `session.turn.after`). Trust narrative: "VibeLingo reads your conversation to detect new vocabulary. It never stores your messages — only the words you encounter."

## 3. Full Feature Blueprint (All Phases)

### Phase 1 — MVP (Core Tools + Passive Capture)

| Feature | Status |
|---------|--------|
| `lingo_help` — Input assistance | ✅ MVP |
| `lingo_polish` — Expression polish | ✅ MVP |
| `lingo_explain` — Comprehension support | ✅ MVP |
| `session.turn.after` — Vocabulary capture | ✅ MVP |
| `vibe-lingo-vocab-{lang}` — Persistent word book | ✅ MVP |
| PluginConfigAccessor — User preferences | ✅ MVP |
| PluginCacheStore — Session analysis cache | ✅ MVP |

### Phase 2 — Persistence & Review

| Feature | Description |
|---------|-------------|
| **FSRS Review Engine** | Implement FSRS algorithm. Calculate next review date per word based on D/S/R. Binary grading (correct/incorrect). |
| **Micro-Review Sessions** | 5-10 word active recall quizzes. Triggered by Agenda scheduling. Format: "What does [word] mean?" → user answers → show context. |
| **Agenda Integration** | `agenda.run.before` context-aware skip. Schedule reviews at idle moments. Reschedule if user is busy. |
| **Error Pattern Tracking** | Track recurring errors from polish sessions. Focused feedback when pattern count ≥3. Note: `vibe-lingo-errors-{lang}`. |
| **Focused Feedback** | When polish detects a recurring pattern (≥3 occurrences), include a brief focused review section: rule refresher + examples. |
| **Proficiency Adaptation** | Adjust tool output (explanation depth, vocabulary complexity) based on user's self-declared level. Track level changes over time. |
| **Multi-Language Support** | Allow user to switch target language. Separate vocabulary/error notes per language. |
| **chat.message Hook** | Lightweight pre-processing: detect target language usage, annotate session metadata. No message modification. |
| **Progress Stats** | Per-language stats: total words, retention rate, review compliance, streak. Embedded in vocabulary note metadata. |
| **Memory Integration** | Store user preferences (target language, level, desired retention) in Synergy Memory (category: workflow, recallMode: contextual). |
| **Session Summaries** | Rolling 90-day session log: words captured, tools used, messages in target language. |

### Phase 3 — Finesse & Polish

| Feature | Description |
|---------|-------------|
| **Web App UI Panel** | Word book browser panel: browse, search, edit vocabulary. Review dashboard: stats, trends, level trajectory. |
| **Plugin Settings Page** | Configure target language, proficiency level, intervention frequency, desired retention. Enable/disable individual features. |
| **Message Slots** | "Polish" / "Explain" buttons on user messages in web app (static, declarative). |
| **Engagement Metrics** | Track tool usage trends, error rate trajectory. Adapt plugin behavior: decrease review frequency if user is skipping. |
| **Experimental Hooks** (if stable) | `chat.system.transform`: inject language-learning guidance into system prompt. `chat.messages.transform`: inline translation of agent responses. |
| **Alternative Review Formats** | Production recall (L1→L2), gap-fill, synonym matching. Adapt format to proficiency level. |
| **Vocabulary Export** | Export word book as JSON/CSV. Import from Anki decks (basic compatibility). |
| **Community Decks** | Optional: share vocabulary lists, error pattern rules, language-specific configurations. |
| **Cross-Scope Sync** | Optional: sync vocabulary across user's Synergy scopes (home + projects). |

### Feature Dependency Map

```
Phase 1 (MVP)
  ├── lingo_help ────────────────────────── independent
  ├── lingo_polish ──────────────────────── independent
  ├── lingo_explain ─────────────────────── independent
  ├── vocabulary capture ────────────────── depends: session.turn.after hook
  └── word book ─────────────────────────── depends: vocabulary capture

Phase 2 (Persistence & Review)
  ├── FSRS engine ───────────────────────── depends: word book data model
  ├── micro-reviews ─────────────────────── depends: FSRS engine + Agenda
  ├── error pattern tracking ────────────── depends: lingo_polish
  ├── focused feedback ──────────────────── depends: error pattern tracking
  ├── proficiency adaptation ────────────── depends: all three tools
  ├── multi-language ────────────────────── depends: word book architecture
  ├── chat.message hook ─────────────────── independent (lightweight)
  ├── progress stats ────────────────────── depends: word book + reviews
  ├── memory integration ────────────────── independent
  └── session summaries ─────────────────── depends: session.turn.after

Phase 3 (Finesse)
  ├── UI panels ─────────────────────────── depends: word book + progress stats
  ├── settings page ─────────────────────── depends: memory integration
  ├── message slots ─────────────────────── depends: three tools
  ├── engagement metrics ────────────────── depends: session summaries
  ├── experimental hooks ────────────────── depends: API stability
  ├── alternative reviews ───────────────── depends: micro-reviews + proficiency
  ├── export/import ─────────────────────── depends: word book
  ├── community decks ───────────────────── optional
  └── cross-scope sync ──────────────────── optional
```

## 4. Success Metrics

### Learning Effectiveness

| Metric | Target | Measurement |
|--------|--------|-------------|
| Words captured per session | ≥ 3 (coding), ≥ 5 (research/writing) | session.turn.after counter |
| Vocabulary retention at 30 days | ≥ 70% (with review), ≥ 30% (without review) | FSRS R on delayed review |
| Error pattern resolution | ≥ 50% of patterns resolved within 30 days of focused review | Error pattern note |
| Polish acceptance rate | ≥ 60% of polish suggestions accepted by user | Tool output tracking |

### Engagement

| Metric | Target | Measurement |
|--------|--------|-------------|
| Plugin stays installed | ≥ 80% at 30 days | Plugin status API |
| Tool usage frequency | ≥ 1 tool use per 3 sessions | Session summary log |
| Review compliance | ≥ 60% of scheduled reviews completed | Agenda completion rate |
| Days to first value | ≤ 1 session (plugin captures words in first session) | Vocabulary note |

### Non-Goals (What We Do NOT Measure)

- Daily active users (DAU) — not a consumer app
- Session time — shorter is better (no "time in app" metric)
- Streaks — explicitly anti-gamification
- Revenue per user — free/core plugin, premium features TBD

### Warning Signals (If These Fire, Reassess)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Plugin disabled | >30% within 7 days | Reassess permission burden, interruption model |
| Tool invocations decline | Trending toward 0 for 14+ days | Check if Agent stopped calling tools |
| Review skip rate | >80% for 7+ days | Reduce desired retention, decrease review frequency |
| Polish suggestions ignored | <30% acceptance for 30+ days | Check if corrections are accurate; survey users |
| Vocabulary note empty | Still empty after 5+ sessions | Check capture pipeline, language detection |

## 5. Failure Modes & Mitigations

### Critical Failure Modes

| # | Failure | Probability | Impact | Mitigation |
|---|---------|------------|--------|------------|
| F1 | Agent doesn't call VibeLingo tools | Medium | High | Register tools at high visibility (resident exposure); provide clear tool descriptions; in Phase 3, use system prompt injection as fallback |
| F2 | Permission rejection at install | Medium | High | Minimal MVP permission surface (session:read only); clear trust narrative; tool-only fallback mode |
| F3 | Vocabulary note grows too large | Low | Medium | Partition by date range if >5,000 words; auto-archive old entries; test with C2-level vocabulary (12K words) |
| F4 | FSRS state corrupted | Low | High | Validate state on every read; fallback to reinitialize from scratch; backup note before updates |
| F5 | Plugin interferes with agent behavior | Low | High | Strict hook isolation; fail-open design (if plugin errors, conversation continues normally); test with popular plugins |

### Medium Failure Modes

| # | Failure | Probability | Impact | Mitigation |
|---|---------|------------|--------|------------|
| F6 | Language detection unreliable | Medium | Medium | Confidence threshold; skip analysis on low-confidence turns; allow manual language override |
| F7 | Too many false corrections in polish | Medium | Medium | Confidence indicators on suggestions; user feedback loop; rate-limit polish suggestions |
| F8 | Review prompts annoy user | Medium | Medium | agenda.run.before context gate; decrease frequency; allow one-click disable of reviews |
| F9 | Code mistaken for vocabulary | Medium | Low | Strip code blocks before analysis; filter programming keywords; check context |
| F10 | Cross-plugin conflicts | Low | Medium | Document hook interactions; use unique tool names; test with popular Synergy plugins |

### Design Principle Failures

| Principle | Failure Mode | Guardrail |
|-----------|-------------|-----------|
| In-Flow | Plugin takes user out of flow | No popups, no modals, no "must review NOW" forcing |
| User Leads | Plugin corrects unprompted | All corrections are user-initiated via explicit tool calls |
| Teach Through Use | Polish fixes without explaining | Every correction includes metalinguistic explanation |
| Remember Everything | Data lost on plugin uninstall | Export feature; data stored in user's Synergy scope (survives uninstall) |

## 6. Implementation Roadmap

### Phase 1: MVP (Estimated: 4-6 weeks, solo developer)

```
Week 1-2: Plugin scaffold + tool registration
  • Create Synergy plugin manifest
  • Register lingo_help, lingo_polish, lingo_explain tools
  • Implement tool execution stubs
  • Test tool invocation by Agent

Week 2-3: Core tool logic
  • lingo_help: language detection + LLM-based expression generation
  • lingo_polish: grammar analysis + progressive disclosure output
  • lingo_explain: term lookup + contextual definition
  • LLM integration: use Synergy's built-in model or plugin's own LLM call

Week 3-4: Vocabulary capture
  • session.turn.after hook: extract text from turns
  • Tokenization + normalization + candidate identification
  • Context scoring + prioritization
  • Word book note write (structured markdown)
  • Capture rate-limiting

Week 4-5: Word book
  • Initialize FSRS state (D, S, R) on capture
  • Read/parse vocabulary note
  • Status management (active only in MVP)

Week 5-6: Testing + Polish
  • Test with real Synergy sessions
  • Fix tool invocation reliability
  • Performance profiling (hook latency <500ms)
  • Permission manifest + trust narrative
  • Documentation
```

### Phase 2: Persistence & Review (Estimated: 4-6 weeks)

```
Week 1-2: FSRS engine
  • Implement FSRS algorithm (3-component DSR model)
  • Binary grading (correct/incorrect)
  • State update on review (onCorrectReview, onIncorrectReview)
  • Retrievability decay (time-based)

Week 2-3: Review scheduling
  • Agenda integration: schedule/create/update review items
  • agenda.run.before: context-aware skip
  • Micro-review session: present words, collect answers, update state
  • Review format: active recall (L2 → L1)

Week 3-4: Error patterns + Focused feedback
  • Track errors from polish sessions
  • Pattern detection (same error type ≥3 times)
  • Focused review generation in polish output
  • Resolution tracking

Week 4-5: Proficiency + Multi-language
  • Adapt tool output to proficiency level
  • Separate vocabulary/error notes per language
  • Language switching support

Week 5-6: Progress + Memory
  • Per-language statistics
  • Memory-based user preferences
  • Session summary rolling log
  • Engagement metrics
```

### Phase 3: Finesse (Estimated: 4-8 weeks)

```
Week 1-2: Web app UI
  • Word book browser panel
  • Review dashboard panel
  • Plugin settings page

Week 2-3: Enhanced tools
  • Message slots (Polish/Explain buttons)
  • Alternative review formats (production, gap-fill, synonym)
  • Polish alternatives (formal/casual/technical)

Week 3-4: Experimental hooks
  • chat.system.transform: language-learning system prompt injection
  • chat.messages.transform: inline translation
  • Conditional: only if hooks are stable

Week 4-6: Community features
  • Vocabulary export (JSON/CSV)
  • Anki deck import (basic)
  • Cross-scope sync (optional)

Week 6-8: Polish + Launch
  • Performance optimization
  • Documentation + tutorials
  • Plugin store listing + marketing
```

### Key Technical Decisions Deferred to Implementation

| Decision | Deferred Because | Resolution Trigger |
|----------|-----------------|-------------------|
| LLM provider for tool execution | Depends on Synergy plugin LLM access model | Start of Phase 1 implementation |
| FSRS parameter personalization approach | Depends on review data availability | After ~1,000 reviews collected (mid-Phase 2) |
| Word complexity estimation method | Depends on LLM availability | Phase 1 vocabulary capture |
| Note partitioning strategy | Depends on actual vocabulary growth rate | If note size exceeds 1MB |
| Premium features / monetization | Not in scope for research phase | Post-MVP user research |

## 7. Open Questions & Next Steps

### Unresolved Research Questions

1. **Human-LLM interaction as valid SLA interaction**: No published research tests whether Interaction Hypothesis mechanisms (negotiation of meaning) function the same with LLM interlocutors. This is a fundamental assumption of VibeLingo's approach. **Resolution**: Monitor emerging research; conduct internal user studies.

2. **Minimum viable review session length**: No research on whether 30-second micro-reviews are effective for vocabulary retention. The spacing effect literature studies intentional study sessions, not incidental micro-doses. **Resolution**: A/B test in Phase 2; compare 5-word vs. 10-word vs. no-review conditions.

3. **Technical discourse as learning material**: SLA research primarily uses narrative or academic texts. Agent sessions produce code, technical explanations, and mixed-language discourse. Incidental learning rates for this genre are unknown. **Resolution**: Measure actual capture rates in MVP usage.

4. **Long-term engagement in work-integrated learning**: Only LingoQ provides >3-week data. No multi-month or multi-year studies of incidental, work-integrated language learning. **Resolution**: VibeLingo itself becomes the data source through anonymized, opt-in engagement metrics.

5. **Experimental hook stability**: `chat.messages.transform` and `chat.system.transform` are marked experimental. Core architecture doesn't depend on them, but Phase 3 features do. **Resolution**: Monitor Synergy changelogs; implement graceful degradation if hooks change.

### Immediate Next Steps (Post-Research)

1. **Create Synergy plugin scaffold**: `package.json`, `plugin.json` manifest, `src/index.ts`
2. **Implement `lingo_help` MVP**: First end-to-end tool, validates the architecture
3. **Test Agent tool invocation**: Does the Synergy agent reliably call plugin tools?
4. **Begin Phase 1 implementation**: Follow the MVP roadmap above

### Research Artifacts (This Project)

27 source notes, 10 SLA concept notes, 6 competitive analyses, 6 platform analyses, 10 integration design notes, 4 persistence models, 4 synthesis notes. Total: ~67 research documents. All in `research/`.

## Sources

- SLA teaching strategies: `research/80_synthesis/literature-summaries/2026-07-07-sla-teaching-strategies.md`
- Platform feasibility: `research/80_synthesis/integration-summaries/2026-07-07-platform-feasibility.md`
- Competitive analysis: `research/80_synthesis/integration-summaries/2026-07-07-competitive-analysis.md`
- Interaction design principles: `research/40_integration-patterns/interaction-design-principles.md`
- Vocabulary data model: `research/40_integration-patterns/progress-tracking/vocabulary-data-model.md`
- Data lifecycle: `research/40_integration-patterns/progress-tracking/data-lifecycle.md`
- Design preferences: `research/00_index/design-preferences.md`
- Research map: `research/00_index/research-map.md`

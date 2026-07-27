# Research Map

Last updated: 2026-07-27

## Overview

This map shows what we know, what we're investigating, and where the evidence lives. Update it whenever a new source significantly changes the landscape.

## Research Areas

### 1. Language Learning Science

| Sub-area | Status | Key Notes |
|---|---|---|
| Comprehensible Input (Krashen) | ✅ Complete | CI is necessary but not sufficient. Affordance model > i+1 model. |
| Output Hypothesis (Swain) | ✅ Complete | User writing prompts = valid output practice. Three functions activate. |
| Interaction Hypothesis (Long) | ✅ Complete | Strong meta-analytic support; CMC text modality validated. Human-LLM untested. |
| Noticing Hypothesis (Schmidt) | ✅ Complete | Weak claim (conscious attention helps) accepted. "Show me why" justified. |
| Corrective Feedback types | ✅ Complete | Prompts (d=0.83) > recasts (d=0.53). Metalinguistic feedback optimal for text. |
| Corrective Feedback timing | ✅ Complete | Dual-mode: immediate during composition, deferred during task work. |
| Spaced Repetition / Retrieval Practice | ✅ Complete | FSRS recommended. 20-30% fewer reviews than SM-2. Cold start: ~1,000 reviews. |
| Motivation / Self-Determination Theory | ✅ Complete | Incidental framing = integrated motivation. No gamification needed. Autonomy is key. |
| Incidental vs Intentional Vocabulary Learning | ✅ Complete | 9-18% per session. 10-15 encounters needed. Capture from output > input. |
| LLM/Chatbot Language Learning | ✅ Complete | Affective benefits confirmed. LingoQ validates work-integrated approach. Grammar-controlled LLM output feasible. |

### 2. Synergy Platform

| Sub-area | Status | Key Notes |
|---|---|---|
| Plugin manifest / lifecycle | 🔄 Revalidated | Plugin API 3 uses flat contributions, generated manifests, capability-gated Host Services, and trusted UI. The 2026-07-07 source map is historical. |
| Tool registration & invocation | ✅ Complete | tool() + ToolContext. Resident/group/search/internal exposure. Subagent task() from within tools. |
| Agent / subagent interaction | 🔄 Revalidated | Plugins can register Agents and use bounded Sessionless `agent.call` from approved executable contributions. |
| Memory system (write, search, recall) | ✅ Complete | library.memory.search.before/.after hooks. Category + recallMode. User prefs store. |
| Notes system | ✅ Complete | 6 hooks (create/update/search .before/.after). Structured MD notes. Word book storage. |
| Agenda / scheduling | ✅ Complete | 3 hooks (run.before/.after/error). Full CRUD SDK. Review scheduling + context-aware skip. |
| Composer interaction surfaces | ✅ Revalidated | Web Composer now exposes settled drafts, suffix completion, decorations, revision-safe edits, and normal-message preflight. See `research/20_synergy-platform/source-map/2026-07-26-plugin-interaction-hooks.md`. |
| Post-submit and message surfaces | ✅ Revalidated | `session.user-message.after` observes ordinary persisted user messages asynchronously; message slots can attach conditional plugin-owned UI. |
| Selection surfaces | ✅ Revalidated | Settled non-sensitive selections and text actions cover Composer, conversation DOM, Notes, Monaco source, and Terminal. Result presentation remains open. |
| Permission model | 🔄 Revalidated | Composer, selection, Session, Agent-call, and host-action capabilities are separately approved; write/intercept/Agent-call permissions carry a higher trust burden. |

### 3. User Workflows

| Sub-area | Status | Key Notes |
|---|---|---|
| Vibe coding sessions | Not started | Design preferences captured |
| Vibe research sessions | Not started | |
| Vibe writing sessions | Not started | |
| Daily agent Q&A | Not started | |

### 4. Integration Patterns

| Sub-area | Status | Key Notes |
|---|---|---|
| Interaction design principles | ✅ Complete | 4 golden rules: In-Flow, User Leads, Teach Through Use, Remember Everything. |
| Inline input assistance | 🔄 Redesign proposed | Move from `lingo_help` as a required chat turn to high-confidence Composer completion plus an explicit draft action. |
| Expression polish | 🔄 Redesign proposed | Separate communication-risk preflight from learning-oriented post-send reflection. |
| Comprehension support | 🔄 Redesign proposed | Start from exact selected text; validate a result surface before choosing a permanent UI. |
| Prompt-first interaction model | ✅ Accepted and implemented | Inject a work-first correction contract into the primary Agent, then extract learner patterns asynchronously. V0.2 adds an explicit multilingual profile, per-target namespace, and trusted settings experience. See `research/70_decisions/adr/2026-07-26-prompt-first-language-coaching.md` and `research/70_decisions/adr/2026-07-27-multilingual-profile-and-trusted-settings.md`. |
| Composer-native interaction model | Deferred experiment | Completion, decorations, preflight, and selection UI remain available if prompt-only coaching fails specific interaction needs. See `research/80_synthesis/integration-summaries/2026-07-26-composer-native-redesign.md`. |
| Vocabulary capture & review | ✅ Complete | session.turn.after → extract → score → prioritize → write. FSRS-scheduled micro-reviews. Context-aware skip. |
| Progress tracking | ✅ Complete | Word book data model: D/S/R FSRS state + encounters + context. Error pattern tracking. |
| Privacy & consent | ✅ Complete | Extract, don't store. Conversation NEVER persisted. User-owned data in Synergy scope. |

### 5. Product Strategy

| Sub-area | Status | Key Notes |
|---|---|---|
| Competitive landscape | ✅ Complete | 6 analyses: Duolingo, Anki, Grammarly, LanguageTool, LingQ + 4 adjacent. Unique position: agent-native, work-as-learning. |
| Learner personas | 🔄 Expanded | Chinese→English remains the first QA path; v0.2 supports explicit support/target BCP-47 profiles and three self-reported levels. |
| MVP definition | ✅ Implemented | Compact system-context coaching + async pattern extraction + minimal per-target learner memory + trusted first-run settings. Advanced Composer UI remains deferred. |
| Success metrics | ✅ Complete | Retention ≥70% with review, ≥60% polish acceptance, ≥1 tool use per 3 sessions. Warning signals defined. |

## Evidence Bank Summary

27 papers + 2 web SLA sources captured.
10 SLA concept notes.
6 competitive analyses in `research/50_product-strategy/competitive-landscape/`
4 synthesis notes: SLA strategies, Platform feasibility, Competitive analysis, Product plan
5 platform analysis notes in `research/20_synergy-platform/`
10 integration design notes in `research/40_integration-patterns/`
4 persistence models in `research/40_integration-patterns/progress-tracking/`
**Total: ~67 research documents across all phases.**

Full file listing: see `research/`

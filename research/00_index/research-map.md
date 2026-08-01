# Research Map

Last updated: 2026-08-01

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
| Spaced Repetition / Retrieval Practice | ✅ Complete | Retrieval and spacing are supported; v0.3 uses a transparent interval ladder during cold start and defers FSRS until real review histories exist. |
| Motivation / Self-Determination Theory | ✅ Complete | Incidental framing = integrated motivation. No gamification needed. Autonomy is key. |
| Incidental vs Intentional Vocabulary Learning | ✅ Complete | 9-18% per session. 10-15 encounters needed. Capture from output > input. |
| LLM/Chatbot Language Learning | ✅ Complete | Affective benefits confirmed. LingoQ validates work-integrated approach. Grammar-controlled LLM output feasible. |

### 2. Synergy Platform

| Sub-area | Status | Key Notes |
|---|---|---|
| Plugin manifest / lifecycle | ✅ Revalidated | Plugin API 4 is a stable family: plugins declare a Synergy semver compatibility range, use flat kind-qualified contributions, generated manifests, capability-gated Host Services, and trusted UI. The runtime protocol is host-owned rather than a plugin compatibility contract. |
| Tool registration & invocation | ✅ Complete | tool() + ToolContext. Resident/group/search/internal exposure. Subagent task() from within tools. |
| Agent / subagent interaction | ✅ Revalidated | Plugins can register hidden Agents, await bounded `agent.call`, or start memory-only bounded work with `agent.start`; directed completion arrives through `agent.call.after` without a Session/Cortex record. |
| Memory / Notes / Agenda | Historical candidate | Available hooks do not make these the correct v0.3 business-data path. VibeLingo uses plugin SQLite and an explicit due queue; no automatic Agenda review. |
| Composer interaction surfaces | ✅ Revalidated | Web Composer now exposes settled drafts, suffix completion, decorations, revision-safe edits, and normal-message preflight. See `research/20_synergy-platform/source-map/2026-07-26-plugin-interaction-hooks.md`. |
| Post-submit and message surfaces | ✅ Revalidated | `session.user-message.after` observes ordinary persisted user messages; a plugin-owned Tool renderer can show the exact foreground correction and refresh from typed operations/events. |
| Selection surfaces | ✅ Revalidated | Immutable non-sensitive selection snapshots and additive text actions cover document DOM, inputs/textareas, Monaco, and Terminal. Synergy owns grouped context menus and accessible result popovers; Browser iframes remain excluded. |
| Workload model roles | ✅ Revalidated | Bounded Agent calls may request only an approved public Synergy role; the host resolves its fallback chain and never accepts a concrete provider/model ID. |
| Permission model | 🔄 Revalidated | Composer, selection, Session, Agent-call, and host-action capabilities are separately approved; write/intercept/Agent-call permissions carry a higher trust burden. |

### 3. User Workflows

| Sub-area | Status | Key Notes |
|---|---|---|
| Vibe coding sessions | Not started | Design preferences captured |
| Vibe research sessions | Not started | |
| Vibe writing sessions | Not started | |
| Daily agent Q&A | 🔄 Baseline captured | A 30-day local observation found a 40-message active-day median and 3-message Session median after excluding internal automation. Target-language attempt and evidence-yield rates remain open. |

### 4. Integration Patterns

| Sub-area | Status | Key Notes |
|---|---|---|
| Interaction design principles | ✅ Complete | 4 golden rules: In-Flow, User Leads, Teach Through Use, Remember Everything. |
| Inline input assistance | 🔄 Redesign proposed | Move from `lingo_help` as a required chat turn to high-confidence Composer completion plus an explicit draft action. |
| Expression polish | 🔄 Redesign proposed | Separate communication-risk preflight from learning-oriented post-send reflection. |
| Comprehension support | 🔄 Redesign proposed | Start from exact selected text; validate a result surface before choosing a permanent UI. |
| Prompt-first interaction model | ✅ Accepted and implemented | Prompt V4 requires an owned correction Tool as the first visible action. The saved card is authoritative; asynchronous metadata cannot rewrite it. Only active practicing patterns return to the prompt. |
| Composer-native interaction model | Deferred experiment | Completion, decorations, preflight, and selection UI remain available if prompt-only coaching fails specific interaction needs. See `research/80_synthesis/integration-summaries/2026-07-26-composer-native-redesign.md`. |
| Pattern learning & review | ✅ Implemented | Candidate/practicing/verified lifecycle, manual due queue, active recall, hints, repair, transfer, deterministic intervals, and resumable UI; no automatic invitation. |
| Progress tracking | ✅ Implemented and audited | The sidebar workspace renders evidence-backed attempts, curves, journey records, patterns, reviews, filters, and pagination. Explicit progress queries also use a compact trusted conversation card instead of exposing raw diagnostic output; no score or inferred level. See `research/80_synthesis/product-briefs/2026-07-28-v04-frontend-capability-and-quality-audit.md`. |
| Sparse-evidence parameter strategy | ✅ Accepted and implemented | V0.6 keeps visible practice activity separate from foreground corrections and accepted patterns, preserves `0.85`/`0.90` thresholds, and adds no tentative tier. See the sparse-data and foreground-authority ADRs. |
| Selected-text translation | ✅ Accepted and implemented | V0.7 uses a host-composed text action, adaptive bidirectional translation, validated artifact caching, bounded history, and workload role settings. Translation remains assistive and never becomes independent learning evidence. |
| Privacy & consent | ✅ Complete | Extract, don't store. Conversation NEVER persisted. User-owned data in Synergy scope. |

### 5. Product Strategy

| Sub-area | Status | Key Notes |
|---|---|---|
| Competitive landscape | ✅ Complete | 6 analyses: Duolingo, Anki, Grammarly, LanguageTool, LingQ + 4 adjacent. Unique position: agent-native, work-as-learning. |
| Learner personas | 🔄 Expanded | Chinese→English remains the first QA path; v0.2 supports explicit support/target BCP-47 profiles and three self-reported levels. |
| MVP definition | ✅ Implemented | Compact coaching + async evidence + multilingual profile + manual review + sidebar learning workspace. Composer interventions remain deferred. |
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

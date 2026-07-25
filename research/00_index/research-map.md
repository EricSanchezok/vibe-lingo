# Research Map

Last updated: 2026-07-07 (5/6 phases complete; persistence design phase done)

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
| Plugin manifest / lifecycle | ✅ Complete | init(ctx)→{hooks}. 28 hooks, 10 categories. PluginDescriptor/PluginInput/PluginHooks mapped. |
| Tool registration & invocation | ✅ Complete | tool() + ToolContext. Resident/group/search/internal exposure. Subagent task() from within tools. |
| Agent / subagent interaction | ✅ Complete | Plugins can register custom agents and skills. Tools called BY agent, not BY plugin. |
| Memory system (write, search, recall) | ✅ Complete | library.memory.search.before/.after hooks. Category + recallMode. User prefs store. |
| Notes system | ✅ Complete | 6 hooks (create/update/search .before/.after). Structured MD notes. Word book storage. |
| Agenda / scheduling | ✅ Complete | 3 hooks (run.before/.after/error). Full CRUD SDK. Review scheduling + context-aware skip. |
| Conversation surfaces (web, Feishu, etc.) | ✅ Complete | Hooks transparent across surfaces. Web app has rich UI (panels/slots/settings). Feishu text-only. |
| Permission model | ✅ Complete | data.session:read required. trust tier: trusted-import. User approval at install/update. |

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
| Inline input assistance | ✅ Complete | lingo_help tool: multi-expression + structure notes. Output Hypothesis + Involvement Load. |
| Expression polish | ✅ Complete | lingo_polish tool: progressive disclosure (hint→correction→explanation→alternatives). Prompts > recasts. |
| Comprehension support | ✅ Complete | lingo_explain tool: surgical term-level explanation. Comprehensible Input + Noticing. |
| Vocabulary capture & review | ✅ Complete | session.turn.after → extract → score → prioritize → write. FSRS-scheduled micro-reviews. Context-aware skip. |
| Progress tracking | ✅ Complete | Word book data model: D/S/R FSRS state + encounters + context. Error pattern tracking. |
| Privacy & consent | ✅ Complete | Extract, don't store. Conversation NEVER persisted. User-owned data in Synergy scope. |

### 5. Product Strategy

| Sub-area | Status | Key Notes |
|---|---|---|
| Competitive landscape | ✅ Complete | 6 analyses: Duolingo, Anki, Grammarly, LanguageTool, LingQ + 4 adjacent. Unique position: agent-native, work-as-learning. |
| Learner personas | ✅ Complete | Primary: Synergy users A2-B2, Chinese→English initial focus |
| MVP definition | ✅ Complete | 3 tools (help/polish/explain) + auto capture + word book. 4-6 week build. |
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

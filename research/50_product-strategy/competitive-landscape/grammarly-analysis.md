# Grammarly Analysis

## Overview

- **Product**: Grammarly
- **Category**: AI writing assistant
- **Company**: Grammarly, Inc. (private, $13B valuation at peak)
- **Date analyzed**: 2026-07-07
- **Key metrics**: 30M+ daily active users (company claim), 50K+ professional teams

## Core Functionality

Grammarly is a **real-time writing assistant** that operates across multiple surfaces:

1. **Grammar & spelling**: Detects and corrects grammatical errors, typos, punctuation mistakes
2. **Clarity**: Identifies wordy sentences, passive voice overuse, unclear antecedents
3. **Tone detection**: Analyzes the emotional tone of text (formal, confident, friendly, etc.)
4. **Engagement suggestions**: Suggests vocabulary alternatives for more compelling writing
5. **Plagiarism detection**: Premium feature comparing text against billions of web pages and academic databases
6. **Generative AI** (since 2023): Full-text rewriting, "Improve It," "Make It More Professional," custom prompts
7. **Style guide compliance**: Enterprise features for brand voice and terminology consistency

## Integration / Workflow Model

Grammarly's defining feature is **ubiquitous integration**:

- **Browser extension**: Works on Gmail, Google Docs, LinkedIn, Twitter, Slack, Jira, Notion
- **Desktop app**: System-wide writing assistance on macOS/Windows
- **Mobile keyboard**: iOS/Android keyboard integration
- **Office add-in**: Microsoft Word, Outlook
- **API/SDK**: For third-party apps to embed Grammarly
- **Grammarly Editor**: Standalone web/desktop app for long-form writing

**Workflow model**: The user writes normally in their existing tools → Grammarly underlines issues inline → user clicks to see suggestion and optionally accept. Grammarly is always present but mostly invisible until it detects an issue.

## Feedback Approach

Grammarly's correction UX is the gold standard for writing assistance:

1. **Inline underlines**: Red (critical grammar), blue (clarity), purple (tone), green (engagement) — color-coded, minimal intrusion
2. **One-click fix**: Click suggestion → corrected text replaces original. Instant.
3. **Brief explanation**: "Incorrect verb form. The present continuous tense is usually not used with stative verbs." — a short sentence, not a lesson
4. **Alternative suggestions**: Multiple options for tone, formality, word choice
5. **Overall score**: Composite score with breakdown by category
6. **Weekly insights**: Email reports with writing stats

## Strengths

- **Seamless workflow integration**: Works everywhere. The user doesn't "open Grammarly" — it's just there.
- **High trust**: Corrections are usually accurate (not always). Premium tier significantly improves accuracy.
- **Minimal cognitive load**: One-click fixes. No learning required. No context switching.
- **Multi-dimensional analysis**: Grammar + clarity + tone + engagement, not just spell-check
- **Professional identity**: "Using Grammarly" signals competence. Strong B2B/enterprise positioning.

## Weaknesses & Failure Modes

- **Doesn't teach — just fixes**: The biggest gap for language learning. Grammarly corrects errors but doesn't explain WHY in depth. Users may become dependent on the tool without improving their underlying skills. "Grammarly dependency" is a recognized phenomenon.
- **False positives on creative/technical writing**: Suggestions optimized for standard business English fail on: code comments, technical documentation, creative prose, casual conversation, dialect/informal speech
- **Privacy concerns** (historic): All text processed on Grammarly servers. Keyboard monitoring. Some enterprises ban Grammarly for security reasons.
- **Premium cost**: Free tier is limited (basic grammar + spelling only). Full features require $12-30/mo.
- **Over-standardization**: Encourages homogeneous, corporate writing style. Kills voice and personality.
- **L1-native bias**: Optimized for native English speakers polishing writing. Not designed for L2 learners. Explanations assume native-level metalinguistic knowledge.
- **Limited language support**: English only (with limited beta support for other languages).

## Key Lessons for VibeLingo

### What to Copy

- **Color-coded inline suggestions**: Grammarly's red/blue/purple/green system is intuitive. VibeLingo's Polish should visually distinguish: grammar error, style improvement, vocabulary alternative.
- **One-click application**: Corrections should be instantly applicable. Zero friction.
- **Brief explanations with depth available**: Default: one-line explanation. Expandable: full grammar/stylistic note with examples.
- **Workflow-level integration**: Grammarly works at the system level, not the app level. VibeLingo should work across ALL agent sessions.

### What to Avoid

- **Fix-without-teaching**: Grammarly's biggest failure for language learning. VibeLingo MUST explain why — this is the user's explicit preference and is supported by SLA research (metalinguistic feedback > recasts).
- **L1-native bias**: VibeLingo's user is an L2 learner. Explanations must be appropriate to proficiency level.
- **Over-standardization**: Should offer alternatives but RESPECT the user's voice.
- **Always-on correction**: VibeLingo should be opt-in — user asks for Polish, not plugin marking errors unprompted.
- **Server-side processing**: VibeLingo should process locally within Synergy — no external API calls.

### The Fundamental Difference

Grammarly is a **correction tool for native writers**. It fixes errors fast, assuming the user knows the underlying rules. VibeLingo is a **learning tool embedded in workflow**. Every correction is a learning moment. The user doesn't want to hide their errors — they want to understand and improve.

## Sources

- Grammarly official: https://www.grammarly.com
- SLA corrective feedback research: `research/10_learning-science/feedback-and-correction/corrective-feedback-types.md`

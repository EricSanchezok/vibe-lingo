# Anki Analysis

## Overview

- **Product**: Anki (open-source), AnkiWeb, AnkiMobile ($24.99 iOS)
- **Category**: Spaced repetition flashcard system
- **Creator**: Damien Elmes (desktop), community-maintained
- **Date analyzed**: 2026-07-07
- **Algorithm**: SM-2 (legacy default) → FSRS (default since v23.10, 2023)

## Core Concept

Anki is a **general-purpose spaced repetition system** (not language-specific). Core loop:

1. **Create or download a deck** of digital flashcards (front/back)
2. **Review cards daily**: Anki shows front → user recalls answer → rate difficulty (Again/Hard/Good/Easy)
3. **Algorithm schedules next review** based on performance (SM-2 or FSRS)
4. **Cards age gracefully**: Well-known cards appear months apart; difficult/new cards appear frequently

Anki's philosophy: **active recall + spaced repetition = long-term memory.** It's a pure implementation of the spacing effect, with no gamification, no curriculum, no pedagogy — just efficient memory scheduling.

## Algorithm

### SM-2 (SuperMemo 2)
- Two parameters: **E-Factor** (item difficulty, 1.3-2.5) and **interval** (days between reviews)
- E-Factor increases on "Good/Easy" responses, decreases on "Again"
- Interval: next = current × E-Factor (for successful reviews), reset to 1 day on failure
- No user-level personalization — same algorithm for everyone

### FSRS (Free Spaced Repetition Scheduler, default since v23.10)
- Three-parameter model: **Difficulty (D)**, **Stability (S)**, **Retrievability (R)**
- 17 trainable parameters personalized to each user's review history
- 20-30% fewer reviews than SM-2 for equal retention
- User sets **desired retention** (0.80-0.95) — algorithm schedules to maintain it
- Open-source (MIT), Python/Rust/TypeScript implementations
- See also: `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`

## Strengths

- **Proven effectiveness**: The spacing effect is one of the most robust findings in cognitive psychology. FSRS adds algorithmic sophistication.
- **Complete user control**: Every parameter adjustable. Power users love the configurability.
- **Massive shared deck ecosystem**: Community-created decks for virtually every language, subject, and exam. ~200M+ shared reviews.
- **Cross-platform**: Desktop (free), web (free), iOS ($24.99 one-time), Android (free, AnkiDroid)
- **Extensible**: Thousands of add-ons. Custom card templates, audio, images, LaTeX.
- **Privacy-first**: Data stored locally. AnkiWeb sync is optional. No ads, no tracking.
- **Long-term retention focus**: Unlike apps that optimize for daily engagement, Anki optimizes for decade-scale memory.

## Weaknesses & Failure Modes

- **Brutal learning curve**: The UX is unfriendly. Default settings are suboptimal. New users are overwhelmed.
- **Card creation overhead**: Making good cards is hard. Bad cards = wasted reviews. Card quality determines outcomes.
- **Review burden**: Anki demands daily commitment. Miss a few days = pile of "due" cards = anxiety → abandonment.
- **Isolated vocabulary**: Cards teach words in isolation (no context). "Know the card" ≠ "know the word in real use."
- **No output practice**: Pure recognition/recall. No production in authentic contexts.
- **No adaptive content discovery**: You review what's in the deck. Nothing new enters automatically.
- **Ease hell**: SM-2's E-Factor can trap cards in a zone where they're reviewed too frequently and can never escape (FSRS largely fixes this).
- **Motivation desert**: No engagement hooks. Pure discipline required. Very high abandonment rate among casual users.

## User Retention

- **Bimodal user base**: Power users (consistent multi-year streaks) and dropouts (quit within weeks)
- Anki doesn't publish official retention data, but community surveys suggest the majority of users stop within 3 months
- Key retention factors: having a clear goal (exam, language certification), investing time in initial setup, finding good shared decks
- The iOS paid app ($24.99) filters for committed users — retention is notably higher

## Key Lessons for VibeLingo

### What to Copy

- **FSRS as the review engine**: The algorithm is proven, open-source, and computationally lightweight. VibeLingo should implement FSRS, not reinvent spaced repetition.
- **Desired retention as a user-controlled lever**: Let the user choose retention level (0.80 for light load, 0.90 for committed, 0.95 for hardcore). Transparent tradeoff.
- **User-owned data**: Anki's local-first approach builds trust. VibeLingo's vocabulary data should live in the user's own Synergy scope, not on a third-party server.
- **Extensibility mindset**: Plugin architecture that allows community extensions (custom review formats, integrations).

### What to Avoid

- **Manual card creation**: Anki's biggest failure mode is requiring users to make their own cards. VibeLingo must automatically capture vocabulary from conversation. Zero card-creation overhead.
- **Review burden anxiety**: The "due pile" is a major source of Anki anxiety. VibeLingo should cap daily reviews (max 5-10 words/day), let un-reviewed words slide gracefully, and use session-boundary reviews — not "you MUST review NOW."
- **Isolated vocabulary without context**: Anki cards are two-sided (front/back). VibeLingo's review should present words IN their original agent-session context, not in isolation. Context-enhanced recall is both more effective and more motivating.
- **Brutalist UX**: Anki's UX is a cautionary tale. VibeLingo must have near-zero UI — most interactions happen through agent tools, not a separate interface.
- **Ease hell equivalent**: Ensure the review system doesn't trap words in a feedback loop. FSRS largely solves this; validate with real user data.
- **No discovery of new content**: Anki decks are static. VibeLingo continuously discovers new vocabulary from ongoing conversations.

### The Fundamental Difference

Anki is **deliberate memory practice**. Users must: choose what to learn, make cards, review daily. VibeLingo is **automatic memory capture + scheduled review**. The user just works; the plugin captures, schedules, and prompts at natural boundaries. Anki requires discipline; VibeLingo requires installation.

## Sources

- Anki official: https://apps.ankiweb.net
- FSRS documentation: https://github.com/open-spaced-repetition/fsrs4anki
- FSRS source note: `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`
- Spacing effect research: `research/60_evidence-bank/web/2026-07-07-cepeda-spacing-meta-analysis.md`
- SRS concept note: `research/10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md`

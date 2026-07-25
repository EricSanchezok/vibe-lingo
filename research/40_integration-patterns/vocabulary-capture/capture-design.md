# Vocabulary Capture Design

## User Intent

"I don't want to manually maintain a word book. I want the plugin to automatically remember words I encounter during agent conversations, so I can review them later."

This is the persistence cornerstone: vocabulary learned during agent sessions must not evaporate. The user explicitly asked for a "单词本" (word book) that builds itself. Zero manual effort required.

## Behavior

**Automatic, passive, zero user action**. The plugin silently captures vocabulary from every completed conversation turn through the `session.turn.after` hook. The user never sees the capture happening — only its effects (a growing word book, well-timed review prompts).

## Capture Pipeline

```
session.turn.after fires
         │
         ▼
┌──────────────────┐
│ 1. Extract Text  │  Get user message + agent response
│    from Turn     │  from session.turn.after input
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Tokenize &    │  Split into words/lemmas
│    Normalize     │  Remove stopwords, code blocks, punctuation
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Identify      │  Compare against known vocabulary list
│    Candidates    │  Filter: words NOT already known
│                  │  Filter: words appearing ≥2 times today
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Score Context │  Rate each candidate by:
│    Quality       │  • Information richness (guessable?)
│                  │  • User involvement (authored vs. read)
│                  │  • Domain frequency (appears in searches?)
│                  │  • Proficiency match (not too easy/hard)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. Prioritize    │  Sort candidates:
│                  │  1. User-authored words (highest involvement)
│                  │  2. User looked-up words (lingo_explain)
│                  │  3. Agent-response technical terms
│                  │  4. Agent-response general vocabulary
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 6. Enrich        │  For each top-N candidate:
│                  │  • L1 translation (via LLM)
│                  │  • Word complexity score (LLM estimate)
│                  │  • Concreteness score
│                  │  • Part of speech
│                  │  • Context sentence (from original message)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 7. Write to      │  Append to note: vibe-lingo-vocab-{lang}
│    Word Book     │  Initialize FSRS state: D, S, R
│                  │  Update encounter count (+1)
└────────┬─────────┘
```

## SLA Foundation

### Incidental Vocabulary Acquisition (Webb et al., 2023)
Words encountered during agent sessions are learned at 9-18% per exposure. The capture pipeline ensures these encounters are preserved and reinforced. Without capture, even the 9-18% gain fades within days.

### Involvement Load Hypothesis (Hulstijn & Laufer, 2001)
The priority system maps to involvement load:
- **User-authored words** (highest): Need (must express) + Search (looked up) + Evaluation (chose between alternatives) = maximum retention
- **User looked-up words**: Need + Search = high retention
- **Agent-response words** (lowest): Need only (must comprehend) = lower retention

### Word Complexity & Forgetting (Zaidi et al., 2020)
Complexity is the #1 predictor of forgetting rate. Each captured word gets a complexity score that seeds its initial FSRS Difficulty parameter. Complex, abstract words get closer review intervals.

### Spacing Effect (Cepeda et al., 2006)
The capture pipeline tracks **encounter count** per word. The goal: 10-15 encounters across sessions for durable learning. The FSRS scheduler uses this to determine review urgency.

## Word Book Data Model

Each vocabulary entry in the note:

```markdown
| Word | Translation | POS | Complexity | Concreteness | D | S | R | Next Review | Encounters | Context |
|------|-------------|-----|------------|--------------|---|---|---|-------------|------------|---------|
| asynchronous | 异步的 | adj | 5.2 | 3.1 | 5 | 2.5d | 0.85 | 2026-07-09 | 3 | "make the return value asynchronous" |
| concurrency | 并发 | n | 6.8 | 2.4 | 7 | 1d | 0.72 | 2026-07-08 | 2 | "race condition is a concurrency issue" |
```

### FSRS State Fields

| Field | Meaning | Initial Value | How It Changes |
|-------|---------|---------------|----------------|
| **D** (Difficulty) | Inherent word difficulty (1-10) | Seeded from complexity score | Slowly adjusts based on review performance |
| **S** (Stability) | Memory half-life (days) | 1 day | Increases on successful review; resets on failure |
| **R** (Retrievability) | Probability of recall (0-1) | 0.9 | Decays as time passes: R = e^(-Δt/S) |

### Context Storage

Each word stores ONE context sentence — the most information-rich encounter. Not all encounters (privacy, storage). The context sentence is the minimum needed for meaningful review: "Oh right, I learned this when we were fixing the async bug."

## Capture Rate-Limiting

To prevent vocabulary note bloat:

- **Max new words per session**: 20 (configurable)
- **Min encounter count before capture**: 2 (the word must appear twice in the same or recent sessions)
- **Skip words**: Common stopwords, code identifiers, email addresses, URLs
- **Daily cap**: 50 new words/day across all sessions
- **Graceful decay**: Words not reviewed in 90 days move to "archived" section

## Deduplication & Updates

When a word already exists in the word book:

1. **Increment encounter count**
2. **If new context is richer** (higher information density), update context sentence
3. **Re-evaluate complexity**: Average existing and new scores
4. **Don't reset SRS state**: The existing review schedule is preserved. Additional encounters are "free" reinforcement.

## Error Pattern Tracking

Separate from vocabulary capture, the plugin tracks recurring error patterns:

```
Error Patterns:
| Pattern | Example | Count | Last Seen | Focused Review? |
|---------|---------|-------|-----------|----------------|
| modal + -ing | "can making" → "can make" | 5 | 2026-07-07 | No |
| article omission | "I need function" → "I need a function" | 8 | 2026-07-06 | Yes (2026-07-05) |
```

Error patterns are extracted from `lingo_polish` sessions. When a pattern hits count ≥3, it triggers a "focused review" — a dedicated feedback moment during the next Polish session that specifically addresses this pattern.

This implements the SLA finding that focused feedback > unfocused (Kang, 2022).

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Session is short (1-2 turns) | Still analyze. Even 1 turn can yield vocabulary. |
| Session is extremely long (50+ turns) | Sample: analyze every Nth turn. Full analysis on session boundaries. |
| Code-heavy messages | Strip code blocks before analysis. Don't capture programming keywords as vocabulary. |
| Same word appears in many forms (run, runs, running) | Lemmatize. Store as "run (v)" with all forms noted. |
| Word is domain-specific technical jargon | Capture but flag as "technical." Lower review priority for words not in general vocabulary. |
| Language detection is uncertain | If confidence < 70%, skip this turn. Don't capture garbage. |
| User writes in L1, agent responds in L2 | Capture from agent response only. User's L1 text is not target vocabulary. |

## Platform Mapping

| Step | Synergy Mechanism |
|------|-------------------|
| Detect turn completion | `session.turn.after` hook |
| Extract text | `input.assistant` (Message) + context from `input.userMessageID` |
| Check known words | Read from Note: `vibe-lingo-vocab-{lang}` |
| Write new words | `note.update` (patch the vocabulary note) |
| Estimate complexity | LLM call within plugin (use agent/self for inference) |
| Track encounters | Increment counter in the note row |
| Store error patterns | Write to Note: `vibe-lingo-errors-{lang}` |

## Sources

- SLA: `research/10_learning-science/second-language-acquisition/incidental-vocabulary-acquisition.md`
- SLA: `research/60_evidence-bank/papers/2026-07-07-webb-incidental-meta-analysis.md`
- SLA: `research/60_evidence-bank/papers/2026-07-07-zaidi-adaptive-forgetting-curves.md`
- SLA: `research/60_evidence-bank/papers/2026-07-07-hulstijn-involvement-load.md`
- SRS: `research/10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md`
- Platform: `research/20_synergy-platform/memory-notes-agenda/storage-mapping.md`
- Platform: `research/20_synergy-platform/plugin-system/plugin-lifecycle-and-hooks.md`
- Design principles: `research/40_integration-patterns/interaction-design-principles.md`

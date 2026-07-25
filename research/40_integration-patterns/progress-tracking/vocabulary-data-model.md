# Vocabulary Data Model

## Overview

The vocabulary data model defines the schema for each word entry in the VibeLingo word book, how FSRS state evolves across reviews, and how the data is stored in Synergy Notes.

## Entry Schema

```ts
interface VocabularyEntry {
  // ── Identity ──
  lemma: string              // Base form: "implement"
  language: string            // ISO 639-1: "es", "fr", "ja", "zh"
  
  // ── Knowledge ──
  translation: string         // L1 equivalent: "实现"
  part_of_speech: string      // "verb", "noun", "adj", "adv", "other"
  complexity: number          // 1.0-10.0 (higher = harder to learn)
  concreteness: number        // 1.0-10.0 (higher = more concrete/imagable)
  
  // ── Encounters ──
  first_seen: string          // ISO date: "2026-07-07"
  last_seen: string           // ISO date
  encounter_count: number     // How many times encountered
  source: "user_authored" | "user_looked_up" | "agent_response" | "manual"
  
  // ── Best Context ──
  context_sentence: string    // The richest context where word was seen
  context_session_id: string  // Session where context was captured
  
  // ── FSRS State ──
  fsrs_difficulty: number     // D: 1.0-10.0, inherent item difficulty
  fsrs_stability: number      // S: memory half-life in days (>= 0.01)
  fsrs_retrievability: number // R: current recall probability (0-1)
  fsrs_last_review: string    // ISO date of last review
  
  // ── Review History (lightweight summary) ──
  total_reviews: number
  total_correct: number
  total_incorrect: number
  review_streak: number       // Consecutive correct reviews
  last_review_rating: "correct" | "incorrect"
  
  // ── Scheduling ──
  next_review_date: string    // ISO date, calculated by FSRS
  review_priority: number     // 0-100, for batching (higher = review sooner)
  
  // ── Lifecycle ──
  status: "active" | "learned" | "archived"
  learned_date?: string       // When moved to "learned" (optional)
  notes?: string              // User-added notes (optional)
}
```

## FSRS State Evolution

### On Word Capture (Initialization)

```ts
function initializeFSRSState(word: VocabularyEntry): void {
  // Seed Difficulty from complexity estimate
  // Complexity 1-3 → D = 2-3 (easy)
  // Complexity 4-7 → D = 4-6 (moderate)  
  // Complexity 8-10 → D = 7-9 (hard)
  word.fsrs_difficulty = mapComplexityToDifficulty(word.complexity)
  
  // Initial Stability: 1 day for new words
  word.fsrs_stability = 1.0
  
  // Initial Retrievability: assume they remember it from the capture moment
  word.fsrs_retrievability = 0.9
  
  // First review: schedule for next day
  word.next_review_date = addDays(today, 1)
  
  word.total_reviews = 0
  word.total_correct = 0
  word.total_incorrect = 0
  word.review_streak = 0
  word.review_priority = calculatePriority(word)
}
```

### On Review (Correct Answer)

```ts
function onCorrectReview(word: VocabularyEntry): void {
  word.total_reviews += 1
  word.total_correct += 1
  word.review_streak += 1
  word.last_review_rating = "correct"
  
  // FSRS Update
  // Stability: increase based on current S and rating
  // (simplified; production uses full FSRS formula with 17 params)
  const stability_increase = word.fsrs_stability * getStabilityIncreaseFactor(word.fsrs_difficulty, word.review_streak)
  word.fsrs_stability = Math.min(word.fsrs_stability + stability_increase, 365) // max 1 year
  
  // Difficulty: may decrease slightly (word is getting easier)
  word.fsrs_difficulty = Math.max(word.fsrs_difficulty - 0.2, 1.0)
  
  // Retrievability: reset to 0.9
  word.fsrs_retrievability = 0.9
  
  // Next review: based on new Stability
  word.next_review_date = addDays(today, calculateNextInterval(word.fsrs_stability))
  word.fsrs_last_review = today
  
  word.review_priority = calculatePriority(word)
}
```

### On Review (Incorrect Answer)

```ts
function onIncorrectReview(word: VocabularyEntry): void {
  word.total_reviews += 1
  word.total_incorrect += 1
  word.review_streak = 0
  word.last_review_rating = "incorrect"
  
  // Stability: decrease significantly
  word.fsrs_stability = Math.max(word.fsrs_stability * 0.3, 0.01)
  
  // Difficulty: increase (word is harder than thought)
  word.fsrs_difficulty = Math.min(word.fsrs_difficulty + 0.5, 10.0)
  
  // Reset, schedule soon
  word.fsrs_retrievability = 0.5
  word.next_review_date = addDays(today, 0.5)  // later today or tomorrow
  word.fsrs_last_review = today
  
  word.review_priority = 100  // maximum: review ASAP
}
```

### Time-Based Decay

```ts
// Called periodically (or lazily evaluated at review time)
function updateRetrievability(word: VocabularyEntry): void {
  if (!word.fsrs_last_review) return
  
  const daysSinceReview = daysBetween(word.fsrs_last_review, today)
  // Exponential decay: R = e^(-Δt / S)
  word.fsrs_retrievability = Math.exp(-daysSinceReview / word.fsrs_stability)
  
  word.review_priority = calculatePriority(word)
}

function calculatePriority(word: VocabularyEntry): number {
  // Priority = how urgently word needs review
  // Higher retrieval = lower priority (they still remember it)
  // Higher complexity = slightly higher priority
  const urgency = (1 - word.fsrs_retrievability) * 100
  const complexityBonus = (word.fsrs_difficulty / 10) * 20
  return Math.min(Math.round(urgency + complexityBonus), 100)
}
```

### Status Transitions

```
capture ──→ active ──→ learned
              │  ↑
              │  └── (re-encountered after archive, ↑interest)
              │
              └──→ archived (90 days no review + not encountered)
                    └──→ deleted (user-initiated)
```

```ts
function checkStatusTransition(word: VocabularyEntry): void {
  // Active → Learned
  if (word.status === "active" && word.fsrs_stability >= 90) {
    word.status = "learned"
    word.learned_date = today
  }
  
  // Active → Archived
  if (word.status === "active" && 
      daysBetween(word.last_seen, today) > 90 &&
      daysBetween(word.fsrs_last_review, today) > 90 &&
      word.total_reviews >= 5) {
    word.status = "archived"
  }
  
  // Archived → Active (re-encountered in session)
  if (word.status === "archived" && word.encounter_count > previousCount) {
    word.status = "active"
    word.review_priority = 80  // high priority: re-learn
  }
  
  // Archived → Deleted (only user-initiated, never automatic)
}
```

## Note Storage Format

Each target language gets ONE note: `vibe-lingo-vocab-{lang}`

```markdown
# VibeLingo Vocabulary — Spanish (es)

> Target: es | L1: zh | Level: intermediate | Desired retention: 0.85
> Last updated: 2026-07-07 15:30 UTC
> Schema version: 1

## Active (23 words)

| # | Word | POS | Translation | Cpx | D | S(d) | R | Next | Enc | Src | Status |
|---|------|-----|-------------|-----|---|------|---|------|-----|-----|-------|
| 1 | implementar | v | 实现 | 4.2 | 4 | 2.5 | 0.85 | 07-09 | 3 | user | active |
| 2 | asíncrono | adj | 异步的 | 5.8 | 6 | 1.0 | 0.72 | 07-08 | 2 | agent | active |
| 3 | depuración | n | 调试 | 6.1 | 6 | 1.2 | 0.78 | 07-08 | 5 | manual | active |

## Learned (15 words)

| # | Word | POS | Translation | Final S(d) | Learned | Reviews |
|---|------|-----|-------------|------------|---------|---------|
| 1 | función | n | 函数 | 90.0 | 2026-06-15 | 12 |
| 2 | variable | n | 变量 | 120.0 | 2026-06-28 | 8 |

## Archived (3 words)

| # | Word | POS | Translation | Archived | Reason |
|---|------|-----|-------------|----------|--------|
| 1 | efímero | adj | 短暂的 | 2026-05-01 | 90d no review |

---

## Context Details

<!-- Stored as a collapsible/details section -->
<details>
<summary>implementar</summary>
- Context: "necesito implementar esta función asíncrona"
- Session: ses_abc123
- First: 2026-07-05, Last: 2026-07-07
- Reviews: 1/1 correct
</details>
```

## Vocabulary Size Estimates

For capacity planning:

| Proficiency | Active Words | Learned Words | Total | Note Size (est.) |
|---|---|---|---|---|
| A1 (Beginner) | ~300 | ~100 | ~400 | ~50KB |
| A2 | ~600 | ~300 | ~900 | ~110KB |
| B1 (Intermediate) | ~1,200 | ~800 | ~2,000 | ~250KB |
| B2 | ~2,500 | ~2,000 | ~4,500 | ~550KB |
| C1 (Advanced) | ~3,000 | ~5,000 | ~8,000 | ~1MB |
| C2 | ~2,000 | ~10,000 | ~12,000 | ~1.5MB |

Note: Synergy Notes handle documents up to several MB without issue. Even C2 vocabulary is manageable in a single note. If future scaling is needed, partition by date range (e.g., `vibe-lingo-vocab-es-2026q1`, `vibe-lingo-vocab-es-2026q2`).

## Concurrency & Consistency

- **Single writer**: Only the plugin writes to vocabulary notes. No concurrent write conflicts.
- **Atomic updates**: Use `note.update` with `patch` mode. Only update changed rows, not the entire note.
- **Read-before-write**: Always read the current note before updating. Cache the parsed vocabulary list in memory (PluginCacheStore, TTL: 5 min) to avoid re-reading on every `session.turn.after`.
- **Conflict resolution**: If the note was updated externally (user edited), re-read and merge. Plugin-created vocabulary rows are append-only; user edits are preserved.

## Sources

- FSRS: `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`
- Word complexity: `research/60_evidence-bank/papers/2026-07-07-zaidi-adaptive-forgetting-curves.md`
- Optimal scheduling: `research/60_evidence-bank/papers/2026-07-07-tabibian-optimizing-human-learning.md`
- Incidental vocabulary: `research/60_evidence-bank/papers/2026-07-07-webb-incidental-meta-analysis.md`
- Storage mapping: `research/20_synergy-platform/memory-notes-agenda/storage-mapping.md`
- Capture design: `research/40_integration-patterns/vocabulary-capture/capture-design.md`

# Review State & Progress Model

## Overview

This document defines: (1) the Agenda items that schedule VibeLingo reviews, (2) the progress statistics tracked per user, and (3) the engagement metrics used to adapt plugin behavior. All scheduling leverages Synergy's Agenda system; all stats are stored in Notes and Memory.

## Agenda Item Schema

Each review session is one Agenda item:

```ts
interface ReviewAgendaItem {
  // Synergy Agenda fields
  id: string
  type: "vibe-lingo-review"
  scopeID: string
  
  // Scheduling
  scheduled_at: string       // ISO datetime
  timezone: string           // User's timezone
  
  // Review Session Definition
  language: string           // "es", "fr", etc.
  word_count: number         // How many words in this session (5-10)
  word_ids: string[]         // Lemma identifiers for words to review
  review_format: "active_recall" | "recognition" | "gap_fill" | "production"
  
  // Context Gating
  skip_if_busy: boolean      // Always true — respect user's workflow
  max_skip_count: number     // Max consecutive skips before notification (default: 5)
  skip_count: number         // Current consecutive skips
  
  // Execution State
  status: "scheduled" | "running" | "completed" | "skipped" | "cancelled"
  completed_at?: string
  result?: ReviewResult
}

interface ReviewResult {
  words_reviewed: number
  words_correct: number
  words_incorrect: number
  session_retention: number  // correct / reviewed
  duration_seconds?: number
}
```

## Agenda Creation & Management

### Creating Review Sessions

```ts
// Called after capture or after completing a review
async function scheduleNextReview(language: string): Promise<void> {
  // 1. Get all active words for this language
  const words = await readVocabularyNote(language)
  const activeWords = words.filter(w => w.status === "active")
  
  // 2. Find words due for review (next_review_date <= today)
  const dueWords = activeWords
    .filter(w => w.next_review_date <= today)
    .sort((a, b) => b.review_priority - a.review_priority) // Highest priority first
  
  if (dueWords.length === 0) return // Nothing due
  
  // 3. Batch into review session (max 10 words)
  const sessionWords = dueWords.slice(0, 10)
  
  // 4. Determine review format based on proficiency
  const level = await getProficiencyLevel(language)
  const format = getReviewFormat(level)
  
  // 5. Schedule via Agenda SDK
  const nextTime = getNextAvailableSlot()  // Next idle window
  
  await client.agenda.create({
    title: `VibeLingo Review — ${language.toUpperCase()} (${sessionWords.length} words)`,
    type: "vibe-lingo-review",
    schedule: { at: nextTime },
    metadata: {
      language,
      word_count: sessionWords.length,
      word_ids: sessionWords.map(w => w.lemma),
      review_format: format,
      skip_if_busy: true,
      max_skip_count: 5,
      skip_count: 0
    }
  })
}
```

### Context-Aware Skipping (agenda.run.before)

```ts
async function "agenda.run.before"(input, output) {
  if (input.item.type !== "vibe-lingo-review") return
  
  const metadata = input.item.metadata
  const isUserBusy = await checkUserActivity(input.scopeID)
  
  if (isUserBusy && metadata.skip_if_busy) {
    // User is in deep work — skip silently
    output.skip = true
    metadata.skip_count += 1
    
    // Reschedule: try again in 1 hour
    const nextTime = addHours(Date.now(), 1)
    await client.agenda.update({
      id: input.item.id,
      schedule: { at: nextTime },
      metadata
    })
    
    // If skipped too many times, notify user once
    if (metadata.skip_count >= metadata.max_skip_count) {
      // Subtle notification: "Your Spanish review is ready when you have a moment."
      // Do NOT nag. One notification, then the system waits for user action.
    }
    return
  }
  
  // User is available — proceed with review
  output.skip = false
}

async function checkUserActivity(scopeID: string): Promise<boolean> {
  // Check if there's an active Synergy session for this scope
  // Check if the user has sent messages recently (within 5 min)
  // Check if the agent is currently executing tools
  // → If any of these are true, user is busy
  // Implementation: query session API or check event bus state
  return false // Placeholder
}
```

### After Review Completion

```ts
async function onReviewComplete(item: AgendaItem, result: ReviewResult): Promise<void> {
  // 1. Update FSRS state for each reviewed word
  for (const wordId of item.metadata.word_ids) {
    const rating = result.word_results[wordId]  // "correct" | "incorrect"
    await updateFSRSState(wordId, rating)
  }
  
  // 2. Update progress stats
  await updateProgressStats(item.metadata.language, result)
  
  // 3. Schedule next review
  await scheduleNextReview(item.metadata.language)
  
  // 4. Mark agenda item complete
  await client.agenda.complete({ id: item.id })
}
```

## Progress Statistics

### Per-Language Stats (in vocabulary note metadata)

```yaml
# In vibe-lingo-vocab-es note front matter:
language: es
stats:
  total_words_captured: 342
  active_words: 23
  learned_words: 15
  archived_words: 3
  
  total_reviews: 187
  total_correct: 152
  total_incorrect: 35
  overall_retention: 0.813  # 81.3%
  
  sessions_with_capture: 47
  total_encounters: 1,247
  avg_encounters_per_word: 3.6
  
  review_compliance: 0.72  # 72% of scheduled reviews completed
  
  # Time-based
  first_session: 2026-05-15
  last_session: 2026-07-07
  active_days: 38
  streak_current: 5  # consecutive days with ≥1 review
  streak_best: 12
  
  # Proficiency trajectory
  estimated_level: B1
  level_confidence: 0.75
  level_history:
    - { date: 2026-05-15, level: A2, confidence: 0.8 }
    - { date: 2026-06-20, level: B1, confidence: 0.65 }
    - { date: 2026-07-07, level: B1, confidence: 0.75 }
```

### Engagement Metrics

```ts
interface EngagementMetrics {
  // Per-session averages (rolling 30-day window)
  sessions_per_week: number
  messages_per_session: number
  help_requests_per_session: number    // lingo_help invocations
  polish_requests_per_session: number  // lingo_polish invocations
  explain_requests_per_session: number // lingo_explain invocations
  
  // Tool usage trends
  help_request_trend: "increasing" | "stable" | "decreasing"
  polish_request_trend: "increasing" | "stable" | "decreasing"
  
  // Learning signals
  words_captured_per_session: number
  error_rate_trend: "improving" | "stable" | "declining"
  
  // Review behavior
  reviews_completed_per_week: number
  review_skip_rate: number            // skipped / scheduled
  avg_review_retention: number        // % correct across reviews
  
  // Health checks
  plugin_active: boolean
  days_since_last_use: number
}
```

## Session Progress Summary

At the end of each session (`session.turn.after`), capture a lightweight session summary:

```ts
interface SessionSummary {
  session_id: string
  date: string
  language: string
  
  // Activity
  words_captured: number
  help_requests: number
  polish_requests: number
  explain_requests: number
  messages_in_target_language: number
  
  // Learning
  new_errors_detected: number
  focused_reviews_triggered: number
}
```

This summary is NOT stored as a separate note (too many small notes). Instead, append to a rolling session log note: `vibe-lingo-sessions-{lang}`. Keep only last 90 days.

## Memory Storage

User preferences stored in Synergy Memory:

```ts
// Memory entries for VibeLingo
const memories = [
  {
    title: "VibeLingo target language",
    content: "Spanish (es), level: intermediate B1",
    category: "workflow",
    recallMode: "always"  // Every session knows the target language
  },
  {
    title: "VibeLingo intervention frequency",
    content: "low — help when asked, review at session boundaries",
    category: "workflow",
    recallMode: "contextual"  // Retrieved when plugin needs to decide behavior
  },
  {
    title: "VibeLingo desired retention",
    content: "0.85 — FSRS target for vocabulary review scheduling",
    category: "workflow",
    recallMode: "contextual"
  }
]
```

## Sources

- FSRS: `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`
- Agenda: `research/20_synergy-platform/memory-notes-agenda/storage-mapping.md`
- Review design: `research/40_integration-patterns/proactive-interventions/review-design.md`
- Vocabulary model: `research/40_integration-patterns/progress-tracking/vocabulary-data-model.md`
- SLA motivation: `research/10_learning-science/motivation-and-habit/l2-motivation.md`

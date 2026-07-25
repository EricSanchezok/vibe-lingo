# Review Scheduling Design

## User Intent

"I want the vocabulary I've learned to stick. Review should happen at the right time — when I'm receptive, not when I'm deep in work. And it shouldn't feel like homework."

This is the capstone of persistence: vocabulary is captured automatically, but without review it fades. The review system must balance **learning effectiveness** (spaced at optimal intervals) with **workflow respect** (never interrupt). FSRS handles the former; `agenda.run.before` context-gating handles the latter.

## Trigger

**Automatic, time-based via Synergy Agenda**. The plugin schedules review tasks using `agenda_schedule`. When the scheduled time arrives, `agenda.run.before` checks whether the user is in a receptive state. If deep in work → skip and reschedule. If at a session boundary or idle → trigger micro-review.

## Review Lifecycle

```
┌──────────────────────┐
│ FSRS calculates      │
│ next_review_date     │
│ for each word         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Plugin batches words │
│ due within next 24h   │
│ into a review session │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Plugin schedules     │
│ agenda task:         │
│ "VibeLingo Review"   │
│ at calculated time   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Agenda fires at      │
│ scheduled time       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ agenda.run.before:   │
│ Check user context   │
│                      │
│ ├─ Session active +  │
│ │  deep in tool use  │
│ │  → SKIP            │
│ │  → reschedule +1h  │
│ │                    │
│ ├─ Session idle      │
│ │  >5 min            │
│ │  → TRIGGER REVIEW  │
│ │                    │
│ └─ No active session │
│    → TRIGGER REVIEW  │
│    (as notification)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Micro-Review Session │
│                      │
│ 5-10 words            │
│ Active recall format │
│                      │
│ Each word:           │
│  "What does [async]  │
│   mean?"             │
│                      │
│ User answers:        │
│  ✓ "异步的" → correct │
│  ✗ "I don't know"    │
│                      │
│ After each:          │
│  Show context:       │
│  "You encountered    │
│   this in: 'make the │
│   return value async'"│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Update FSRS State    │
│                      │
│ Correct →            │
│   S increases        │
│   D may decrease     │
│   R resets to 0.9    │
│                      │
│ Incorrect →           │
│   S decreases/resets │
│   D may increase     │
│   R resets to 0.9    │
│                      │
│ Calculate next       │
│ review date          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Update Word Book     │
│                      │
│ Write new D, S, R,   │
│ next_review to note  │
│                      │
│ Schedule next review │
│ via Agenda           │
└──────────────────────┘
```

## SLA Foundation

### Spacing Effect (Cepeda et al., 2006)
The foundational finding: spaced review produces dramatically better long-term retention than massed practice. FSRS operationalizes this by scheduling reviews at the moment recall probability drops to the user's desired threshold.

### FSRS Algorithm (Ye et al., 2022-2025)
Three-component model:
- **Difficulty (D)**: Inherent item hardness. Adjusted based on review performance.
- **Stability (S)**: Memory half-life. Increases exponentially on successful reviews.
- **Retrievability (R)**: Current recall probability. Decays: R = e^(-Δt/S).

The user sets a **desired retention** (default: 0.85). FSRS schedules reviews to maintain that probability.

### Retrieval Practice (Roediger & Karpicke, 2006)
Testing produces better long-term retention than additional study. Every review session uses **active recall** — the user must produce the answer from memory — not passive recognition (flashcard with answer visible). This is more effortful but more effective.

### Optimal Interval (Cepeda et al., 2008)
For long-term retention (months-years), the optimal gap is 10-20% of the retention interval. FSRS automatically calculates this based on the Stability parameter.

### Word Complexity & Forgetting (Zaidi et al., 2020)
Complex words (high D) have steeper forgetting curves — they need closer review spacing. The initial D value is seeded from the LLM-based complexity estimate at capture time.

## Design Decisions

### Why Micro-Reviews (5-10 Words)?

- Anki's unlimited review pile creates anxiety. 5-10 words is completable in 30-90 seconds.
- The "minimum effective dose" principle: some review is dramatically better than no review. Perfect coverage is not required.
- Words not reviewed in a session simply slide to the next session. No "overdue" anxiety.
- The system adapts: if the user consistently completes reviews, increase to 10-15. If they skip, decrease to 3-5.

### Why Active Recall, Not Recognition?

Recognition tasks ("pick the correct translation from 4 options") are easy but ineffective for long-term memory. Active recall ("what does this word mean?") forces retrieval from memory, which strengthens the memory trace. This aligns with Roediger & Karpicke's testing effect.

### Why Context-Aware Skip, Not Forced Review?

The `agenda.run.before` hook is VibeLingo's killer feature for workflow integration. It can detect:
- **Session active + user in flow**: Skip. Reschedule +1h. Don't interrupt.
- **Session idle**: User stepped away or finished a task. Good time for review.
- **No session**: Send a subtle notification (if user enabled notifications).

Anki sends a push notification: "You have 47 cards due." This is anxiety-inducing. VibeLingo says nothing if the user is busy. The review adapts to the user's schedule, not the other way around.

### Why Binary Grading (Correct/Incorrect)?

FSRS supports multi-level grading (Again/Hard/Good/Easy) but research shows binary (correct/incorrect) is sufficient for scheduling decisions. Binary grading is:
- Faster (one click)
- Less cognitively taxing (no "how well did I know it?" deliberation)
- Sufficient for FSRS parameter updates

## Review Formats by Proficiency

### Beginner (A1-A2)
- **Meaning recall**: "What does [word] mean?" (L2 → L1)
- **Recognition**: Show 4 options (only for very new words, <3 reviews)
- **Context**: Always show original context sentence after answer

### Intermediate (B1-B2)
- **Meaning recall**: L2 → L1 (mixed with)
- **Production recall**: "How do you say [word] in [L2]?" (L1 → L2) — harder
- **Context gap-fill**: "The function was ___ (异步的)" → user fills: "asynchronous"
- **Synonym matching**: "Which word from your book means 'at the same time'?"

### Advanced (C1-C2)
- **Production recall** (default): L1 → L2, harder direction
- **Register variations**: "Give a formal and casual way to say [word]"
- **Collocation**: "What verb commonly pairs with 'decision'?" → "make a decision"
- **Error pattern review**: "You wrote 'can making' in your last session. What's the rule?"

## Minimum Viable Review Session

For MVP:
- **Format**: Active recall — "What does [word] mean?"
- **Grading**: Binary — ✓ correct / ✗ incorrect
- **Words**: 5 words per session
- **Context**: Show original context sentence after each answer
- **No**: Gamification, streaks, scores, leaderboards, progress bars

This minimal format satisfies all SLA requirements (spacing + retrieval practice + active recall) while respecting the "no gamification" constraint.

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User skips review consistently (3+ in a row) | Reduce desired retention from 0.85 to 0.75 (fewer reviews). Don't nag — the system adapts silently. |
| Word has been in review for 6+ months (plateau) | Move to "learned" section. Only re-surface if user encounters it again. |
| User adds words manually to word book | Immediate review scheduling. Same FSRS pipeline. Manually added = high involvement. |
| Multiple languages active | Separate review sessions per language. Don't mix Spanish and French words in one session. |
| Review interrupted mid-session | Save progress. Partial completion counts. Don't penalize. |
| Agent session starts during review | Pause review immediately. Save state. Resume at next idle moment. |
| No words due for review | Send no notification. Do not fabricate review tasks. Silence is the desired state for well-learned vocabulary. |

## Platform Mapping

| Step | Synergy Mechanism |
|------|-------------------|
| Calculate next review | FSRS algorithm (plugin-side computation) |
| Schedule review task | `client.agenda.create()` via SDK |
| Context check before review | `agenda.run.before` hook — read session activity indicators |
| Trigger review session | Agent calls `lingo_review` tool OR simple text prompt in session |
| Present review words | Tool output or inline message with word + answer format |
| Grade response | User input: "correct" / "don't know" → parse within tool |
| Update FSRS state | Plugin writes new D, S, R values |
| Persist state | `note.update` on the vocabulary note |
| Schedule next review | `client.agenda.create()` for the next due date |

## Sources

- SRS: `research/10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md`
- SRS: `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`
- SRS: `research/60_evidence-bank/web/2026-07-07-cepeda-spacing-meta-analysis.md`
- SRS: `research/60_evidence-bank/papers/2026-07-07-tabibian-optimizing-human-learning.md`
- Vocabulary: `research/60_evidence-bank/papers/2026-07-07-zaidi-adaptive-forgetting-curves.md`
- Platform: `research/20_synergy-platform/memory-notes-agenda/storage-mapping.md`
- Platform: `research/20_synergy-platform/plugin-system/plugin-lifecycle-and-hooks.md`
- Design principles: `research/40_integration-patterns/interaction-design-principles.md`

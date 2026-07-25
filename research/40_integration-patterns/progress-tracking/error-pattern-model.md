# Error Pattern Model

## Overview

VibeLingo tracks recurring user errors not to shame or correct incessantly, but to enable **focused feedback** — the SLA principle that targeting specific, recurring errors is more effective than unfocused correction of everything (Kang, 2022; Lyster & Ranta, 1997). When the same error pattern appears 3+ times, it triggers a "focused review moment" in the next Polish session.

## Pattern Schema

```ts
interface ErrorPattern {
  // ── Identity ──
  pattern_id: string           // Unique: "modal_infinitive_form"
  pattern_name: string         // Human-readable: "Modal verb + infinitive"
  language: string             // ISO 639-1
  category: "grammar" | "word_choice" | "spelling" | "register" | "collocation"
  
  // ── Pattern Definition ──
  description: string          // "Using -ing form after modal verbs (can making → can make)"
  rule: string                 // Teaching rule: "Modal verbs (can, must, should) are followed by base form"
  examples: ErrorExample[]
  
  // ── Statistics ──
  occurrence_count: number     // Total times detected
  first_seen: string           // ISO date
  last_seen: string            // ISO date
  sessions_with_error: number  // How many sessions where this appeared
  
  // ── Feedback ──
  focused_review_count: number // How many times we've done focused review on this
  last_focused_review: string  // ISO date of last focused review
  resolved: boolean            // User has stopped making this error
  
  // ── Priority ──
  priority: "critical" | "high" | "medium" | "low"
  // critical: meaning-impairing, >5 occurrences
  // high: recurring pattern, 3+ occurrences, unresolved
  // medium: 2-3 occurrences, not yet focused
  // low: 1-2 occurrences, watching
}
```

## Pattern Discovery

### Source 1: Polish Sessions

Every `lingo_polish` invocation is a rich source of error data:

```
User writes: "Can you making the code more faster?"
lingo_polish detects:
  • Issue 1: "making" → "make" (grammar: modal + infinitive)
  • Issue 2: "more faster" → "faster" (grammar: double comparative)
  
→ Update or create patterns:
  "modal_infinitive_form": count +1, last_seen = today
  "double_comparative": count +1, last_seen = today
```

### Source 2: Heuristic Detection in chat.message

Lightweight pattern matching in every user message:

```ts
// Regex-based detection for common error patterns
const PATTERNS = {
  modal_infinitive_form: /\b(can|must|should|will|would|could|might|may)\s+\w+ing\b/gi,
  double_comparative: /\bmore\s+\w+er\b/gi,
  article_omission: /\b(is|are|was|were|has|have|had)\s+(a|an|the)\s+\w+/gi, // Negation: missing article
  subject_verb_agreement: /\b(he|she|it)\s+\w+(?!s\b)/gi, // He/She/It without -s
}
```

Detection confidence < 70% → skip. Don't flag false positives. Better to miss a pattern than to incorrectly accuse the user of an error they didn't make.

### Source 3: Comprehension Moments

When the user runs `lingo_explain` on a word + later uses it incorrectly → potential vocabulary usage error pattern.

## Focused Feedback Trigger

```
Pattern.occurrence_count >= 3
AND 
Pattern.resolved === false
AND
(days since last_focused_review) > 7
→ TRIGGER focused review on next lingo_polish
```

### What Focused Review Looks Like

When the user runs `lingo_polish` and has a triggered pattern, the output includes a special section:

```
Polish suggestions for "Can you making the code more faster?":

▼ Correction: "Can you make the code faster?"
  • making → make (modal 'can' + base form)
  • more faster → faster (already comparative)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Focused Review: Modal Verbs

We've noticed this pattern a few times now. Quick refresher:

After modal verbs (can, must, should, will, could),
use the BASE form of the verb (not -ing, not to + verb):

✓ "Can you make the code faster?"
✗ "Can you making..."
✗ "Can you to make..."

You've gotten this right 2/5 times recently.
Keep practicing and it'll stick!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▼ Alternatives: ...
```

### Resolution

```ts
function checkResolution(pattern: ErrorPattern): void {
  // Resolved if:
  // 1. At least one focused review was done
  // 2. 30+ days since last occurrence
  // 3. User had >= 5 Polish sessions with this pattern and 0 new occurrences
  if (pattern.focused_review_count >= 1 &&
      daysBetween(pattern.last_seen, today) > 30) {
    pattern.resolved = true
    pattern.priority = "low"
  }
  
  // Re-open if pattern resurfaces
  if (pattern.resolved && pattern.occurrence_count > previousCount) {
    pattern.resolved = false
    pattern.priority = "high"
  }
}
```

## Error Pattern Note Format

One note per language: `vibe-lingo-errors-{lang}`

```markdown
# VibeLingo Error Patterns — English (en)

> Target: en | L1: zh | Last updated: 2026-07-07

## Active Patterns

### modal_infinitive_form — Modal verb + infinitive

- **Category**: grammar
- **Description**: Using -ing form after modal verbs
- **Rule**: Modal verbs (can, must, should, will) + base form
- **Count**: 7 occurrences | First: 2026-06-20 | Last: 2026-07-07
- **Sessions**: appeared in 5 sessions
- **Focused reviews**: 2 | Last: 2026-07-01
- **Priority**: high

**Examples**:
| # | Original | Corrected | Date | Session |
|---|----------|-----------|------|---------|
| 1 | "can you making" | "can you make" | 2026-07-07 | ses_abc |
| 2 | "must checking the" | "must check the" | 2026-07-05 | ses_xyz |
| 3 | "should using async" | "should use async" | 2026-07-03 | ses_def |

### double_comparative — Double comparative

- **Category**: grammar
- **Description**: Using 'more' + '-er' form together
- **Rule**: Either use '-er' OR 'more', not both
- **Count**: 3 occurrences | First: 2026-07-01 | Last: 2026-07-06
- **Sessions**: appeared in 2 sessions
- **Focused reviews**: 0
- **Priority**: high (triggered)

**Examples**: ...

## Resolved Patterns

### article_omission — Article omission

- **Resolved**: 2026-06-15
- **Count**: 12 occurrences (resolved after 3 focused reviews)

---
```

## Privacy Note

Error patterns are aggregated statistics, not raw corrections. Individual examples are stored only as the corrected form + original (both user-authored content in that session already). No identifying context beyond session ID. Error data stays in user's Synergy scope.

## Sources

- SLA: `research/10_learning-science/feedback-and-correction/corrective-feedback-types.md`
- SLA: `research/10_learning-science/feedback-and-correction/feedback-timing.md`
- SLA: `research/60_evidence-bank/papers/2026-07-07-kang-written-cf-meta-analysis.md`
- Capture: `research/40_integration-patterns/vocabulary-capture/capture-design.md`
- Polish: `research/40_integration-patterns/correction-flows/polish-design.md`

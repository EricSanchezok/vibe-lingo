# Expression Polish Design: `lingo_polish`

## User Intent

"I wrote this message in my target language, but it doesn't feel right. The grammar might be wrong, the tone might be off, or it might just sound unnatural. Help me polish it."

This is the user's second most frequent pain point: they successfully composed in L2 but lack confidence in correctness and naturalness. The plugin should improve their expression while explaining WHY — turning every correction into a learning moment.

## Trigger

**Explicit, user-initiated**. Examples:
- `@vibe-lingo polish: "Can you making the code more faster?"`
- `is this correct? "Can you making the code more faster?"`
- `@vibe-lingo polish` (applied to the immediately preceding user message)

The Agent interprets these as requests to call `lingo_polish`. If the user provides text inline, use that. Otherwise, use the most recent user message from the conversation context.

## Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User sends message in target language:                       │
│ "Can you making the code more faster?"                       │
│                                                              │
│ [chat.message hook]: detect target language, annotate        │
│ metadata (non-intrusive). No modification of message.        │
│                                                              │
│ Agent responds normally.                                     │
│                                                              │
│ User (dissatisfied with their expression):                   │
│ "@vibe-lingo polish"                                         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent: calls lingo_polish({                                  │
│   text: "Can you making the code more faster?",              │
│   context: "coding conversation about performance"           │
│ })                                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ VibeLingo Plugin (lingo_polish execute):                     │
│                                                              │
│ Step 1: Analyze text for issues                              │
│   • Grammar: "making" → should be "make" (modal verb rule)  │
│   • Word choice: "more faster" → "faster" (double comp.)    │
│   • Naturalness: ✓ otherwise natural casual tech tone         │
│                                                              │
│ Step 2: Generate feedback (Progressive Disclosure):           │
│                                                              │
│   Layer 1 — METALINGUISTIC HINT (shown first):               │
│   "Two things to check: (1) the verb after 'can',            │
│    (2) the comparison form of 'fast'."                       │
│                                                              │
│   Layer 2 — EXPLICIT CORRECTION (expandable):                │
│   → "Can you make the code faster?"                          │
│                                                              │
│   Layer 3 — EXPLANATION (expandable):                        │
│   • making → make: modal verb 'can' is followed by           │
│     the base form (not -ing)                                 │
│   • more faster → faster: 'faster' is already the            │
│     comparative form of 'fast' (don't use 'more' + -er)     │
│                                                              │
│   Layer 4 — ALTERNATIVES (expandable):                       │
│   • Casual: "Can you speed this up?"                         │
│   • Formal: "Could you optimize this for performance?"       │
│   • Technical: "Can we improve the execution time?"          │
│                                                              │
│ Step 3: Rate confidence per issue                            │
│   • Grammar correction: high confidence                      │
│   • Naturalness suggestion: medium confidence                │
│   • If confidence < threshold, flag with "⚠️ suggestion"     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent presents result. User sees:                            │
│                                                              │
│ Polish suggestions:                                          │
│                                                              │
│ Two things to check: (...)                                   │
│                                                              │
│ ▼ Correction: "Can you make the code faster?"                │
│   • making → make (modal 'can' + base form)                  │
│   • more faster → faster (already comparative)               │
│                                                              │
│ ▼ Alternatives:                                              │
│   • casual: "Can you speed this up?"                         │
│   • formal: "Could you optimize this for performance?"       │
│                                                              │
│ User can:                                                    │
│   • Apply the correction to the previous message             │
│   • Use an alternative phrasing                               │
│   • Ask for more detail on a specific error                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ [Background] session.turn.after:                             │
│ • Record error pattern: "modal + -ing" (count: Nth time)     │
│ • Flag as "recurring pattern" if seen ≥3 times               │
│ • Capture vocabulary: "optimize", "performance" if new       │
│ • Link correction to future focused review                   │
└─────────────────────────────────────────────────────────────┘
```

## SLA Foundation

### Corrective Feedback Typology (Lyster & Ranta, 1997)
The progressive disclosure design intentionally uses **metalinguistic feedback as the default**. Layer 1 shows hints; Layer 2 shows the correction; Layer 3 shows the explanation. This matches the evidence that prompts (d=0.83) outperform recasts (d=0.53) — and the user's explicit preference for "show me why."

### Written Corrective Feedback Meta-Analysis (Kang, 2022)
Written CF effects decay from g=0.62 (immediate) to g=0.46 (delayed). This means **repeated correction on the same error patterns** is essential — which is why `session.turn.after` tracks recurring errors for focused feedback.

### Feedback Timing (Lyster & Saito, 2010)
The user initiates Polish AFTER they've sent their message — this is a form of **immediate post-composition feedback**. The cognitive load of self-monitoring during composition is high; asking for polish after composing allows the user to focus on meaning first, form second.

### Schmidt's Noticing Hypothesis
The layer-by-layer progressive disclosure ensures the user sees the metalinguistic hint BEFORE the correction. This maximizes the chance of "noticing the gap" — the user actively processes what's wrong before seeing the answer.

## Design Decisions

### Why Progressive Disclosure (Not Direct Correction)?

Grammarly shows the correction immediately. That's fast but teaches nothing. VibeLingo shows the **metalinguistic hint first**, then the correction, then the explanation. This sequence maximizes learning:

1. **Hint**: "Can you spot the issue?" → forces active cognitive processing
2. **Correction**: "Here's the answer" → confirms or corrects the user's hypothesis
3. **Explanation**: "Here's why" → encodable rule for future use

The user can always jump straight to the correction (click to expand). Default behavior favors learning; power users can optimize for speed.

### Why Focused, Not Unfocused?

Don't fix everything. If the user wrote a 200-word message with 15 minor issues, dumping all 15 corrections is overwhelming and demotivating. Instead:
- **Priority 1**: Recurring pattern errors (modal + -ing, article errors, etc.)
- **Priority 2**: Meaning-impairing errors (wrong word choice that changes meaning)
- **Priority 3**: Naturalness/stylistic suggestions
- **Skip**: One-off typos, minor punctuation (unless user explicitly asks)

### Why Alternatives?

DeepL Write's UX insight: show multiple ways to say the same thing. This:
- Reduces the sense of "I was wrong" (not binary correct/incorrect)
- Teaches register flexibility (formal vs. casual vs. technical)
- Lets the user choose their voice (autonomy)

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No errors found | "This reads naturally. One optional refinement: [minor suggestion]." Never say "perfect" — there's always room. But don't invent errors. |
| Text is mostly code, little natural language | Skip non-language portions. Only analyze natural language segments. Flag: "I found X natural language issues." |
| Multiple languages in one message | Detect language per segment. Only polish the target language portion. |
| Correction confidence is low | Flag with "⚠️ Suggestion (medium confidence)." User should verify. |
| Error requires deep grammar explanation | Show brief rule. Offer "Want more examples?" for expandable detail. |
| User's expression is correct but non-standard dialect | Flag as "This is correct in [dialect]. In standard [language], you might say: ..." Don't erase dialect. |

## Interaction with chat.message Hook

The `chat.message` hook runs on every message and detects:
- Is this in the target language? → annotate metadata
- Does it contain obvious error patterns we've seen before? → tag for potential Polish offer
- Does NOT modify the message content — observation only

If the hook detects that the message has high error density (3+ grammatical issues), it could add a subtle annotation to the chat context: *"Tip: @vibe-lingo polish can help refine this."* This is a **non-intrusive nudge**, not a forced correction.

## Interface Contract

### Input
```ts
interface LingoPolishInput {
  text: string           // The text to polish
  context_hint?: string  // Conversation context
  focus?: "grammar" | "naturalness" | "vocabulary" | "all"
}
```

### Output
```ts
interface LingoPolishOutput {
  issues: Array<{
    type: "grammar" | "word_choice" | "naturalness" | "register"
    original: string
    hint: string           // Layer 1: metalinguistic hint
    correction: string     // Layer 2: corrected text
    explanation: string    // Layer 3: rule explanation
    alternatives?: string[] // Layer 4: other ways to say it
    confidence: "high" | "medium" | "low"
  }>
  polished_text: string    // Full text with all corrections applied
}
```

## Sources

- SLA: `research/10_learning-science/feedback-and-correction/corrective-feedback-types.md`
- SLA: `research/10_learning-science/feedback-and-correction/feedback-timing.md`
- SLA: `research/10_learning-science/second-language-acquisition/noticing-hypothesis.md`
- Competitive: `research/50_product-strategy/competitive-landscape/grammarly-analysis.md`
- Competitive: `research/50_product-strategy/competitive-landscape/adjacent-products.md` (DeepL Write)
- Platform: `research/20_synergy-platform/plugin-system/plugin-lifecycle-and-hooks.md`
- Design principles: `research/40_integration-patterns/interaction-design-principles.md`

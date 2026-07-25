# Comprehension Support Design: `lingo_explain`

## User Intent

"The Agent replied in English (or my target language), and I didn't fully understand part of the message. Help me understand specific terms or passages without switching to a full translator."

This is the "comprehension gap" — the user is engaged in a real conversation but hits an unknown word, technical term, or complex sentence. The plugin should provide **surgical, contextual explanations** — not wholesale translation. The goal is to keep the user in the target language while filling in gaps.

## Trigger

**Explicit, user-initiated**. Examples:
- `@vibe-lingo explain "race condition" and "mutable shared state"`
- `what does "race condition" mean here?`
- `@vibe-lingo explain: the last message` (explain the Agent's most recent response)
- `@vibe-lingo translate "mutable shared state"` (explicit translation request)

## Interaction Flow

### Case A: Explain Specific Terms

```
┌─────────────────────────────────────────────────────────────┐
│ Agent: "The issue is a race condition caused by              │
│         mutable shared state across async boundaries."       │
│                                                              │
│ User: "@vibe-lingo explain 'race condition' "                │
│       "and 'mutable shared state'"                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent: calls lingo_explain({                                 │
│   terms: ["race condition", "mutable shared state"],         │
│   context: "The issue is a race condition caused by ..."     │
│ })                                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ VibeLingo Plugin (lingo_explain execute):                    │
│                                                              │
│ For each term:                                               │
│ 1. Look up definition (technical + simple)                   │
│ 2. Provide L1 translation (if helpful)                       │
│ 3. Show in-context example                                   │
│ 4. Suggest related terms (optional)                          │
│                                                              │
│ Output:                                                      │
│                                                              │
│ race condition (竞态条件)                                     │
│   When multiple operations compete and the result            │
│   depends on timing rather than logical order.               │
│   Example: Two functions trying to update the same           │
│   variable at the same time — the final value depends        │
│   on which one finishes last.                                │
│                                                              │
│ mutable shared state (可变共享状态)                            │
│   Data that multiple parts of code can change                │
│   at the same time. "Mutable" = can be changed.              │
│   "Shared" = accessed by multiple things.                    │
│   Example: A global variable that two async functions        │
│   both read and write.                                       │
│                                                              │
│ Related: concurrency, thread safety, immutability            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ [Background] session.turn.after:                             │
│ • Flag: user looked up "race condition" — possibly new term   │
│ • If this is 2nd+ lookup within session, hint at knowledge   │
│ • Capture for vocabulary note if term appears frequently     │
└─────────────────────────────────────────────────────────────┘
```

### Case B: Explain Full Message

```
┌─────────────────────────────────────────────────────────────┐
│ Agent: [long, complex English response about architecture]   │
│                                                              │
│ User: "@vibe-lingo explain the last message"                 │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent: calls lingo_explain({                                 │
│   message_id: "msg_abc123"                                   │
│ })                                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ VibeLingo Plugin:                                            │
│                                                              │
│ 1. Retrieve the message from session context                 │
│ 2. Identify potentially challenging terms/phrases:           │
│    • Technical jargon above user's proficiency               │
│    • Idioms and phrasal verbs                                │
│    • Long, complex sentences that may cause confusion        │
│ 3. Output: term-by-term explanation (like Case A above)      │
│    PLUS overall summary in simpler language                  │
│                                                              │
│ "Summary: The problem happens because different parts        │
│  of the code try to change the same data at once."           │
└──────────────────────────────────────────────────────────────┘
```

## SLA Foundation

### Comprehensible Input (Krashen, i+1)
The Agent's response may contain vocabulary and structures slightly above the user's current level. `lingo_explain` bridges the i+1 gap — it makes the input comprehensible without simplifying it to the point of losing learning value. The user encounters the advanced language, then receives scaffolding to understand it.

### Noticing Hypothesis (Schmidt)
By explicitly looking up terms ("what does X mean?"), the user is actively NOTICING gaps in their comprehension. The plugin transforms passive non-understanding into active vocabulary acquisition.

### Involvement Load (Hulstijn & Laufer, 2001)
Looking up terms involves Need (must understand the Agent to continue working), Search (actively seeking the definition), and moderate Evaluation (connecting the definition to the current context). This is higher involvement than passive reading.

## Design Decisions

### Why Surgical, Not Wholesale Translation?

The user wants to stay in the target language. If the plugin translates everything, the user never practices comprehension. `lingo_explain` fills gaps without replacing the target-language experience.

Competitive analysis insight: Grammarly's "fix everything" model creates dependency. Duolingo's translation exercises create translation-dependent learners. VibeLingo's approach: understand in L2, with surgical L1 support only where needed.

### Why In-Context Examples?

Dictionary definitions are abstract. An in-context example ("Two functions trying to update the same variable at the same time...") connects the word to the user's actual situation. This improves both comprehension and retention.

### Why Technical Accuracy Preserved?

VibeLingo works in coding/research contexts. Simplifying "race condition" to "when things happen at the wrong time" is useless for a developer. The explanation must be technically accurate AND comprehensible. Prioritize accuracy; use L1 translation as a bridge if needed.

### Why Related Terms?

Building semantic networks improves vocabulary retention. If the user looked up "race condition," offering "concurrency" and "thread safety" as related concepts deepens understanding and may preempt the next comprehension gap.

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Term is common knowledge at user's level | "This is a standard [field] term. Here's a quick refresher: ..." Don't condescend. |
| Term has multiple meanings in different contexts | "In this context (coding), it means X. In general usage, it can also mean Y." |
| User asks for explanation of code, not language | Detect code blocks. If term is a programming construct (not English vocabulary), explain as technical concept, not language word. |
| Message contains sensitive/private information | Process only the text; never store the query beyond session cache. |
| User's proficiency makes explanation itself hard to understand | Adapt explanation vocabulary to user's proficiency level. Intermediate users get simpler English; Beginners may get L1 translation alongside. |
| Agent's response is in a third language (not user's L1 or L2) | Handle gracefully: "This message appears to be in [language]. I can explain it, but my primary support is for [user's target language]." |

## Interaction with chat.message Hook

The `chat.message` hook can pre-process incoming messages. If the user types something like "what does [word] mean?", the hook can:
- Detect it as a likely `lingo_explain` trigger
- Annotate the message context so the Agent is more likely to call the tool
- Do NOT auto-call — the Agent always decides

## Interface Contract

### Input
```ts
interface LingoExplainInput {
  terms?: string[]       // Specific terms to explain
  message_id?: string    // Or: explain the full message
  context?: string       // Surrounding text for context
}
```

### Output
```ts
interface LingoExplainOutput {
  explanations: Array<{
    term: string
    definition: string
    l1_translation?: string
    in_context_example?: string
    related_terms?: string[]
  }>
  summary?: string  // If explaining a full message
}
```

## Sources

- SLA: `research/10_learning-science/second-language-acquisition/comprehensible-input.md`
- SLA: `research/10_learning-science/second-language-acquisition/noticing-hypothesis.md`
- SLA: `research/60_evidence-bank/papers/2026-07-07-hulstijn-involvement-load.md`
- Competitive: `research/50_product-strategy/competitive-landscape/grammarly-analysis.md`
- Competitive: `research/50_product-strategy/competitive-landscape/duolingo-analysis.md`
- Platform: `research/20_synergy-platform/plugin-system/plugin-lifecycle-and-hooks.md`
- Design principles: `research/40_integration-patterns/interaction-design-principles.md`

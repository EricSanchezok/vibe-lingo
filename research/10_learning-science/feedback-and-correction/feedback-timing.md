# Corrective Feedback Timing

## Summary

The timing of corrective feedback — immediate (during the task) vs. delayed (after the task) — has significant implications for learning outcomes and user experience. In SLA research, immediate feedback is generally more effective for skill acquisition and procedural knowledge, while delayed feedback can be more effective for conceptual understanding. However, the evidence is mixed, and the right answer is highly context-dependent. For VibeLingo, the decision is fundamentally about **interruption cost vs. learning benefit**: inline feedback maximizes learning opportunity but risks disrupting the primary workflow (vibe coding, research, etc.), while delayed feedback preserves flow but may reduce learning impact.

## What We Know

### Immediate vs. Delayed: Mixed Evidence

- **Oral CF meta-analyses** show strong effects for immediate feedback (Lyster & Saito, 2010: d=0.74). Studies that isolated timing found no clear advantage for delayed over immediate oral CF.
- **Written CF**: Schenck (2020) meta-analysis found that timing interacts with grammatical feature complexity. Simpler features benefit from immediate recasts; complex features (articles, conditionals) benefit from delayed, more explicit feedback.
- **Optimal Timing in Language Learning (PMC, 2023)**: Only 3 studies concluded delayed CF was more effective than immediate, and all had internal validity issues. Most studies find immediate CF at least as effective, often more so.
- **Skill acquisition literature** (from cognitive psychology): immediate feedback benefits procedural skill learning; delayed feedback can benefit conceptual/declarative knowledge.

### The Interruption Problem

- Research on task interruption shows that interruptions during cognitively demanding tasks (like coding) significantly increase error rates and time to resume.
- The user's stated preference for "I lead, plugin supports" suggests a sensitivity to interruption.
- The Involvement Load Hypothesis (Hulstijn & Laufer, 2001) suggests that feedback timing interacts with involvement: if the user is actively searching/evaluating their language (high involvement), immediate feedback is more productive; if the user is focused on a different task (low language involvement), immediate feedback is disruptive.

### Agent-Native Considerations

- In an agent conversation, the user's "task" alternates between: (1) core work (coding, researching) and (2) language production (composing messages in the target language).
- Feedback during (2) is "in-task" from a language learning perspective; feedback during (1) is an interruption.
- The distinction between these two states is a design opportunity: VibeLingo can detect when the user is composing a message vs. reading code/agent output.

## Design Relevance

### For VibeLingo

1. **Dual-mode feedback timing**:
   - **Composition mode** (user is typing/editing in target language): Immediate, inline feedback is appropriate. The language task IS the current task. Metalinguistic hints or real-time suggestions during composition.
   - **Consumption mode** (user is reading agent output, working on code): Defer feedback. Queue corrections for end-of-session or next language-focused interaction.

2. **Session-boundary review**: At natural session boundaries (task completion, before switching context), present a brief summary of queued feedback items. This is the "delayed" channel that preserves flow while ensuring nothing is lost.

3. **Error severity tiering**:
   - **Critical errors** (meaning-impairing): Flag immediately even during consumption mode — comprehension at risk.
   - **Pattern errors** (recurring, at user's developmental level): Queue for session-boundary review.
   - **Minor/stylistic errors**: Queue for review or mark as "available for polish" without interrupting.

4. **User-controlled timing**: The user can always request immediate feedback (@vibe-lingo polish), but automatic feedback follows the dual-mode logic.

5. **Pre-composition nudges**: Before the user sends a message, offer a lightweight "Polish?" option. This is a low-interruption moment (the user is about to commit their text) where immediate feedback is welcome.

### Feedback Scheduling Across Sessions

- Schenck (2020) suggests that "timely emphasis of specific grammatical features is needed" — this means VibeLingo should track which errors recur and schedule focused feedback moments, not just correct ad-hoc.
- If an error pattern appears across multiple sessions, a dedicated feedback moment (not tied to any specific message correction) may be warranted — this is where delayed, focused feedback shines.

## Risks / Misuses

- **Immediate feedback during coding blocks flow**: A correction popup while debugging would be infuriating. Must detect task context.
- **Delayed-only feedback loses learning opportunity**: If the user only gets corrections at session end, they've already internalized the error for the entire session.
- **Queue buildup**: If feedback is only at session boundaries, long sessions accumulate large queues. Need prioritization + rate limiting.
- **Context loss**: Delayed feedback may be less meaningful — the user no longer remembers why they wrote something a certain way.
- **The "just right" Goldilocks problem**: Too soon = annoying; too late = irrelevant. The dual-mode approach mitigates but doesn't eliminate this tension.

## Supporting Sources

- `research/60_evidence-bank/papers/2026-07-07-lyster-saito-cf-meta-analysis.md` — Oral CF meta-analysis with timing implications
- `research/60_evidence-bank/papers/2026-07-07-kang-written-cf-meta-analysis.md` — Written CF decay from immediate to delayed tests
- `research/60_evidence-bank/papers/2026-07-07-hulstijn-involvement-load.md` — Involvement Load interacts with feedback effectiveness

## Open Questions

- Can VibeLingo reliably detect when the user is "composing" vs. "consuming" in an agent conversation?
- What is the maximum acceptable delay for feedback after an error? (5 minutes? End of session? Next day?)
- Does the user's tolerance for interruption change over time — becoming more tolerant as the plugin proves helpful?
- How should VibeLingo handle corrections from 3 sessions ago vs. corrections from this session?
- Is there evidence that repeated, delayed, focused feedback on a pattern error is as effective as multiple immediate corrections?

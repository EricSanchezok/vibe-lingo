# Corrective Feedback Types

## Summary

Corrective feedback (CF) in SLA refers to any indication to the learner that their language output is incorrect. The dominant taxonomy (Lyster & Ranta, 1997) identifies six types: recasts, explicit correction, elicitation, clarification requests, metalinguistic feedback, and repetition. These fall into two broad categories: **recasts** (the correct form is provided) and **prompts** (the learner is pushed to self-correct). Meta-analytic evidence consistently shows that prompts produce larger and more durable learning effects than recasts (Lyster & Saito, 2010: prompts d=0.83 vs recasts d=0.53). For VibeLingo's expression polish feature, this means the plugin should default to prompt-based feedback — guiding the user toward self-correction rather than silently rewriting their text.

## What We Know

### The Six-Type Taxonomy (Lyster & Ranta, 1997)

| Type | Description | Uptake Rate | Learning Potential |
|------|-------------|-------------|-------------------|
| **Recast** | Reformulate the error without marking it | ~31% (mostly repetition) | Low — learner may not notice it's a correction |
| **Explicit correction** | "No, you should say X" | ~50% | Medium — clear but doesn't promote self-repair |
| **Clarification request** | "Pardon?" / "What do you mean?" | ~88% (with repair) | High — forces rethinking, but may feel unnatural in text |
| **Metalinguistic feedback** | "It's past tense, not present" | ~86% (with repair) | High — promotes understanding of WHY, not just WHAT |
| **Elicitation** | "How do we say X in the past tense?" | ~100% (with repair) | High — maximum cognitive engagement |
| **Repetition** | Repeat the error with emphasis | ~78% (with repair) | Medium — draws attention but may confuse in text |

### Prompts > Recasts (Meta-analytic Evidence)

- Lyster & Saito (2010): prompts d=0.83, recasts d=0.53 on posttests; gap widens at delayed posttests.
- The recast disadvantage is partly due to **ambiguity** — learners interpret recasts as meaning confirmation, not error correction.
- Prompts create "negotiation of form" — the learner actively engages with the linguistic problem.
- Effect is stronger for young learners; adult learners can process recasts somewhat better, but prompts still win.

### Written Corrective Feedback (Kang, 2022)

- WCF overall effect: g=0.62 immediate → g=0.46 delayed (moderate, then decays).
- **Direct feedback**: more effective on immediate tests.
- **Indirect feedback**: may promote deeper processing and better long-term retention (mixed evidence).
- **Metalinguistic feedback**: consistently strong — combines direct correction with explanation.
- **Focused feedback** (targeting specific errors) > unfocused (correcting everything).

### Written vs. Oral CF

- Written CF effects are generally smaller than oral CF effects — writing is a lower-stakes, less immediate context.
- But written feedback has the advantage: the learner can re-read, process, and reflect — which favors metalinguistic feedback.
- Text-based chat interaction falls between pure writing and oral conversation — VibeLingo operates in a hybrid modality.

## Design Relevance

### For VibeLingo's "Expression Polish" Feature

1. **Default to metalinguistic feedback**: The user's preference for "show me why" is strongly supported by evidence. Metalinguistic feedback produces the best combination of immediate correction and long-term learning.

2. **Two-tier correction**: Present the correction first (what should change), then the explanation (why). Example:
   ```
   Your text: "Can you making the code more faster?"
   Suggestion: "Can you make the code faster?"
   Note: "making" → "make" (after modal verb "can"); "more faster" → "faster" (faster already means more fast)
   ```

3. **Progressive disclosure of feedback**: Show a hint first (prompt), then the full correction (recast) only if needed. This respects the user's autonomy and maximizes cognitive engagement.

4. **Focused > unfocused**: Don't try to fix everything. Prioritize errors that:
   - Recur frequently (pattern errors)
   - Impede communication (meaning-obscuring errors)
   - Are at the user's current developmental level (learnable now)

5. **Avoid the "recast ambiguity" problem**: In text-based chat, always explicitly mark feedback. Don't silently rewrite the user's message — they may not notice the correction.

### Feedback Type Selection by Proficiency

- **Beginner**: More recasts (direct correction) + simple metalinguistic notes. Self-correction may be too demanding.
- **Intermediate**: Metalinguistic feedback first, recast as fallback. Prompt → "Try again?" → correction.
- **Advanced**: Elicitation and subtle hints. The user has the knowledge; the plugin helps them access it.

## Risks / Misuses

- **Over-correction**: Fixing every minor error overwhelms the user and reduces meaning-focused communication. The feedback-to-encouragement ratio should stay high.
- **Recast-only approach**: Silently correcting without explanation is the worst of both worlds — low learning, and the user may not even notice the help.
- **Metalinguistic overload**: Long grammar explanations disrupt the agent workflow. Keep notes concise (1-2 lines max).
- **Incorrect feedback from the LLM**: The plugin's correction might itself be wrong. Need a confidence indicator or disclaimer.
- **Feedback fatigue**: Even good feedback, if too frequent, becomes annoying. Rate-limiting is essential.

## Supporting Sources

- `research/60_evidence-bank/papers/2026-07-07-lyster-ranta-cf-typology.md` — Foundational taxonomy (Lyster & Ranta, 1997)
- `research/60_evidence-bank/papers/2026-07-07-lyster-saito-cf-meta-analysis.md` — Meta-analysis: prompts > recasts (Lyster & Saito, 2010)
- `research/60_evidence-bank/papers/2026-07-07-kang-written-cf-meta-analysis.md` — Written CF meta-analysis (Kang, 2022)

## Open Questions

- What is the optimal feedback frequency in agent sessions? (per message? per session? per error?)
- How should VibeLingo detect which errors are "learnable now" vs. beyond the user's current level?
- Does the user's primary task (coding vs. writing vs. research) change which CF types are appropriate?
- How to handle the case where the LLM-generated correction is itself incorrect?
- What is the right balance between focusing on grammar vs. vocabulary vs. style/pragmatics in expression polish?

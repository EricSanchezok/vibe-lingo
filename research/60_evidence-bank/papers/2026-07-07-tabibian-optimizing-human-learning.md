# Optimizing Human Learning

## Metadata

- Type: paper
- Date captured: 2026-07-07
- Source URL / path: arXiv:1712.01856v2 (published at WWW 2019)
- Authors / organization: Behzad Tabibian, Utkarsh Upadhyay, Abir De, Ali Zarezade, Bernhard Schölkopf, Manuel Gomez-Rodriguez (MPI-SWS, MPI-IS, Sharif University)
- Year: 2017
- Reliability: high
- Tags: sla, spaced-repetition, forgetting-curve, optimal-scheduling

## Why It Matters

Provides a principled mathematical framework for optimal spaced repetition scheduling, formalizing review scheduling as a stochastic optimal control problem. Validated on real Duolingo data. The key finding — optimal reviewing intensity is linearly proportional to recall probability — directly informs VibeLingo's review scheduler design.

## Key Claims

- Optimal reviewing intensity is linearly proportional to recall probability of the content.
- Works for both exponential and power-law forgetting curves; methodology is memory-model-agnostic.
- The Memorize algorithm outperforms heuristic baselines (Leitner, threshold-based) on real Duolingo data.
- Successful reviews decrease forgetting rate by (1-α); unsuccessful reviews increase it by (1+β).
- Tracks per-item difficulty and personalizes review schedules adaptively.

## Evidence / Details

- Mathematical formulation: spaced repetition as marked temporal point processes with SDE dynamics.
- Loss function balances review effort against recall retention.
- Dataset: Duolingo learner data; Memorize schedules fewer reviews than Leitner for equal retention.
- Builds on Settles & Meeder (2016) finding that exponential/power-law curves give accurate user-item-level predictions at scale.
- Key insight: the optimal solution has a simple structure — review when probability of recall drops to a target level.

## Implications for VibeLingo

- **Per-item difficulty tracking**: Each vocabulary word in the "word book" should carry individual α, β parameters updated on each review.
- **Retrieval-at-review design**: Every review opportunity should test recall (not just show the word) to update the forgetting rate.
- **Effort/retention tradeoff**: The cost of reviewing must be modeled — critical for a plugin that cannot disrupt the main workflow.
- **Review timing**: "Review every day" is suboptimal. Schedule reviews just as recall probability drops below target.

## Limitations

- Assumes binary recall; real vocabulary knowledge is partial (recognition ≠ production ≠ contextual use).
- Experiments on Duolingo (intentional learning), not incidental acquisition.
- Does not address which words to add to the SRS queue.

## Follow-up Questions

- How does optimal scheduling change for incidentally (vs. intentionally) acquired vocabulary?
- Can difficulty parameters be estimated from context clues at initial encounter?
- What is the minimal review frequency for a large vocabulary acquired across agent sessions?

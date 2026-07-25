# FSRS Algorithm — Free Spaced Repetition Scheduler

## Metadata

- Type: web
- Date captured: 2026-07-07
- Source URL: https://github.com/open-spaced-repetition/fsrs4anki
- Authors / organization: Jarrett Ye (L.M. Sherry) and open-spaced-repetition community
- Year: 2022-2025 (ongoing)
- Reliability: high (used by Anki since v23.10 as default algorithm, millions of users, open-source with published research)
- Tags: sla, spaced-repetition, fsrs, algorithm, open-source

## Why It Matters

FSRS is the state-of-the-art open-source spaced repetition algorithm that has replaced SM-2 in Anki. It uses a three-component memory model (Difficulty, Stability, Retrievability — DSR) that maps cleanly to vocabulary learning. MIT-licensed, Python + Rust implementations available.

## Key Claims

- FSRS outperforms Anki's default SM-2: same retention with 20-30% fewer reviews.
- Three-component DSR model:
  - **Difficulty (D)**: Inherent difficulty of the item (1-10). Changes slowly over time.
  - **Stability (S)**: How long a memory trace lasts. Increases with each successful review; resets on failure.
  - **Retrievability (R)**: Probability of recall at any given moment. Decays exponentially from Stability: R = e^(-Δt/S).
- Model personalization: 17 trainable parameters fit to each user's review history.
- User sets a **desired retention level** (typically 0.80-0.95); algorithm schedules reviews to maintain it.
- Lightweight review load: 3-5 reviews/day for typical maintenance.
- Compatible with Anki's "Again/Hard/Good/Easy" grading (4 levels) but works with binary pass/fail.

## Evidence / Details

- Validation on Anki's 700M+ review dataset.
- Open-source implementations: Python `fsrs` package, Rust `fsrs-rs`, TypeScript `ts-fsrs`.
- Default parameters available (no cold-start problem); personalized after ~1,000 reviews.
- Published in IEEE Transactions on Learning Technologies (Ye et al., 2024/2025).
- Comparison table:

| Feature | FSRS | SM-2 |
|---|---|---|
| Memory model | DSR (3-parameter) | E-Factor + interval (2-parameter) |
| Personalization | 17 trainable parameters | None |
| Efficiency | ~30% fewer reviews | Baseline |
| Open source | MIT licensed, Python + Rust implementations | Public domain |
| Used in | Anki (default since v23.10), RemNote, StudyGlen | Anki (fallback) |

## Implications for VibeLingo

- **FSRS is the recommended SRS algorithm**: Open-source, battle-tested, efficient.
- **Cold start handled**: Start with default parameters (behaves like SM-2), personalize after ~1,000 reviews.
- **Desired retention as user-controlled lever**: Users choose 0.80 (lighter review load) to 0.95 (higher retention, more reviews).
- **Binary grading is sufficient**: Correct/incorrect is enough to drive SRS. No need for complex multi-level grading.

## Limitations

- Designed for intentional study; parameters may need adjustment for incidentally acquired vocabulary.
- Assumes independent items; doesn't model word relationships.
- Cold start: first ~1,000 reviews use generic parameters.
- No built-in context-dependence modeling.

## Follow-up Questions

- Can FSRS parameters be seeded from LLM-based word complexity estimates?
- What is the optimal desired retention for incidentally acquired vocabulary?
- How to handle "partial recall" (I kind of remember it) in a binary grading system?

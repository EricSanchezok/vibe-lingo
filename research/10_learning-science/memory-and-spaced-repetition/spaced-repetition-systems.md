# Spaced Repetition Systems

## Summary

Spaced repetition systems (SRS) schedule review of learned material at increasing intervals to maximize long-term retention while minimizing total review time. The core principle: review an item just before it would be forgotten. Modern algorithms like FSRS (Free Spaced Repetition Scheduler) model memory as three components — Difficulty, Stability, Retrievability (DSR) — and personalize scheduling to each user. VibeLingo should use FSRS as its review engine because it is open-source, efficient (20-30% fewer reviews than SM-2), and its DSR model maps cleanly to vocabulary items encountered during agent sessions.

## What We Know

### The Spacing Effect is Robust

- Distributed practice dramatically outperforms massed practice (Cepeda et al., 2006 — meta-analysis of 317 experiments).
- Optimal gap between reviews: ~10-20% of the desired retention interval (Cepeda et al., 2008).
- For 1-week retention: ~1-day gap. For 1-year retention: ~1-2 month gap.
- Effect size: Cohen's d = 0.5-1.0 (medium to large).

### Retrieval Practice Amplifies Learning

- Roediger & Karpicke (2006): testing produces better long-term retention than additional study.
- Active recall (producing from memory) > passive review (seeing with answer visible).
- Every review opportunity should TEST recall, not just show the word.

### Modern SRS Algorithms

- **FSRS** (Free Spaced Repetition Scheduler — Ye et al., 2022-2025): State-of-the-art, used by Anki since v23.10. MIT licensed. Three-component DSR model with 17 personalizable parameters.
- **SM-2** (SuperMemo 2): Classic algorithm. Simple (E-Factor + interval). No personalization. Public domain.
- **Memorize** (Tabibian et al., 2017): Formulates SR as stochastic optimal control. Proven optimal given a forgetting model.

FSRS is recommended for VibeLingo:
- FSRS performs similarly to SM-2 with default parameters (cold start solved).
- After ~1,000 reviews, personalized parameters yield 20-30% fewer reviews for equal retention.
- Python + Rust implementations available, MIT licensed.
- User sets "desired retention" (0.80-0.95); less retention = fewer disruptions.

### Word Complexity Affects Forgetting

- Zaidi et al. (2020): word complexity is the single most predictive feature for vocabulary recall.
- Complex, abstract words have steeper forgetting curves — need closer spacing.
- VibeLingo can use LLM-based complexity/concreteness estimates to seed initial SRS difficulty parameters.

## Design Relevance

### Integration Patterns

- **Micro-review sessions**: Broccoli research suggests even passive, in-context exposure works well. Explicit retrieval practice at task boundaries (not mid-task) provides active recall benefit without disruption.
- **Desired retention as a user-controlled lever**: Users choose 0.80 (lighter review load, less disruption) to 0.95 (higher retention, more frequent reviews).
- **Review at natural breakpoints**: Between agent turns, at end of coding session, or when switching tasks. Never mid-response.
- **Minimum effective review**: 30-second micro-reviews (1-3 words) at session boundaries as "maintenance" doses; 2-minute sessions (5-10 words) for meaningful SRS value.

### Cold Start Strategy

1. **Initial difficulty estimation**: Use LLM-based word complexity + concreteness scores to set initial Difficulty (D).
2. **Default SM-2 behavior**: For first ~1,000 reviews, use SM-2-like scheduling (FSRS defaults approximate this).
3. **Gradual personalization**: Re-optimize FSRS parameters every time review count doubles.

### Review Task Design

- **Recognition tasks** (multiple choice, matching): easier but less durable — useful for initial reviews.
- **Recall tasks** (fill-in-the-blank, translation): harder but more durable — should be default review format.
- **In-context review**: Presenting word in original agent-session context during review may enhance retrieval.
- **Binary grading is sufficient**: Correct/incorrect is enough to drive SRS. Multiple grade levels (Again/Hard/Good/Easy) add value but increase interaction cost.

## Risks / Misuses

- **Over-reviewing**: Scheduling reviews too frequently provides marginal benefit. FSRS's retention target prevents this.
- **Under-reviewing**: If retention target is too low or reviews are skipped, words fall below recall threshold.
- **Disruption kills adoption**: A plugin that interrupts coding with flashcards will be disabled.
- **Partial knowledge confuses binary grading**: Vocabulary knowledge is multidimensional (form recognition, meaning recognition, meaning recall, productive use).
- **Incidental ≠ intentional**: All SRS algorithms are designed for intentional study. Applying to incidentally acquired vocabulary may require different parameters.

## Supporting Sources

- `research/60_evidence-bank/papers/2026-07-07-tabibian-optimizing-human-learning.md`
- `research/60_evidence-bank/papers/2026-07-07-zaidi-adaptive-forgetting-curves.md`
- `research/60_evidence-bank/web/2026-07-07-fsrs-algorithm.md`
- `research/60_evidence-bank/web/2026-07-07-cepeda-spacing-meta-analysis.md`

## Open Questions

- What is the minimum viable review frequency for incidentally acquired vocabulary?
- How much does presenting words in original agent-session context during review improve retrieval?
- Can FSRS difficulty parameters be seeded from LLM-based word complexity estimates?
- What is the lower bound for effective micro-review session length?
- How should VibeLingo handle the cold start period (<1,000 reviews)?

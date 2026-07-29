# ADR: Separate Visible Practice Activity from Trustworthy Learning Patterns

## Status

Accepted

## Context

A 30-day local Synergy baseline found an active-day median of about 40 direct top-level user messages and a median of three user messages per Session. Target-language attempts are only a subset of that traffic, so a learner can practice throughout a day while producing few recurring error patterns.

The product must make real practice visible without manufacturing “good expression” patterns, lowering the evidence standard, or claiming that a message with no finding was fully correct. Adding a tentative evidence tier would increase storage, lifecycle, query, and UI complexity before there is evidence that users need it.

## Decision

VibeLingo uses two deliberately separate outcomes:

1. Every successfully classified target-language message contributes to practice activity, same-day progress, trends, and one aggregated journey event per Scope/Session.
2. Only findings with confidence at or above `0.85` create or update a learning pattern.

Pattern promotion uses:

- two `meaning_affecting` or `high_value` findings in two distinct Sessions; or
- three findings in at least two distinct Sessions for all other cases.

No tentative signal is stored. A no-finding target-language attempt is described only as practice activity, never as a correct message.

Analyzer failures receive one immediate in-memory retry. Exhausted retries remain fail-soft and do not create a durable task or persist the full message.

## Rationale

Activity and learning-pattern evidence answer different questions. Activity shows that the learner actually used the target language; patterns require enough confidence and recurrence to justify coaching and review. Separating them increases visible value from sparse data without weakening the meaning of candidate, practicing, verified, or lapse states.

Cross-Session recurrence remains mandatory because repeated wording inside one debugging exchange is weaker evidence than recurrence in separate work contexts. The two-occurrence path is limited to non-minor findings, while minor findings retain the more conservative threshold.

## Consequences

- Overview and Progress can remain meaningful on days with no findings.
- Journey stays Session-granular and does not add message-level events.
- The database schema does not change; aggregates are derived from `analyzed_messages`.
- Candidate patterns remain trustworthy, and no second confidence lifecycle must be maintained.
- Analyzer failure still loses an observation after one retry, preserving privacy and architectural simplicity.

## Evidence

- `../../60_evidence-bank/datasets/2026-07-29-synergy-direct-chat-frequency-baseline.md`
- `../../80_synthesis/product-briefs/2026-07-29-sparse-evidence-parameter-strategy.md`
- `2026-07-28-evidence-learning-loop-and-review-backend.md`

## Revisit Trigger

Revisit if measured target-attempt yield remains too low despite visible activity, if `not_error` actions increase after the 2/2 promotion path, or if calibrated analyzer studies show that a bounded tentative tier would provide material benefit without confusing learners.

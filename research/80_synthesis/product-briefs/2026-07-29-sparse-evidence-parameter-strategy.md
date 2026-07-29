# Sparse-Evidence Parameter Strategy

## Bottom Line

- Use the active-day median of roughly 40 direct messages as the operating baseline, but measure learning against target-language attempts rather than all messages.
- Keep `0.85` as the accepted-finding threshold and `0.90` for natural-correct demonstrations. Sparse data is not a reason to raise the discard threshold.
- Make every successfully classified target-language attempt visible as practice activity, even when it produces no finding.
- Let two accepted non-minor findings across two Sessions promote a pattern; keep the three-finding/two-Session rule for minor-only evidence.
- Do not add a tentative evidence tier, extra learner sensitivity setting, or more persisted content in v0.5.
- Keep conservative verification, review spacing, foreground correction limits, and privacy rules.

## Evidence Base

- `../../60_evidence-bank/datasets/2026-07-29-synergy-direct-chat-frequency-baseline.md`
- `../../10_learning-science/feedback-and-correction/corrective-feedback-types.md`
- `../../10_learning-science/feedback-and-correction/feedback-timing.md`
- `../../10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md`
- `../../70_decisions/adr/2026-07-29-visible-practice-under-sparse-data.md`

## Analysis

### The useful-data funnel is smaller than direct-message volume

Forty direct messages per active day is not forty learning observations. If `p` is the share of direct messages that are genuine target-language attempts and `q` is the chance that a specific pattern appears incorrectly, expected daily evidence for that pattern is:

```text
40 × p × q
```

Illustrative scenarios—not measured facts—show why the target-attempt rate matters:

| Target-attempt share | Pattern error rate within attempts | Expected observations/day | Time to 3 observations |
|---:|---:|---:|---:|
| 10% | 5% | 0.2 | 15 active days |
| 25% | 5% | 0.5 | 6 active days |
| 25% | 10% | 1.0 | 3 active days |
| 50% | 10% | 2.0 | 1.5 active days |

A page driven only by recurring errors will therefore feel empty even when the learner is actively using the target language. The missing value is not necessarily more error evidence; it is visible practice activity.

### Activity and trustworthy patterns answer different questions

An analyzed target-language attempt is evidence that practice happened. It is not evidence that the whole message was correct. A finding at or above `0.85` is sufficiently trustworthy to create a candidate pattern under the current analyzer contract.

These facts should remain separate:

- **practice activity** powers today counts, active days, trends, and Session-level journey records;
- **accepted findings** power candidate, practicing, review, lapse, and verified lifecycles.

This preserves the existing meaning of confidence without discarding the value of a no-finding message or inventing “excellent expression” patterns.

### Why v0.5 rejects a tentative tier

Retaining `0.70–0.85` signals would require a second evidence status, retention rules, merge semantics, suppression behavior, query filters, privacy decisions, and UI language. It would also make it harder to explain why a stored signal cannot be reviewed or coached.

That complexity is not justified by the current evidence. The simpler response to sparse traffic is:

1. count all successful target-language classifications as activity;
2. retry one transient analyzer failure in memory;
3. reduce promotion latency only for already accepted non-minor findings across independent Sessions.

### Short Sessions make independence more valuable

With a median of three user messages per Session, repeated errors inside one long debugging exchange should not be treated like independent recurrence. Session diversity remains a hard promotion condition. Two accepted non-minor observations in two Sessions can be more informative than several repetitions in one Session.

### Calendar time and evidence time serve different purposes

The observed user was active on 28 of 30 days, so the `1 → 3 → 7 → 14 → 30` review ladder remains plausible. Progress views should lead with same-day activity and 30-day evidence, while retaining 7/30/90-day trends. Verification remains conservative because sparse data should not weaken mastery claims.

## Adopted Parameters

| Area | v0.5 decision | Rationale |
|---|---|---|
| Eligible messages | Analyze every eligible message | Ordinary volume is modest and each attempt matters |
| Finding confidence | Keep `0.85` | Avoid both false patterns and needless loss from a higher threshold |
| Natural demonstration confidence | Keep `0.90` | Positive transfer evidence affects verification and deserves a stronger bar |
| Findings per message | Keep maximum 2 | More findings would increase interruption and fragmentation |
| Non-minor promotion | 2 accepted findings / 2 Sessions | Faster time-to-review with independent, high-value evidence |
| Minor promotion | 3 accepted findings / 2 Sessions | Preserve a conservative bar for small issues |
| Foreground correction | Focused 1; strict maximum 2 | Data scarcity does not justify more interruption |
| Recurring prompt focus | Maximum 3 | Protect the primary task and prompt clarity |
| Review intervals | Keep 1/3/7/14/30 days | Current activity supports calendar spacing; FSRS still lacks histories |
| Verified threshold | Keep existing multi-source, seven-day rule | Do not manufacture mastery from sparse evidence |
| Analyzer failure | One in-memory retry | Recover transient loss without durable message storage |
| Progress visibility | Today counts plus Session journey aggregation | Show real practice without calling no-finding messages correct |

## Configuration Boundary

Confidence, recurrence, and verification thresholds remain internal and versioned. Keep the current user-facing controls:

- support and target language;
- proficiency;
- focused / strict / off;
- tracking;
- recurring focus.

Do not add a sensitivity slider or tentative-signal option.

## Reliability and Privacy

The current Plugin API supplies message text to `session.user-message.after`, but VibeLingo has no verified capability-scoped replay contract for retrieving that text later. Safe behavior is:

1. retry once while the hook payload remains in memory;
2. if both calls fail, end silently;
3. never persist the complete message to enable retry;
4. continue storing only classifications, counts, provenance, and bounded sanitized fragments for accepted evidence.

## Measurement Questions

- What share of direct messages become target-language attempts?
- How often do analyzer calls require the retry, and how often does it recover?
- What are finding and demonstration yields by language and proficiency?
- Does the non-minor 2/2 path increase `not_error` actions?
- Do visible practice counts improve return and review-start behavior?

## Recommended Next Step

Run v0.5 with the activity/pattern separation unchanged long enough to measure the funnel. Revisit confidence or evidence complexity only when observed false-positive, failure, and promotion-latency data identify a concrete problem.

# Synergy Direct Chat Frequency Baseline

## Metadata

- Type: dataset
- Date captured: 2026-07-29
- Source URL / path: User-provided report derived from local Synergy data
- Authors / organization: VibeLingo project owner
- Year: 2026
- Reliability: medium
- Tags: `synergy-plugin`, `daily-agent-use`, `mvp`, `privacy`

## Why It Matters

VibeLingo's evidence thresholds, review load, progress windows, and failure handling depend on how much genuine learner-authored text is available. Counting every `role=user` record overstates that supply because Synergy also creates internal and automated user-role messages.

## Key Claims

- The window was 2026-06-30 00:00 through 2026-07-29 21:41 in UTC+08.
- Strict filtering produced 2,031 direct top-level user messages from roughly 4,375 user-role messages.
- There were 28 active days in 30.
- The active-day median was 40 direct messages; the latest 7-day average was 32.1 and latest 14-day average was 39.3.
- The raw 30-day mean was 67.7 messages per day but was distorted by two high-volume days; the maximum was 361.
- The window contained 273 directly interactive Sessions.
- User messages per Session had a median of 3 and a mean of 7.4, indicating many short Sessions plus a small long-session tail.
- Recent activity concentrated from afternoon through late evening.

## Evidence / Details

The report defines one chat interaction as one message directly sent by the user to a top-level Agent.

Included records were:

- top-level, non-background Sessions;
- `role=user`;
- `origin.type=user`.

Excluded records included:

- child and background Sessions;
- Cortex and agent-to-agent inputs;
- Blueprint and BlueprintLoop automation;
- Agenda inputs;
- compaction continuations;
- system-generated inputs;
- obvious test traffic.

Recent daily direct-message counts were:

| Date | Messages | Active Sessions | New Sessions |
|---|---:|---:|---:|
| 2026-07-23 | 38 | 12 | 11 |
| 2026-07-24 | 24 | 3 | 2 |
| 2026-07-25 | 41 | 12 | 12 |
| 2026-07-26 | 18 | 3 | 2 |
| 2026-07-27 | 38 | 7 | 6 |
| 2026-07-28 | 19 | 4 | 1 |
| 2026-07-29 | 47 | 10 | 7 |

## Implications for VibeLingo

- Design for tens of direct messages per active day, not hundreds.
- Preserve cross-Session evidence because the median Session contains only three user messages.
- Do not sample eligible messages merely to reduce model calls; ordinary volume is already modest.
- Treat the 361-message day as a burst-capacity case, not as the pedagogical baseline.
- Use robust or attempt-normalized progress views rather than raw daily averages that are dominated by outliers.
- The direct-message count is only the top of the learning-evidence funnel; target-language attempt rate, finding yield, natural-use yield, and review completion still need measurement.

## Limitations

- This is a single-user, single-installation, 30-day observation.
- The underlying query and raw rows were not independently reproduced in this capture.
- The report does not identify how many direct messages attempted the configured target language.
- It does not measure analyzer availability, false-positive rate, finding yield, natural-correct yield, or review behavior.
- Message counts do not represent linguistic content length; one long prompt may provide more evidence than several short acknowledgements.

## Follow-up Questions

- What share of direct messages are eligible target-language attempts for each workflow?
- How many attempts yield confident errors or natural-correct demonstrations?
- How often does one canonical pattern recur across two Sessions?
- What fraction of due patterns are reviewed, abandoned, or ignored?

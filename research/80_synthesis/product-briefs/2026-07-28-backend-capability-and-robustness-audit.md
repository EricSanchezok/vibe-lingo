# VibeLingo v0.3 Backend Capability and Robustness Audit

## Bottom Line

- Every functional state shown across the 14 final Figma screens has a backend query or command contract.
- The Dashboard UI and navigation entry remain intentionally unimplemented; this audit covers backend feasibility, not rendered UI.
- Review completion, learning-record detail, filters, pagination, transfer hints, recent natural use, and evidence curves no longer require the frontend to invent data.
- Persistence invariants are enforced both at Agent parsing and repository boundaries.
- The mainline contains one SQLite schema and one learning store; no compatibility store, duplicate migration path, placeholder Dashboard code, or unused helper API remains.

## Evidence Base

- [VibeLingo Figma file](https://www.figma.com/design/PJdPhrIuBvUs66Yz9pUe6E?node-id=44-2)
- `research/70_decisions/adr/2026-07-28-evidence-learning-loop-and-review-backend.md`
- `research/40_integration-patterns/proactive-interventions/review-design.md`
- `research/40_integration-patterns/progress-tracking/review-state-model.md`
- `/Users/eric/projects/synergy/packages/plugin/src/context.ts`

## Figma Capability Matrix

| Figma screen | Required backend behavior | v0.3 contract |
|---|---|---|
| 01 Overview | learning week, streak, active days, real Sessions, due reviews, review ratio, verified count, 7/30/90-day evidence curves, recent natural use, journey preview | `learning-summary`, `learning-journey`, `review-queue` |
| 02 Review: produce | due pattern selection and hidden reference answer | `review-start`, `review-state` |
| 03 Review: hint | progressive phase-safe hints | `review-command/request_hint` |
| 04 Review: repair | evaluator feedback, natural answer, correction loop | `review-command/submit_answer` |
| 05 Review: transfer | different production task, optional hint, no premature completion | review state machine plus `request_hint` |
| 06 Review: complete | item outcomes, independent recall, assisted count, successful transfer, next due time | `ReviewState.summary` and `completedItems` |
| 07 Learning patterns | search, product status, Scope, priority/recent/frequency/due sorting, keyset pagination | `learning-patterns` |
| 08 Pattern detail | rule, schedule, errors/natural-use/review trends, evidence timeline, examples, review history, work contexts | `learning-pattern-detail` |
| 09 Pattern actions | ignore, restore, not-error, delete, merge | `pattern-command` |
| 10 Learning journey | event/time filters, Scope, stable pagination | `learning-journey` |
| 11 Learning record | one event, bounded evidence, related patterns, Session learning totals, provenance | `learning-record` |
| 12 Language profile menu | active profile plus target languages that have history | `learning-profiles` |
| 13 Settings configured | compact summary, atomic settings save, target/all cleanup | existing settings surface, `learning-summary`, `clear-learning-data` |
| 14 Settings first run | setup-required empty state and profile activation | settings schema/controller; all learning operations fail soft until configured |

The frontend will still need presentation logic, routing, loading skeletons, localization, and host navigation. It does not need to calculate learning lifecycle, scheduling, review outcomes, or evidence totals.

## Edge-Case Audit

### Analysis and evidence

- A message is unique by target language and message ID, so retries do not double count and the same host message may belong to separate target-language namespaces.
- Findings below `0.85` and demonstrations below `0.90` are rejected at the repository boundary.
- Demonstrations may only reference an existing active canonical pattern.
- When one message contains both an error and a demonstration for the same canonical pattern, the error wins.
- `not_target` and `skipped` remain distinct from a target-language attempt, so activity curves are not error curves.
- Sensitive or oversized fragments retain outcome/provenance but not content.

### Time and pagination

- Trends use a legal IANA timezone and pad the UTC read window before local-day bucketing, including daylight-saving boundaries.
- A streak remains current when the last activity was yesterday; it resets only after a full missed local day.
- Journey and pattern lists use stable timestamp/ID or metric/key cursors. Malformed cursors fail explicitly instead of silently restarting page one.
- Search escapes SQL wildcard characters, so `%` and `_` are literal user input.

### Review state

- One target language can have at most one active or paused review.
- Builder/evaluator Agent calls happen outside transactions.
- Every command is request-ID idempotent and revision-checked.
- Reference answers are unavailable during initial recall.
- Low-confidence evaluation cannot create an attempt, evidence, schedule change, or revision.
- An incorrect unaided recall is stored as `incorrect`, not `assisted`.
- Sensitive answers, feedback, natural answers, or generated review content are removed before persistence even for a direct repository caller.
- Abandoning a review schedules unfinished patterns for the next day without creating success evidence.
- Merging, ignoring, rejecting, or deleting a pattern first abandons any open review that contains it, preventing a dangling current item.

### SQLite and lifecycle

- WAL, foreign keys, a five-second busy timeout, and short immediate transactions remain enabled.
- Current schema validation checks tables, columns, required indexes, and the event contract rather than trusting only `PRAGMA user_version`.
- Schema initialization rechecks after obtaining the exclusive lock, so overlapping generations do not destructively reset freshly initialized data.
- A malformed current-version schema is rebuilt cleanly; a valid current schema is reused.
- Clear-target, clear-all, and uninstall cleanup rely on foreign-key cascades and leave no alias, review, attempt, command, event, or content orphan.

## Maintainability Audit

The code follows one dependency direction:

```text
plugin contributions
  → application contracts and review orchestration
    → domain types, privacy, time, scheduling
      → SQLite repositories and database lifecycle
```

Specific cleanup completed:

- removed the v0.1/v0.2 store, migration path, marker cleanup, superseded types, test-only analyzer helper, and unused database/settings exports;
- moved Dashboard Zod contracts out of the contribution registration file;
- moved cursor validation and pattern-view mapping into `infrastructure/query-support.ts`;
- retained one `LearningRepository` as the aggregate transaction boundary instead of adding parallel read/write stores that could disagree;
- kept review Agent parsing in application code and deterministic state transitions in repository/domain code;
- enabled strict unused-local/unused-parameter verification in the audit;
- kept every Dashboard operation in the exported contribution list and covered its descriptor, so there are no placeholder operations.

The learning repository remains the largest module because pattern merge, lifecycle promotion, evidence retention, and profile revision must share SQLite transactions. If it grows beyond the current Dashboard contract, the next safe split is a read-only query object sharing the same database wrapper—not a second store or copied SQL path.

## Remaining Product Boundaries

- The Figma Dashboard, sidebar entry, and custom routes are not implemented in v0.3.
- Session titles are resolved only temporarily for records in the current Scope. Cross-Scope records expose generic provenance IDs because no title is stored.
- Curves are evidence counts, not a learning score.
- `verified` is conditional evidence, not permanent mastery or a proficiency level.
- Review generation and language classification quality still depend on the selected mini model.

## Recommended Next Step

Implement the Dashboard against these operations without adding client-side lifecycle or scheduling logic. Add contract fixtures for each of the 14 screens before wiring navigation so API drift is detected before visual integration.

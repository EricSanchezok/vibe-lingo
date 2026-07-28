# ADR: Evidence-Based Learning Loop and Backend-First Review

## Status

Accepted

Extends the prompt-first and multilingual-profile ADRs. This decision governs VibeLingo `0.3.0`.

## Context

The v0.2 backend classified errors and counted recurring patterns, but it could not support the designed learning experience:

- correct natural use produced no evidence;
- a pattern had no lifecycle beyond occurrence count;
- there was no due queue, active-recall flow, repair, transfer task, or resumable review;
- progress described errors rather than learning activity;
- Dashboard designs had no stable backend queries;
- earlier research assumed Notes, Memory, Agenda, FSRS, and automatic task-boundary invitations that are not justified by the current Plugin API or the product's interruption constraints.

The product is unreleased, so preserving the v0.1/v0.2 SQLite format would add complexity without user value.

## Decision

### Learning evidence

Store bounded, sanitized evidence for:

- confident errors;
- natural correct use of an already-known pattern;
- review recall, repair, and transfer attempts.

Patterns use `candidate → practicing → verified`. Three errors across two Sessions make a pattern practicing and immediately due. Verified requires two independent reviews, a later natural use, two Session identities, and at least seven elapsed days. A later error records a lapse and returns the pattern to practicing.

Verified is an evidence state, not permanent mastery or an assessed proficiency level.

### Review

Prepare a local due queue without automatically inviting or notifying the user. The future Dashboard starts review explicitly.

Use:

- active production before feedback;
- at most two progressive hints;
- repair after an error;
- a different transfer task before an independent success is awarded;
- a deterministic `1, 3, 7, 14, 30` day interval ladder.

Do not use FSRS until VibeLingo has enough real review data to justify its parameters.

### Backend contract

Expose typed UI operations for language histories, evidence summaries and trends, journey records, patterns, review queue, review state, review commands, pattern controls, and cleanup. These operations and the Progress tool share application services and repositories.

No Dashboard, navigation item, automatic invitation, notification, Agenda integration, or `session.turn.after` contribution ships in v0.3.

### Storage and privacy

Use plugin-owned SQLite under the existing VibeLingo data directory. Target-language state aggregates globally; Scope remains provenance and a query filter.

Never persist complete user messages, Agent responses, or Session titles. Keep at most five recent content-bearing evidence/review records per pattern and retain older metadata without content.

Schema v4 destructively recreates any earlier dogfood database. Initialization verifies the complete required table/column/index shape under an exclusive lock, then rechecks after acquiring the lock so overlapping plugin generations do not reset a database that the newer generation has already prepared. No legacy migration layer remains.

### Dashboard completeness and repository boundaries

The 14-screen Figma flow is treated as an acceptance contract for the backend even though the UI itself is deferred. In particular:

- summary queries expose session, due-review, independent-recall, successful-transfer, awaiting-verification, recent-natural-use, streak, week, and trend evidence;
- journey records are typed, filterable, keyset-paginated, and resolvable into bounded evidence details;
- pattern lists expose derived product statuses and pattern detail includes evidence, review history, trends, contexts, scheduling, and actions;
- review state exposes only phase-appropriate content and includes the per-item outcome and next-due summary required by the completion screen.

Persistence validation is repeated at repository boundaries, not trusted only because a hidden Agent or operation schema already validated input. Low-confidence evaluation cannot mutate review state, incorrect recall remains `incorrect`, and sensitive generated content, answers, feedback, or fragments are omitted before SQLite writes.

Keep one learning repository as the aggregate transaction boundary. Shared cursor/view mapping lives in a separate query-support module; application contracts, review orchestration, deterministic domain rules, database lifecycle, and plugin contributions remain separate modules. Do not add a parallel legacy store or duplicate query path.

## Rationale

- Retrieval, repair, and transfer measure a user's production better than passive error counts.
- Natural correct use prevents the system from treating only mistakes as learning activity.
- A conservative verified threshold avoids turning short-term recall into a false mastery claim.
- Deterministic intervals are transparent and testable during cold start.
- Preparing a queue without prompting protects the work-first contract.
- A backend-first API lets the Figma Dashboard be implemented later without mixing product UI work into the learning-engine rewrite.
- Removing compatibility code keeps the pre-release mainline small and auditable.
- Treating Figma as an explicit backend acceptance matrix prevents attractive screens from depending on invented frontend state.
- Revalidating at the persistence boundary protects privacy and lifecycle invariants when future callers bypass the current operation layer.

## Consequences

### Easier

- Building overview curves, learning journeys, pattern detail, and review pages.
- Explaining why a pattern is due or verified.
- Testing all scheduling and lifecycle decisions deterministically.
- Switching target languages without mixing evidence.
- Correcting false positives through ignore, reject, delete, and merge actions.

### Harder

- Two hidden review Agent calls are required for generated practice and evaluation.
- Natural-use classification remains model-dependent.
- Cross-Scope Session titles cannot be displayed unless the host later offers a suitable metadata capability.
- The due queue has no user-facing entry until the Dashboard is implemented.

## Evidence

- `research/10_learning-science/feedback-and-correction/feedback-timing.md`
- `research/10_learning-science/second-language-acquisition/output-hypothesis.md`
- `research/10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md`
- `research/40_integration-patterns/proactive-interventions/review-design.md`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/hook-points.ts`
- `/Users/eric/projects/synergy/packages/plugin/src/context.ts`

## Revisit Trigger

Revisit if:

- real review histories are sufficient to compare deterministic scheduling with FSRS;
- Synergy exposes a reliable, appropriate user-receptivity or task-boundary surface;
- users want cross-Scope Session titles enough to justify a new permission or host capability;
- review generation or evaluation precision is not adequate across supported languages.

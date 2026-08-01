# ADR: Prompt-First Language Coaching as the VibeLingo Core

## Status

Accepted

Extended by `2026-07-27-multilingual-profile-and-trusted-settings.md`, `2026-07-28-evidence-learning-loop-and-review-backend.md`, and `2026-07-30-foreground-correction-authority-and-sessionless-analysis.md`. The prompt-first work-first model remains the core; v0.3 limits recurring focus to active practicing patterns. V0.6 makes the correction Tool card the first visible action and authoritative history record instead of duplicating `Got it`/`💡` text in the final answer.

## Context

Earlier VibeLingo designs treated Help, Polish, Explain, Composer completion, decorations, and pre-submit review as separate product interactions. Those designs were partly responses to older Synergy platform constraints.

A simpler model is now plausible:

1. inject a concise language-coaching behavior contract into the primary Agent's system context;
2. let the primary Agent restate, clarify, and correct while continuing the real task;
3. observe persisted user messages asynchronously;
4. extract recurring learning signals into plugin-owned storage;
5. feed only a small summary of useful recurring patterns back into future prompt context.

This model uses the existing conversation as the teaching surface and does not require automatic completion or correction UI to prove the core value.

## Decision

Treat Prompt-injected, work-first language coaching as the leading VibeLingo MVP hypothesis.

The initial experience should:

- preserve the primary Agent's task-execution role;
- correct and proceed when task intent is clear;
- clarify only when ambiguity would materially change the requested action;
- give zero or one compact correction by default, with two as a hard maximum;
- support an escape hatch such as `just do it` or `skip the lesson`;
- avoid grammar jargon and full lessons;
- perform background learner-pattern extraction asynchronously;
- persist only minimal, structured learning signals rather than complete messages.

Composer completion, decorations, selected-text UI, and submission interception remain possible later enhancements, not MVP requirements.

## Rationale

- The product promise is language learning through real Agent work, not a new editing surface.
- The primary Agent already has task context and can distinguish task ambiguity from harmless language mistakes better than an isolated grammar checker.
- Correct-and-proceed avoids the most damaging failure mode: language teaching blocking real work.
- A system-context rule works across Web and text-only Synergy surfaces, while Composer UI is Web-specific.
- `session.user-message.after` supports asynchronous analysis without delaying or rolling back the Session loop.
- A prompt-first MVP tests the core learning behavior with much lower UI and interaction complexity.

## Synergy Mapping

### Foreground behavior

Use the stable API4 `chat.system.transform` hook to append an idempotent, compact coaching contract. The earlier `experimental.chat.system.transform` spelling was a pre-GA integration detail and is no longer used by VibeLingo.

The hook runs in both `budget` and `final` phases. The implementation must avoid duplicate insertion when the budget-transformed system reaches the final phase.

The final phase also runs for Sessionless and small Agent calls, so the hook must exclude `small` calls and other non-user-facing Agent work. The exact root/user-facing Session filter remains to be validated.

Relevant source:

- `/Users/eric/projects/synergy/packages/plugin/src/contribution.ts:66-84`
- `/Users/eric/projects/synergy/packages/synergy/src/session/prompt-budgeter.ts:74-103`
- `/Users/eric/projects/synergy/packages/synergy/src/session/llm.ts:288-329`
- `/Users/eric/projects/synergy/test/plugin/system-transform-hook.test.ts:107-183`

### Background learning analysis

Use `session.user-message.after` to receive an ordinary persisted user message:

```ts
{
  message: {
    id: string
    text: string
    createdAt: number
  }
}
```

Scope and Session identity come from `PluginInvocationContext`. The hook excludes synthetic/internal messages, continues asynchronously, and cannot block task execution.

A bounded hidden Agent call may classify the message into structured learning signals. It should fail soft and produce no user-visible interruption.

Relevant source:

- `/Users/eric/projects/synergy/packages/plugin/src/context.ts:244-250`
- `/Users/eric/projects/synergy/packages/synergy/src/session/user-message-materialization.ts`
- `/Users/eric/projects/synergy/docs/plugins/runtime-and-permissions.md:113-123`

### Learner memory

The initial stored signal was:

```text
scope_id
session_id
message_id
observed_at
target_language
pattern_key
original_fragment
suggested_fragment
confidence
encounter_count
last_surfaced_at
```

Do not store the complete user message by default. `original_fragment` and `suggested_fragment` should be minimal and subject to length and sensitivity filters.

V0.3 replaces this tentative occurrence-only shape with typed error, natural-correct, recall, repair, and transfer evidence. See `2026-07-28-evidence-learning-loop-and-review-backend.md`.

Synergy Plugin API 3 deliberately does not provide a generic business-data store. VibeLingo owns its SQLite schema and stores it under `<synergyRoot>/data/plugins/vibe-lingo/vibe-lingo.sqlite`. The path follows `SYNERGY_HOME` and `SYNERGY_TEST_HOME`. Normal uninstall deletes the owned directory; force uninstall may leave it behind.

The database retains aggregate patterns and Scope/Session/message provenance, never complete messages. Only the five most recent sanitized fragment pairs per pattern remain populated.

## Prompt Design Changes

The full behavioral specification is useful as a design source but should be compiled into a shorter injected prompt.

The injected version should add these protections:

- Restatement must not add, remove, or strengthen task requirements.
- Clarification is required only when different interpretations would lead to materially different actions.
- Good English produces no teaching output.
- One correction is the ordinary maximum; use two only for independent, high-value issues.
- When correction is warranted, `plugin__vibe-lingo__record-correction` must be the first visible action before any progress update, other Tool, or substantive answer.
- The Tool receives only the visible restatement and fragment pairs. Continue the task immediately after it returns; do not duplicate or defer correction in ordinary text.
- Recurring-pattern claims should be based on injected learner memory, not the model's unreliable recollection.
- Do not repeat the opening correction in later tool-loop steps or the final answer.

## Consequences

### Easier

- Cross-surface behavior, including Web and text-only channels.
- Fast MVP validation without Composer UI.
- A single work-first mental model.
- Explicit escape-hatch behavior.
- Immediate correction without requiring the user to rewrite the task.

### Harder

- Prompt adherence varies by model and long task.
- The injected instruction consumes context on every Agent turn.
- System-transform filtering must avoid internal, small, delegated, and unrelated Agent calls.
- Foreground corrections and background classification may disagree.
- Reliable recurring-pattern behavior depends on a storage and retrieval model.
- Measuring whether the Agent actually presented a correction is harder than measuring background classifications.

## Evidence

- User-proposed two-tier work-first correction prompt, 2026-07-26.
- Accepted implementation in `src/`, with API descriptor, prompt, analyzer, storage, and progress tests in `test/`.
- `research/80_synthesis/product-briefs/2026-07-11-vibelingo-plugin-product-design.md`
- `research/20_synergy-platform/source-map/2026-07-26-plugin-interaction-hooks.md`
- `research/10_learning-science/feedback-and-correction/feedback-timing.md`
- `research/10_learning-science/feedback-and-correction/corrective-feedback-types.md`

## Revisit Trigger

Reopen this decision if:

- Prompt adherence is too inconsistent across supported models;
- corrections noticeably delay or distract from task execution;
- users need help before they can finish a target-language prompt;
- background analysis cannot produce useful recurring patterns without excessive privacy cost;
- users repeatedly request selection-based explanations or inline replacement;
- a Composer prototype materially outperforms prompt-only coaching in real sessions.

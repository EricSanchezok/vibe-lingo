# ADR: Foreground Correction Authority and Sessionless Teaching Analysis

## Status

Accepted

## Context

V0.5 used one post-submit Analyzer to infer both errors and natural correct use from the user's full message. The foreground main Agent separately chose what to show the learner. Those two judgments could disagree: a visible correction might never enter history, a background finding might never have been shown, and historical examples could not reliably answer “what did VibeLingo actually correct?”

The main Agent has the complete task context and is best placed to decide whether feedback is useful without blocking work. It should not be asked to invent stable learning metadata. At the same time, awaiting another model inside the visible Tool would delay task execution and make a tool timeout part of the teaching path.

Synergy Plugin Runtime Protocol 8 adds a bounded, memory-only `agent.start()` call and a directed `agent.call.after` observer. Agent Tools also receive the host-resolved source user message ID.

## Decision

VibeLingo uses three narrow paths:

1. A Nano classifier on `session.user-message.after` decides only whether an ordinary user message is a target-language attempt. It creates activity, never teaching metadata.
2. The main Agent decides whether a correction is warranted. Its first visible action is `plugin__vibe-lingo__record-correction`, containing only a target-language restatement and the exact original/corrected pairs shown in the card.
3. Sessionless asynchronous Agents enrich saved corrections and detect natural correct use of already-known canonical patterns. `agent.call.after` validates and commits their terminal output idempotently.

The visible correction is authoritative:

- it is committed before metadata work starts;
- it remains in history even when metadata is rejected or analysis fails;
- the metadata Agent cannot rewrite it;
- error evidence references the correction item instead of storing a second fragment pair;
- if natural and error evidence race for the same message/pattern, error evidence wins.

The main Agent never submits pattern keys, categories, severity, rules, confidence, or message IDs. The Host supplies provenance IDs.

Tracking-off messages still use the Tool card for consistent foreground teaching, but nothing is persisted and no asynchronous Agent starts.

## Rationale

- The learner's history now matches what they actually saw.
- The main Agent retains contextual teaching judgment without becoming a schema-producing classifier.
- The Tool returns after a short SQLite transaction and host acceptance, so teaching does not await metadata generation.
- Narrow Agents have simpler prompts, outputs, validation, and failure semantics than one monolith.
- Activity remains useful under sparse traffic without weakening the `0.85` error-evidence or `0.90` natural-use thresholds.
- Memory-only async input preserves the “extract, do not store full messages” privacy boundary.

## Consequences

- VibeLingo requires the paired Synergy runtime with `agent.start`, `agent.call.after`, targeted owned-Tool renderers, and `actor.userMessageId`.
- V0.5 data is destroyed on startup; no legacy Analyzer, schema migration, repair adapter, or old Prompt marker remains.
- A Synergy restart may lose one usage analysis. A committed correction remains recoverable as `pending` or stale `queued` and is resubmitted one at a time from a later same-Scope user-message observer.
- Host capacity is bounded and has no queue. Capacity pressure cannot delay the main Agent.
- The correction card can show saving, chat-only, analyzing, recorded, pattern-updated, and failed states without exposing internal metadata.

## Evidence

- `/Users/eric/projects/synergy/packages/plugin/src/context.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/agent-call-runtime.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/host-services-runtime.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/tool/registry.ts`
- `2026-07-26-prompt-first-language-coaching.md`
- `2026-07-29-visible-practice-under-sparse-data.md`

## Revisit Trigger

Revisit if measured foreground correction acceptance is poor, the same-Scope pending recovery leaves material records unresolved, or Synergy introduces a durable privacy-preserving Agent job primitive with stronger delivery guarantees.

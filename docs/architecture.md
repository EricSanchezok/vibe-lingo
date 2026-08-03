# Architecture

VibeLingo is a Synergy Plugin API 4 plugin. Its architecture keeps foreground
teaching, asynchronous analysis, learning state, review, and translation as
separate paths so that language support cannot block the user's real task.

## Runtime paths

### Foreground coaching

The `chat.system.transform` contribution injects a compact coaching contract
only for eligible, user-facing root Sessions with a complete language profile.
When language feedback is useful, the primary Agent calls
`plugin__vibe-lingo__record-correction` before its substantive response. The
Tool card is the authoritative feedback the user saw.

The primary Agent supplies a natural restatement and up to eight visible items,
each marked as an objective correction or contextual naturalness suggestion.
Naturalness items include one short support-language explanation. It does not
invent pattern keys, severity, confidence, or learning rules.

The correction card lays out each item as a labeled source-to-target pair. Its
container width, rather than the host viewport, controls the responsive switch:
wide cards align source, arrow, and target in one row, while narrow cards keep
the arrow attached to the target beneath the source.

### Practice observation and analysis

`session.user-message.after` sends eligible messages to a small language
classifier. A target-language attempt contributes activity even when it creates
no finding.

Saved foreground corrections and known-pattern usage are analyzed by owned,
hidden Agents. Sessionless `agent.start()` calls keep this work outside the
foreground response. `agent.call.after` validates and commits results
idempotently. Learning, translation, review, and presentation calls use the
host's 120-second plugin-Agent ceiling; the small classifier uses 60 seconds per
attempt. The correction card waits 150 seconds before treating a missing
terminal delivery as interrupted, and terminal correction failures retain an
explicit idempotent retry. Analysis failures remain isolated from the main
Session.

### Learning and review

Application services own pattern lifecycle, evidence queries, review
scheduling, journey records, and Dashboard operations. Domain rules do not
depend on Solid, Synergy surface state, or SQLite.

Review content is generated only when a user explicitly starts or continues a
review. The deterministic interval ladder is `1, 3, 7, 14, 30` days. VibeLingo
does not send automatic review invitations.

### Selected-text translation

Synergy owns selection capture, context-menu composition, popover placement,
focus, cancellation, and responsive behavior. VibeLingo owns language
direction, translation generation, caching, and local history.

Translation is an assistance feature. It does not count as independent
target-language output and cannot create learning evidence or review items.

## Layers

```text
src/domain/          deterministic types, privacy, time, and scheduling rules
src/application/     learning, review, presentation, and translation services
src/infrastructure/  SQLite repositories and query support
src/ui/              trusted Solid surfaces and conversation renderers
src/index.ts         plugin identity, capabilities, and contributions
```

`definePlugin()` in `src/index.ts` is the public contract and the single source
of plugin identity, capabilities, events, Agents, Tools, operations, and UI
contributions.

## Data ownership

VibeLingo stores plugin-owned data under:

```text
<synergyRoot>/data/plugins/vibe-lingo/
```

Learning state is namespaced by canonical target-language tag and may aggregate
across Scopes where the plugin is enabled. Scope, Session, and message IDs are
provenance, not a second learning profile.

The database never stores complete user messages as part of background
analysis, Agent responses, Session titles, asynchronous prompts, or raw model
output. Bounded correction and review fragments are sanitized before
persistence; visible naturalness explanations are not copied into the plugin
database. Explicit translation history is the single exception: when the user
enables it and invokes translation, the complete normalized selection and
validated translation artifact are stored locally within their public length
limits.

## Failure boundaries

- System transformation and observers fail soft.
- Agent calls happen outside SQLite transactions.
- Synergy owns provider fallback and one lower-level Agent retry; VibeLingo
  bounds its classifier retry and correction-card retry independently.
- Writes are short, transactional, and idempotent.
- Operation queries are abortable and use stable keyset pagination.
- Trusted UI failures do not alter domain state.
- Settings retain a declarative fallback when the custom settings bundle cannot
  load.
- Normal uninstall removes the plugin data directory.

## Public interfaces

The plugin exposes:

- a sidebar learning workspace;
- a selected-text translation action and result popover;
- a foreground language-feedback Tool with a custom message renderer;
- searchable progress and translation-history Tools;
- typed Dashboard, review, translation, pattern, and cleanup operations;
- `learning.changed`, `review.changed`, and `translation.changed` invalidation
  events.

The frontend renders application-service results. It does not reimplement
pattern promotion, evidence classification, scheduling, or review-state rules.

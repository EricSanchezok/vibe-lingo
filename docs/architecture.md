# Architecture

VibeLingo is a Synergy Plugin API 4 plugin. Its architecture keeps foreground
teaching, asynchronous analysis, learning state, review, and translation as
separate paths so that language support cannot block the user's real task.

## Runtime paths

### Foreground coaching

The `chat.system.transform` contribution injects a compact coaching contract
only for eligible, user-facing root Sessions with a complete language profile.
When a correction is useful, the primary Agent calls
`plugin__vibe-lingo__record-correction` before its substantive response. The
Tool card is the authoritative correction the user saw.

The primary Agent supplies only a natural restatement and the visible fragment
pairs. It does not invent pattern keys, severity, confidence, or learning rules.

### Practice observation and analysis

`session.user-message.after` sends eligible messages to a small language
classifier. A target-language attempt contributes activity even when it creates
no finding.

Saved foreground corrections and known-pattern usage are analyzed by owned,
hidden Agents. Sessionless `agent.start()` calls keep this work outside the
foreground response. `agent.call.after` validates and commits results
idempotently. Analysis failures are isolated from the main Session.

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
direction, translation generation, privacy decisions, caching, and history.

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

The database never stores complete user messages, Agent responses, Session
titles, asynchronous prompts, or raw model output. Bounded correction and
review fragments are sanitized before persistence. Translation history stores
a bounded source preview and a validated translated artifact, never the full
selected source.

## Failure boundaries

- System transformation and observers fail soft.
- Agent calls happen outside SQLite transactions.
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
- a foreground correction Tool with a custom message renderer;
- searchable progress and translation-history Tools;
- typed Dashboard, review, translation, pattern, and cleanup operations;
- `learning.changed`, `review.changed`, and `translation.changed` invalidation
  events.

The frontend renders application-service results. It does not reimplement
pattern promotion, evidence classification, scheduling, or review-state rules.

# Synergy Plugin Interaction Hooks — Source Map

## Metadata

- Type: code
- Date captured: 2026-07-26
- Source path: `/Users/eric/projects/synergy`
- Relevant change: PR #749, merge commit `54138ce77bc5720654ad0d9003bedec28ab8006a`
- Reliability: high
- Tags: `synergy-plugin`, `composer`, `corrective-feedback`, `agent-call`, `privacy`

## Why It Matters

Earlier VibeLingo designs assumed that plugins could not observe or assist an unsent draft, could not offer inline completion, and could only analyze a user's language after a conversation turn. That forced Help, Polish, and Explain into explicit agent tools.

PR #749 added a substantially different interaction boundary. A plugin can now participate before, during, and immediately after message submission in the Web Composer. This changes the feasible product shape, not just its implementation.

## Observed Capabilities

### 1. Settled draft observation

- A `ui.composerExtension` receives a host-owned Composer document service.
- `composer.read` exposes immutable snapshots containing revision, text, selection, optional Session identity, and normal/shell mode.
- Draft callbacks run 700 ms after editing settles and do not run while IME composition is active.
- A newer draft aborts the previous callback, preventing stale analysis from continuing indefinitely.

Evidence:

- `docs/plugins/ui-contributions.md:74-83`
- `packages/plugin/src/ui.ts:45-83`
- `packages/app/src/components/prompt-input/composer-document.ts:83-87`
- `packages/app/src/components/prompt-input/composer-document.ts:185-207`
- `packages/app/src/components/prompt-input/composer-document.ts:316-339`

### 2. Completion, decoration, and revision-safe edits

- `composer.write` supports suffix completion at a collapsed caret.
- The host displays completion as ghost text and accepts it with Tab; Escape dismisses it.
- Decorations annotate existing text ranges as info, warning, or error.
- `applyEdits()` rejects stale revisions, overlapping or invalid ranges, and edits crossing non-editable file pills.
- Any document change clears stale completions and decorations.

Evidence:

- `packages/plugin/src/ui.ts:53-83`
- `packages/app/src/components/prompt-input/composer-document.ts:93-107`
- `packages/app/src/components/prompt-input/composer-document.ts:185-233`
- `packages/app/src/components/prompt-input/prompt-input.tsx:1332-1362`
- `packages/app/src/components/prompt-input/prompt-input.tsx:1469-1488`
- `packages/app/src/components/prompt-input/prompt-input.tsx:1844-1850`
- `packages/app/src/index.css:695-705`

### 3. Normal-message preflight

- `composer.intercept` adds an ordered `onBeforeSubmit` callback.
- Normal message submission waits for all active callbacks before creating the Session request.
- The editor is locked while preflight runs; Escape cancels it.
- After callbacks finish, Synergy captures the potentially edited draft again before submitting.
- Failure or cancellation restores the draft instead of losing it.
- Shell input, commands, and workflow-start actions do not enter this path.

Evidence:

- `docs/plugins/ui-contributions.md:76-82`
- `packages/app/src/components/prompt-input/composer-document.ts:236-269`
- `packages/app/src/components/prompt-input/composer-preflight.ts:1-20`
- `packages/app/src/components/prompt-input/submit.ts:247-294`
- `packages/app/src/components/prompt-input/prompt-input.tsx:1469-1475`

### 4. Immediate post-submit observation

- `session.user-message.after` runs asynchronously after an ordinary user message and all its parts are persisted.
- Its input is limited to message ID, text, and creation time; Scope and Session identity come from invocation context.
- It requires `session.read`.
- It excludes synthetic and internal prompts.
- It cannot delay or roll back the Session loop.

Evidence:

- `packages/synergy/src/plugin/hook-points.ts:33-49`
- `packages/plugin/src/contribution.ts:50-80`
- `packages/synergy/src/session/user-message-materialization.ts:1-49`
- `docs/plugins/runtime-and-permissions.md:113-123`

### 5. Message-adjacent UI

- A `ui.messageSlot` can mount trusted, additive content before, after, or in the actions area of user or assistant messages.
- The UI receives message ID and role. Reading content requires a plugin operation backed by `session.read`.
- Slots cannot replace canonical message rendering.

Evidence:

- `docs/plugins/ui-contributions.md:88-91`
- `packages/plugin/src/ui.ts:102-107`
- `packages/app/src/plugin/host.tsx:403-425`

### 6. Selected-text actions

- Settled text selection is available after 250 ms across ordinary DOM text, Composer text, Notes, Monaco source, and Terminal selection.
- Password, credential, explicitly excluded, and selections over 10,000 characters are withheld.
- Plugins may add host-rendered actions to the selected-text context menu.
- A text action receives the exact `{ text }` snapshot and invokes a declared command operation.

Evidence:

- `docs/plugins/ui-contributions.md:84-87`
- `packages/plugin/src/ui.ts:89-100`
- `packages/app/src/context/text-selection.ts:24-49`
- `packages/app/src/plugin/bridge.tsx:118-174`
- `packages/app/src/plugin/host.tsx:381-400`

### 7. Bounded Sessionless Agent calls

- An executable contribution with approved `agent.call` may call an owned hidden Agent or an explicitly allowed Agent.
- The call uses Synergy's Agent/model-role configuration.
- It has no tools, durable Session, transcript, Cortex task, or completion notice.
- Input, output, runtime, retries, and cancellation are bounded by the host.

Evidence:

- `docs/plugins/runtime-and-permissions.md:48-76`
- `packages/synergy/src/agent/call.ts:27-38`
- `packages/synergy/src/agent/call.ts:71-157`
- `packages/synergy/src/plugin/host-services-runtime.ts:88-121`

## Implications for VibeLingo

- Mid-composition support can be a native Composer experience instead of a second chat turn.
- Help and Polish can share one draft-analysis pipeline while still producing different UI behavior.
- Communication-risk feedback can happen before submission; learning-oriented feedback can happen after submission.
- The plugin can analyze only the current draft through a Sessionless call instead of creating hidden transcripts.
- Explain can begin from an exact user selection rather than requiring the user to quote text in a command.
- Post-submit results can be attached to the exact user message rather than injected into the main Agent response.

## Limitations and Risks

- Composer extensions and preflight are Web-only. Text-only surfaces still need explicit tools or commands.
- Completion is suffix-only and only one completion is active according to contribution order.
- The current host renders decoration severity as an underline, but does not visibly present the decoration's `message` or `replacement`. An interactive inline correction experience therefore needs a plugin-owned companion surface or a future host affordance.
- A text action invokes a command but the host does not render its return value. VibeLingo must own where an explanation result appears; this interaction needs prototype validation.
- Preflight has a host timeout of up to 120 seconds, but that is a safety ceiling, not an acceptable language-check latency. The plugin must use a much shorter fail-open budget.
- Preflight callbacks have no host-defined review result. Any “send original / use suggestion” protocol is plugin-owned.
- `session.user-message.after` requires broad `session.read` approval even though its direct payload is intentionally narrow.
- `agent.call`, `composer.write`, and `composer.intercept` are high-trust capabilities in the approval model. Asking for all of them in an MVP may make the trust story harder.
- Draft snapshots and interaction results are transient by host contract. If VibeLingo caches them, it must preserve that lifetime and avoid persistence or diagnostic logging.

## Follow-up Questions

- Is a plugin-owned compact card in `composer.above` sufficient for reviewing a suggestion, or does Synergy need a first-class decoration detail/accept affordance?
- Where should a selected-text explanation appear without forcing the user into a permanent dashboard?
- What latency can users tolerate for ghost completion, explicit draft checking, and submission preflight?
- Can useful post-submit feedback be produced from the narrow hook payload without querying the rest of the Session?
- Which capabilities belong in the first approval request, and which should be deferred?


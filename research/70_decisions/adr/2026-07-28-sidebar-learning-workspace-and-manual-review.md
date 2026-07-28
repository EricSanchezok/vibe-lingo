# ADR: Sidebar Learning Workspace and Manual Review

## Status

Accepted

## Context

VibeLingo v0.3 could support all fourteen approved Figma states, but users still had no direct product surface for seeing a learning journey, inspecting evidence, managing patterns, or starting the prepared review queue. Querying the Progress tool was useful in conversation but could not support browsing, filters, pagination, or a resumable multi-step review.

Synergy Plugin API 3 exposes a trusted `ui.navigationItem`, host-routed plugin pages, theme tokens, plugin operations, event subscriptions, host confirmation, and current-Scope Session navigation. The product design also established that a second sidebar inside the plugin would conflict with Synergy's own navigation.

Pattern labels and rules are canonical internal metadata. Displaying them only in English would make the dashboard harder to understand for learners whose support language is not English, while replacing canonical metadata in storage would weaken analyzer key stability.

## Decision

VibeLingo v0.4 contributes one trusted `VibeLingo` sidebar page. Inside that page:

- Overview, Review, and Learning patterns use a horizontal tab row.
- Journey, record detail, pattern detail, and settings are child routes reached from those views.
- There is one scroll container and no nested sidebar.
- Query parameters contain only validated stable identifiers and filter state.
- Invalid routes recover to the nearest parent view.

Review remains manual:

- the plugin never injects due counts or invitations into chat;
- the Review view shows due and upcoming work;
- the default batch is due-only;
- when explicitly selected, upcoming patterns within seven days may fill a batch to three;
- pausing, abandoning, retrying, conflict recovery, and completion all use the backend state machine as the source of truth.

The dashboard reuses the existing trusted settings component. It does not introduce a second settings schema, controller, save path, or cleanup implementation.

For presentation, keep canonical pattern labels and rules unchanged. A private hidden mini Agent translates or explains them into the configured support language:

- requests are batched, bounded to twenty patterns, and tool-free;
- confidence below `0.90`, invalid output, sensitive output, timeout, or model failure falls back to canonical metadata;
- cache identity includes target language, support language, pattern key, and canonical source metadata;
- changing the canonical label or rule invalidates stale cache entries;
- deleting or clearing a pattern cascades through its presentation rows.

The frontend does not calculate pattern stages, schedules, evidence totals, or review results. It renders typed operation snapshots, uses opaque cursors, aborts stale requests, and refreshes snapshots after `learning.changed` or `review.changed`.

## Rationale

- A stable destination supports overview, reflection, and deliberate practice without interrupting real work.
- Horizontal local navigation preserves Synergy's single global sidebar hierarchy.
- Manual review preserves learner autonomy and the work-first contract.
- Server-owned learning rules prevent browser state from becoming a second domain implementation.
- Canonical metadata plus a separate presentation cache keeps analyzer identity stable while making the product understandable in the learner's support language.
- Reusing settings avoids two sources of truth and keeps the fallback declarative form meaningful.

## Consequences

### Easier

- Users can see progress, revisit evidence, correct false positives, and start review without prompting the chat Agent.
- Every approved Figma state maps to a real route and typed operation.
- Switching target languages changes the dashboard namespace without mixing records.
- Presentation failures degrade to readable canonical metadata.
- Layout, accessibility, and interaction behavior can be tested independently from the hidden Agents.

### Harder

- The trusted UI surface adds responsive, theme, keyboard, and host-version testing obligations.
- A private presentation Agent adds a small lazy model cost for uncached, non-English support languages.
- Current-Scope Session titles remain the only titles that can be resolved safely.
- Query-string routes are intentionally shallow and do not provide a separate browser history system beyond the host page contract.

## Evidence

- Final VibeLingo Figma page: `https://www.figma.com/design/PJdPhrIuBvUs66Yz9pUe6E?node-id=44-2`
- `research/70_decisions/adr/2026-07-28-evidence-learning-loop-and-review-backend.md`
- `research/80_synthesis/product-briefs/2026-07-28-backend-capability-and-robustness-audit.md`
- `/Users/eric/projects/synergy/docs/plugins/ui-contributions.md`
- `/Users/eric/projects/synergy/packages/app/src/plugin/host.tsx`
- `/Users/eric/projects/synergy/packages/plugin/src/ui.ts`

## Revisit Trigger

Revisit if Synergy publishes nested plugin navigation, a formal locale service, or richer plugin route state; if users want automatic reminders despite interruption costs; or if pattern-presentation accuracy is insufficient for important support languages.

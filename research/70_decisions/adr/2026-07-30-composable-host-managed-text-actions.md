# ADR: Composable Host-Managed Text Actions

## Status

Accepted

## Context

VibeLingo needs selected-text translation, but a plugin-specific context menu or self-positioned overlay would compete with native edit commands and other plugins. Selection ownership, input privacy, focus restoration, viewport collision, keyboard access, narrow screens, cancellation, reload, and renderer failures are host concerns. A single replaceable context-menu slot would also make independently installed plugins overwrite one another.

## Decision

Synergy Plugin API 4 treats `ui.textAction` as an additive registry:

- the true identity is `pluginId + actionId`;
- native edit commands remain first and plugin actions are grouped and stably ordered;
- declarative `when` constraints are evaluated by the host against an immutable selection snapshot;
- DOM, input/textarea, Monaco, and Terminal selections share one owner-aware controller, while sensitive inputs and embedded Browser pages remain excluded;
- an optional `popover` presentation delegates positioning, loading, errors, retry, cancellation, focus, ARIA, and narrow-screen behavior to Synergy;
- the plugin receives only the frozen selection, validated operation output, and a close action, and renders only result content;
- reload, disable, and uninstall remove and cancel only the owning plugin's work.

VibeLingo contributes one `translate-selection` action and a trusted translation result component. It does not recreate Synergy menu or overlay infrastructure.

## Rationale

Composition prevents plugin collisions. Host ownership provides one consistent interaction and security boundary across all plugin actions. A finite operation plus loading state is sufficient for v0.7 and avoids introducing a translation-specific streaming protocol into the generic plugin system.

## Consequences

- Synergy and VibeLingo v0.7 must ship as a paired API/runtime upgrade.
- Plugins may use the same local action ID or label without replacement.
- Browser iframe selection remains unsupported.
- Only one text-action result surface is visible at a time.
- Streaming can be considered later only as a generic operation capability.

## Evidence

- `/Users/eric/projects/synergy/packages/plugin/src/contribution.ts`
- `/Users/eric/projects/synergy/packages/app/src/context/text-selection.ts`
- `/Users/eric/projects/synergy/packages/app/src/plugin/text-action-surface.tsx`
- `research/20_synergy-platform/source-map/2026-07-30-composable-text-actions-and-model-roles.md`

## Revisit Trigger

Revisit if several real plugins need concurrent result surfaces, embedded Browser selection, or incremental operation output that cannot be represented by a bounded request/response operation.

# Synergy Composable Text Actions and Model Roles

## Metadata

- Type: code
- Date captured: 2026-07-30
- Source path: `/Users/eric/projects/synergy`
- Reliability: high
- Tags: `synergy-plugin`, `privacy`, `agent-memory`

## Why It Matters

VibeLingo v0.7 depends on selected-text actions that coexist across plugins, a host-owned result surface, and safe per-workload model-role selection.

## Key Claims

- Plugin API 4 describes selections with source, origin, editability, whole-container state, and a host-generated identity.
- Text actions are additive by `pluginId + actionId`, support host-evaluated applicability constraints, and can request a host-managed popover.
- The App owns selection anchoring, context-menu grouping, loading/error state, accessibility, viewport collision, cancellation, and plugin lifecycle cleanup.
- `agent.call` and `agent.start` may request only a public model role allowed by capability constraints; the host owns role fallback and concrete-model resolution.

## Evidence / Details

- Public contracts: `/Users/eric/projects/synergy/packages/plugin/src/contribution.ts`, `context.ts`, `ui.ts`, and `plugin-types.ts`.
- Descriptor and package validation: `/Users/eric/projects/synergy/packages/plugin/src/descriptor.ts` and `/Users/eric/projects/synergy/packages/plugin-kit/src/commands/validate.ts`.
- Selection/action registry: `/Users/eric/projects/synergy/packages/app/src/context/text-selection.ts`.
- Host result state machine: `/Users/eric/projects/synergy/packages/app/src/plugin/text-action-surface.tsx`.
- Role enforcement and resolution: `/Users/eric/projects/synergy/packages/synergy/src/plugin/host-services-runtime.ts` and `agent/call.ts`.

## Implications for VibeLingo

- VibeLingo should contribute content and business operations, not build a second context-menu or overlay controller.
- Translation can use the same bounded Agent infrastructure as the learning workloads while exposing a user-selectable role rather than a provider/model ID.
- Browser iframe selection remains outside the current trusted surface.

## Limitations

- Operation results are finite; there is no incremental/streamed output contract.
- The Host allows only one active text-action result surface.
- The API does not make plugin code an OS-level sandbox.

## Follow-up Questions

- Is a generic incremental operation protocol justified by multiple plugins?
- Should Browser pages expose a separately permissioned selection bridge?

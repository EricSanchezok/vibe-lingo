# Sessionless Agent Start and Owned Tool Renderers

## Metadata

- Type: code
- Date captured: 2026-07-30
- Source path: `/Users/eric/projects/synergy`
- Reliability: high
- Tags: `synergy-plugin`, `agent-memory`, `privacy`

## Why It Matters

VibeLingo needs foreground correction to return immediately while private metadata analysis continues without creating a Cortex task, Session transcript, or durable full-message job.

## Observed Host Contract

- `context.agent.start()` shares the approved `agent.call` capability, hidden-Agent ownership checks, and runtime/input/output limits.
- It requires a correlation ID and returns a call ID after in-memory Host acceptance.
- Active calls are owned by plugin ID, generation, and Scope, use an independent `AbortController`, and are limited to four per plugin without a queue.
- Terminal results are directed to the same plugin generation through `agent.call.after`.
- Runtime generation replacement and stop cancel active calls.
- The Agent call uses no tools and does not create a durable Session or Cortex task.
- Agent-invoked plugin Tools receive the assistant message ID plus the Host-resolved source user message ID.
- `ui.messageRenderer` can target an exact host Tool name only when that Tool is contributed by the same plugin. The trusted component receives bounded Tool input/output/metadata/status and falls back to the native card if loading fails.

## Relevant Source

- `/Users/eric/projects/synergy/packages/plugin/src/context.ts`
- `/Users/eric/projects/synergy/packages/plugin/src/contribution.ts`
- `/Users/eric/projects/synergy/packages/plugin/src/ui.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/agent-call-runtime.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/host-services-runtime.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/plugin/lifecycle.ts`
- `/Users/eric/projects/synergy/packages/synergy/src/tool/registry.ts`
- `/Users/eric/projects/synergy/packages/app/src/plugin/host.tsx`
- `/Users/eric/projects/synergy/packages/app/src/plugin/registries/tool-renderer-registry.ts`

## Implications for VibeLingo

- Commit visible correction pairs before calling `agent.start`.
- Persist correlation/status, never the transient prompt or output.
- Treat `agent.call.after` as at-least-once from the plugin's perspective and keep writes idempotent.
- Accept loss of usage analysis on Host restart; recover only correction work whose bounded source pairs are already durable.
- Render card input as the useful fallback and use typed status queries/events only for enrichment.

## Limitations

- The call is not durable across Synergy restart.
- Completion delivery is generation-directed; a replaced generation may leave plugin-owned pending state for the next generation to recover.
- The concurrency limit deliberately rejects instead of queueing.

# Synergy Plugin System — Source Map

> Date: 2026-07-07
> Source: `C:\Eric\projects\synergy`

## Repository Structure

```
C:\Eric\projects\synergy/
  packages/
    plugin/           ← Plugin type definitions & SDK
      src/
        index.ts      ← PluginDescriptor, PluginHooks, PluginInput (618 lines)
        hooks.ts      ← Hook descriptors + BUS_EVENT_NAMES (308 lines)
        manifest.ts   ← PluginManifest Zod schema (543 lines)
        tool.ts       ← ToolDefinition, ToolContext (146 lines)
        example.ts    ← Complete reference plugin example (99 lines)
        spec.ts, permissions.ts, policy.ts, display.ts, shell.ts, ...
    sdk/
      js/src/
        client.ts     ← createSynergyClient
        gen/sdk.gen.ts ← Auto-generated SDK with all REST APIs
        gen/types.gen.ts ← Type definitions
    plugin-kit/       ← Plugin build/runtime tooling
    app/              ← Synergy web app (UI)
    synergy/          ← Synergy server/CLI
```

## Key Type Locations

| Type | File | Lines |
|------|------|-------|
| `PluginDescriptor` | `packages/plugin/src/index.ts` | 418-425 |
| `PluginInput` | `packages/plugin/src/index.ts` | 390-412 |
| `PluginHooks` | `packages/plugin/src/index.ts` | 459-617 |
| `HookDescriptor` + `HOOKS[]` | `packages/plugin/src/hooks.ts` | 13-189 |
| `BUS_EVENT_NAMES` | `packages/plugin/src/hooks.ts` | 195-294 |
| `PluginManifest` | `packages/plugin/src/manifest.ts` | 265-542 |
| `ToolDefinition` + `ToolContext` | `packages/plugin/src/tool.ts` | 7-146 |
| `SynergyClient` | `packages/sdk/js/src/gen/sdk.gen.ts` | (auto-generated, ~2000+ lines of REST client methods) |

## Entry Points

- Plugin init: `PluginDescriptor.init(input: PluginInput): Promise<PluginHooks>`
- Plugin main file resolved via `spec.ts` → `package.json` exports/main → `src/index.ts` → `index.ts`
- Runtime modes: `in-process` | `worker` | `process` (configured in manifest)

## Key APIs Available to Plugins

Plugins receive `PluginInput` containing:
- `client: SynergyClient` — Full REST SDK access
- `scope` — Home/project scope info
- `config: PluginConfigAccessor` — Persistent config key-value store
- `auth: PluginAuthStore` — Credential store (plaintext JSON)
- `cache: PluginCacheStore` — In-memory/disk cache with TTL support
- `$: BunShell` — Shell execution through Synergy workspace boundary

## What VibeLingo Needs vs. Where It Lives

| Need | Synergy Mechanism | Source Location |
|------|------------------|-----------------|
| Intercept user messages | `chat.message` hook | `index.ts:479-488` |
| Observe agent responses | `session.turn.after` hook | `index.ts:527-537` |
| Register custom tools | `tool()` function | `tool.ts:134-142` |
| Store vocabulary (structured) | Notes system | `index.ts:571-594` (6 hooks) |
| Store preferences (key-value) | PluginConfigAccessor | `index.ts:39-43` |
| Schedule reviews | Agenda system | `index.ts:541-569` (3 hooks) |
| Modify agent behavior | `experimental.chat.system.transform` | `index.ts:512-515` |
| Transform conversation history | `experimental.chat.messages.transform` | `index.ts:507-510` |
| Access conversation data | `data.session: "read"` permission | `manifest.ts:212-214` |
| Call subagent for analysis | `context.task` | `tool.ts:18` |

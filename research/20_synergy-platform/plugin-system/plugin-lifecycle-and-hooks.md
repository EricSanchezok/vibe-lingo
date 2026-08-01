# Plugin Lifecycle & Hook System

> Historical API2-era source note. The current implementation uses generated Plugin API 4 contributions and the stable `chat.system.transform` hook; see `../source-map/plugin-source-map.md` and `../../60_evidence-bank/docs/2026-08-01-synergy-plugin-api4-stability.md`. The lifecycle and hook inventory below is retained only as chronology, not current implementation guidance.

## Summary

Synergy plugins follow a simple lifecycle: `init(ctx) → { hooks }`. The `PluginHooks` object returned by `init()` defines what the plugin does — it registers tools, agents, skills, and subscribes to lifecycle hooks. 28 hooks across 10 categories give plugins extensive access to the Synergy runtime, including conversation interception, tool execution interception, storage observation, and permission overrides. VibeLingo can use chat hooks for its three core features (input assistance, expression polish, comprehension support) and storage hooks for persistence.

## Plugin Lifecycle

```
Install → Load → init(ctx) → hooks registered → runtime active → dispose()
```

- **Install**: Triggered on first install; can run `lifecycle.install` script
- **Load**: `init(ctx)` called. Plugin receives `PluginInput` (client, scope, config, auth, cache, shell)
- **Runtime**: Hooks fire as events occur in Synergy. Plugin responds.
- **Update**: `lifecycle.update` script runs; new `init()` replaces old hooks
- **Uninstall**: `lifecycle.uninstall` script; plugin stops
- **Dispose**: `dispose()` hook called before plugin is unloaded (e.g., on runtime reload)

## Hook Categories

| Category | Hooks | Mutates |
|----------|-------|---------|
| **core** | tool, auth, provider, config, event | Varies |
| **chat** | chat.message, chat.params | ✅ Both |
| **permission** | permission.ask | ✅ |
| **tool** | tool.execute.before, tool.execute.after | ✅ Both |
| **session** | session.turn.after | ❌ Observe only |
| **cortex** | cortex.task.after | ❌ Observe only |
| **agenda** | agenda.run.before/after/error | before mutates |
| **note** | note.create/update/search .before/.after | All mutates output |
| **library** | library.memory.search.before/.after, library.experience.encode.after | Varies |
| **experimental** | chat.messages.transform, chat.system.transform, session.compacting, text.complete | All mutate |

## VibeLingo's Critical Hooks (in priority order)

### 1. `chat.message` — rewrite incoming user messages
```ts
"chat.message"?(
  input: { sessionID, agent?, model?, messageID?, variant? },
  output: { message: UserMessage, parts: Part[] }
): Promise<void>
```
- **VibeLingo use cases**: Detect target-language usage, inject translation assistance, offer composition help
- **Mutates**: ✅ Full access to rewrite user message and parts
- **CAUTION**: Must not break the user's intended communication. Use augmentation, not replacement.

### 2. `session.turn.after` — observe completed assistant turns
```ts
"session.turn.after"?(
  input: { sessionID, userMessageID, assistantMessageID, assistant: Message, finish?, error? },
  output: {}
): Promise<void>
```
- **VibeLingo use cases**: Analyze agent response for vocabulary capture, track language usage patterns, queue comprehension offers
- **Mutates**: ❌ Observation only — cannot modify the response after it's sent. **This is critical: plugin cannot retroactively add translations to an already-sent message.**
- **Workaround**: Must intercept BEFORE the response is finalized (using experimental hooks) or offer comprehension help as a separate tool call.

### 3. `experimental.chat.messages.transform` — rewrite conversation history
```ts
"experimental.chat.messages.transform"?(
  input: {},
  output: { messages: { info: Message, parts: Part[] }[] }
): Promise<void>
```
- **VibeLingo use cases**: Inject translations inline into the conversation history seen by the model; annotate messages with language metadata
- **Mutates**: ✅ Full access to message history
- **Risk**: Experimental API — may change in future Synergy versions

### 4. `experimental.chat.system.transform` — rewrite system prompt
```ts
"experimental.chat.system.transform"?(
  input: { phase, sessionID, agent, model, messageID?, small? },
  output: { system: string[] }
): Promise<void>
```
- **VibeLingo use cases**: Inject language-learning guidance into the agent's system prompt (e.g., "when the user writes in English, provide brief corrections")
- **Mutates**: ✅
- **Risk**: Experimental API

### 5. `tool.execute.after` — rewrite tool output
```ts
"tool.execute.after"?(
  input: { tool, sessionID, callID },
  output: { title, output, metadata }
): Promise<void>
```
- **VibeLingo use cases**: Annotate tool call results with language tips or translations
- **Mutates**: ✅

## What Plugins CANNOT Do (Architectural Limits)

1. **Cannot modify already-sent agent responses**: `session.turn.after` is observation-only. Once the assistant message is emitted to the UI, it's immutable from the plugin's perspective. ✗
2. **Cannot inject UI elements into the chat directly**: Plugins can contribute panels, settings, commands, and message slots, but cannot dynamically insert UI elements into the chat flow. The UI contribution is declarative (manifest), not runtime-dynamic. ✗
3. **Cannot call agent tools on behalf of the user**: Plugin tools are invoked BY the agent, not by the plugin. The plugin registers tools; the agent decides when to call them. ✗
4. **Cannot force the agent to respond in a specific way**: Hooks can modify prompts and parameters, but cannot deterministically control agent behavior. ✗
5. **Cannot access conversation content without permission**: `data.session: "read"` must be declared in manifest and approved by user. ✓ (by design)

## VibeLingo Interaction Patterns vs. Hook Mapping

| Pattern | Best Hook | Limitation |
|---------|-----------|------------|
| Input assistance (help me say...) | `tool` (register `lingo_help`) | Agent must invoke tool; user can trigger via @mention |
| Expression polish (inline) | `chat.message` + `tool.execute.after` | Polish as tool output, not inline reply modification |
| Comprehension support (translate) | `experimental.chat.messages.transform` OR `tool` (register `lingo_explain`) | Experimental hook fragile; tool approach more robust |
| Vocabulary capture (automatic) | `session.turn.after` → analyze → `note.create` | Requires async write; can't modify current turn |
| Review scheduling | `agenda.run.before` + SDK `agenda_create` | Fully capable |
| Word book display | UI Panel (manifest) + Notes | Panel is separate UI surface, not inline chat |

## Recommendation

Use a **hybrid architecture**:
- **Explicit tools** (`lingo_help`, `lingo_polish`, `lingo_explain`): User-triggered, reliable, no experimental API dependency
- **chat.message hook**: Lightweight pre-processing (detect language, inject subtle nudges)
- **session.turn.after**: Background analysis (vocabulary capture, error tracking, progress updates)
- **Agenda + Notes**: Persistence and review scheduling
- **Experimental hooks**: Defer until stable; use as optional enhancements

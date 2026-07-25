# Conversation Surfaces & Channels

## Summary

Synergy supports multiple conversation surfaces (web app, Feishu/Lark, terminal) and channels. Plugins work across all surfaces transparently — hooks fire regardless of where the conversation originates. VibeLingo's interaction design should be surface-agnostic, but the UX considerations differ by surface. The web app offers the richest plugin UI possibilities (panels, message slots, tool renderers), while Feishu/terminal are text-only.

## Conversation Surfaces

| Surface | Rich UI | Plugin UI | Plugin Tools | Chat Hooks | Best For |
|---------|---------|-----------|-------------|------------|----------|
| **Web App** | ✅ Full | ✅ Panels, slots, settings, routes | ✅ Full | ✅ Full | Primary development surface |
| **Feishu/Lark** | Limited (Markdown) | ❌ No panels/slots | ✅ (text output) | ✅ Full | Notifications, quick reviews |
| **Terminal (TUI)** | Text-only | ❌ No panels | ✅ (text output) | ✅ Full | Power users |

## Plugin UI Contributions (Web App Only)

Plugins can contribute to the web app UI via manifest `contributes.ui`:

| Contribution | What It Adds | VibeLingo Use |
|-------------|-------------|---------------|
| `workbenchPanels` | Side/bottom panels | Word book browser, review dashboard |
| `settings` | Plugin settings page | Language, level, frequency configuration |
| `messageSlots` | Slots in message cards (before/after reasoning, before/after tools) | "Polish" button on user messages |
| `commands` | UI commands | Quick actions: "Start review", "Show vocabulary" |
| `toolRenderers` | Custom rendering for tool output | Rich vocabulary card display |

### VibeLingo Panel Ideas

1. **Word Book Panel** (side panel): Browse vocabulary, see review schedule, manually add/remove words
2. **Progress Dashboard** (side panel): Words learned, review streaks, error improvement trends
3. **Review Panel** (bottom panel): Active recall quiz interface triggered by agenda

## Key Limitation: No Dynamic Inline UI

Plugins CANNOT dynamically inject UI into the conversation thread. The interaction model is:

- **Plugin tools** output text (which the agent interprets and may present to the user)
- **Message slots** are static, declarative, and cannot be conditionally shown/hidden at runtime
- **Workbench panels** are separate surfaces, not inline with the conversation

This means VibeLingo's inline assistance must work through one of:
1. **Tool calls**: Agent calls `lingo_help`/`lingo_polish`/`lingo_explain` → output appears as tool result in conversation
2. **chat.message hook**: Plugin modifies the user's sent message before processing (can add prefixes/annotations)
3. **Message slots**: Static buttons ("Polish", "Translate") that trigger tool calls

### Recommended Pattern: Hybrid

```
User sends message in target language
    ↓
chat.message hook detects language, adds subtle annotation:
  "Note: VibeLingo detected Spanish (intermediate). Polish available."
    ↓
Agent responds normally
    ↓
User can: @vibe-lingo polish | @vibe-lingo explain <term>
    ↓
Plugin tools execute, output appears inline
```

## Channel Events

Plugins can observe channel events via `core.event` hook (must declare `hooks.events: "selected"` and `hooks.eventNames: [...]` in permissions):

| Event | Description | VibeLingo Use |
|-------|-------------|---------------|
| `channel.connected` | Channel connected | Initialize per-channel state |
| `channel.message.received` | Message received from channel | Detect incoming messages for analysis |
| `channel.command.executed` | Channel command executed | Track user engagement |

**Important**: Channel events are observation-only (core.event hook). They cannot modify channel messages in transit. Chat hooks (`chat.message`, `session.turn.after`) fire regardless of channel — those are the primary interception points.

## Cross-Surface Consistency

VibeLingo must work consistently:
- **Web app**: Rich experience with panels + inline tool output
- **Feishu**: Text-only — rely entirely on tool calls and agenda notifications
- **Terminal**: Same as Feishu

The plugin core logic should be surface-agnostic. UI contributions (panels, settings) enhance the web app experience but are not required for core functionality.

### Feishu-Specific Considerations

- No UI panels — review must be triggered via command or agenda notification
- Markdown rendering for tool output — keep formatting simple
- Message length limits — concise output preferred
- Session context: channel session vs. DM session — different user expectations
- **This aligns with the SLA feedback timing research**: on constrained surfaces, prefer deferred feedback at session boundaries over inline intervention

## Event Bus (98 Events Available)

The event bus provides runtime observation of nearly all Synergy state changes. Key events for VibeLingo:

| Event | Signal |
|-------|--------|
| `session.updated` | New messages in session |
| `session.idle` | Session idle — good time for review prompt |
| `session.compacted` | Session compacted — vocabulary extracted, context lost |
| `message.updated` | Message content changed |
| `note.created` / `note.updated` | Word book mutation confirmed |
| `agenda.item.created` / `agenda.item.updated` | Review schedule changed |
| `config.updated` | Plugin settings changed |

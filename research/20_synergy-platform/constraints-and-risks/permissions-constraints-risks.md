# Permissions, Constraints & Risks

## Summary

VibeLingo needs specific permissions to function. The Synergy permission model requires explicit declaration in the plugin manifest (`plugin.json`), and users must approve these permissions at install time (and on update if permissions change). This is both a design constraint (limit what we ask for) and a trust mechanism (users know exactly what the plugin can access).

## Required Permissions

### Minimum Viable Permissions

| Permission | Value | Why VibeLingo Needs It |
|-----------|-------|------------------------|
| `permissions.data.session` | `"read"` | Read user/agent messages in current session |
| `permissions.data.workspace` | `"metadata"` | Detect active project context |
| `permissions.data.config` | `"plugin"` | Read/write VibeLingo's own config |
| `permissions.hooks.promptTransform` | `true` | Enable `chat.message` and `experimental.chat.messages.transform` |
| `permissions.hooks.toolExecute` | `"own"` | Intercept VibeLingo's own tool executions |
| `permissions.hooks.eventNames` | `["session.updated", "session.idle", "note.created"]` | Observe runtime state |

### Optional Permissions (Phase 2+)

| Permission | Value | Use |
|-----------|-------|-----|
| `permissions.tools.network` | `true` | Call external translation/dictionary APIs |
| `permissions.network.connectDomains` | `["api.lingo.example"]` | Specific API domains |
| `permissions.hooks.compactionTransform` | `true` | Preserve vocabulary during session compaction |
| `permissions.ui.workbenchPanels` | `true` | Word book panel |
| `permissions.ui.settings` | `true` | Plugin settings page |
| `permissions.ui.messageSlots` | `true` | "Polish" button on messages |

## Trust Tier & User Approval

- **Default tier**: `"declarative"` — tools-only, no hook access
- **Required tier**: Must request `"trusted-import"` to use chat hooks and session data
- **Trust request**: Manifest `trust.requestedTier: "trusted-import"` with a `trust.reason` explaining why
- **User approval**: User sees a permission diff at install/update and must explicitly approve

### VibeLingo Trust Narrative

```
trust: {
  requestedTier: "trusted-import",
  reason: "VibeLingo needs to read your conversation to detect language-learning 
           opportunities and provide writing assistance. It never stores your 
           full messages — only extracted vocabulary and grammar patterns."
}
```

The trust narrative is critical — it's the first thing users see. Must clearly communicate:
1. **What we access**: Session messages, for language analysis
2. **What we store**: Vocabulary, error patterns (NOT conversation history)
3. **What we DON'T do**: Never send data externally, never store full conversations, never read unrelated sessions

## Constraints

### Technical Constraints

1. **`session.turn.after` is observation only**: Cannot modify agent responses after they're sent. Comprehension support must work through tool calls or experimental hooks.

2. **No inline dynamic UI**: Cannot inject buttons or interactive elements into the conversation thread. All interaction goes through tools or message slots.

3. **Experimental hooks are unstable**: `chat.messages.transform` and `chat.system.transform` may change or be removed. Core features should not depend on them.

4. **Hook timing is non-deterministic**: Hooks fire asynchronously. Don't depend on exact timing for critical behavior.

5. **Plugin runtime is isolated**: Plugin code runs in its own process/worker. Cannot share state across plugin instances in different scopes.

### Design Constraints

1. **Permission ask is a trust tax**: Every requested permission increases the barrier to installation. Minimize the permission surface.

2. **User consent is explicit and revocable**: Users can disable the plugin at any time. Design for graceful degradation.

3. **Privacy by design**: Must never store raw conversation content. Extract only what's needed for learning.

4. **Surface-agnostic core**: Plugin core should work on all surfaces. UI extras are web-app-only.

5. **No server-side processing**: Everything runs locally. No external API calls by default.

## Risks

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Experimental hooks removed | Comprehension support breaks | Core features use stable hooks only; experimental hooks are optional enhancements |
| Permission too broad → user rejects | Zero adoption | Request minimal permissions; clearly justify each one |
| Plugin interferes with agent behavior | Degraded user experience | Thorough testing of hook interactions; fail-safe defaults |
| Vocabulary note grows too large | Performance degradation, search failures | Partition by language/date; archive old entries |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| `chat.message` hook latency slows message processing | User perceives lag | Keep hook logic lightweight; defer heavy processing to session.turn.after |
| Agenda scheduling conflicts with user's working patterns | Reviews fire at bad times | `agenda.run.before` checks context before triggering review |
| Plugin conflicts with other plugins using same hooks | Unpredictable behavior | Document hook interactions; test with popular plugins |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notes API changes | Review queue data format incompatibility | Use stable note structure; version the schema |
| Memory limits on cache | Session-scoped caches overflow | TTL-based cleanup; LRU eviction |

## Privacy Design Principles

1. **Extract, don't store**: Parse vocabulary from messages, store extracted data, discard the raw message
2. **Local only**: No external API calls for core functionality. Optional: user-configurable translation API.
3. **User-owned data**: Vocabulary data lives in user's Synergy scope. User can export/delete at any time.
4. **Transparent operation**: All data storage is visible through the word book panel. Nothing is hidden.
5. **Consent-first**: Data collection is opt-in. Users can use explicit tools without background analysis.

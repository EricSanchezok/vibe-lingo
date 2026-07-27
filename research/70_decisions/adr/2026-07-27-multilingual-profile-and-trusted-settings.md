# ADR: Multilingual Learning Profiles and Trusted Settings

## Status

Accepted

## Context

VibeLingo `0.1.0` proved the prompt-first foreground/background workflow, but it exposed only correction and tracking switches. The implementation hard-coded English as the target language and implicitly treated Chinese as the learner's support language.

That created three connected problems:

1. the plugin could not safely describe who was learning which language or tune feedback to a self-reported level;
2. stored patterns and progress queries could not switch cleanly between target languages;
3. the declarative settings form produced an overly wide, implementation-shaped page and could not express first-time activation, searchable language selection, a compact data summary, or confirmed cleanup.

Synergy Plugin API 3 now provides the required public contracts: a trusted settings component, atomic settings replacement, UI-only operations, host notifications and confirmation, and semantic theme tokens. The component receives a flat `PluginSurfaceContext` in the current host, while the plugin template documentation has also shown a `{ context }` wrapper shape.

## Decision

VibeLingo `0.2.0` requires an explicit multilingual learning profile before coaching or tracking begins:

```text
nativeLanguage: canonical BCP-47 tag
targetLanguage: canonical BCP-47 tag
proficiency: beginner | intermediate | advanced
```

Configuration is complete only when both tags are valid, canonical, and different. `Intl.getCanonicalLocales()` is the source of validity and canonicalization; pure undefined/private-use input is not accepted. `Intl.DisplayNames` produces localized display names, so raw user text is never inserted into Agent prompts as a language name.

The language pair and proficiency must flow through every behavior:

- the foreground coaching contract;
- the hidden analyzer request and language-aware prefilter;
- SQLite message, pattern, occurrence, recurring-focus, and retention queries;
- progress and compact summary results;
- target-specific cleanup.

Learning data is grouped globally by canonical target-language tag. Scope-specific settings select the active namespace; changing target language does not delete older namespaces.

The plugin provides a trusted Solid settings component while retaining `formSchema` as a failure fallback. The component:

- uses only Synergy semantic tokens and restrained, flat settings sections;
- localizes to Simplified Chinese or English without private App context;
- supports a searchable, keyboard-accessible language combobox;
- atomically saves the first complete profile;
- handles loading, saving, external settings updates, rollback, empty history, and operation failures;
- delegates destructive confirmation and notifications to host actions;
- shows only a compact data summary rather than becoming a dashboard.

The component accepts both the actual flat `PluginSurfaceContext` and a `{ context }` wrapper for compatibility.

## Rationale

- A language coach needs a declared support language and target language; inferring either from one message is unreliable and can make explanations or corrections inappropriate.
- A required first save is a clear consent boundary for both coaching and local learner tracking.
- BCP-47 tags provide a stable multilingual identifier without maintaining a proprietary language taxonomy.
- Three broad proficiency levels provide useful prompt adaptation without claiming an assessed CEFR level.
- Target-language namespaces let one user practice several languages without mixing patterns or deleting earlier history.
- A trusted settings component is justified by activation, language search, summary operations, and destructive confirmation, while a declarative fallback preserves recoverability.
- Keeping full history in the conversational Progress tool prevents the settings page from turning into a second product surface.

## Consequences

### Easier

- Supporting any language tag that the runtime and selected model can handle.
- Switching languages without mixing recurring patterns.
- Explaining feedback in the learner's chosen support language.
- Providing an intentional first-run and data-deletion experience.
- Preserving access to core settings if the custom bundle fails.

### Harder

- Analysis quality varies across target languages and mini models.
- Languages sharing a writing system require the hidden Agent, not only a deterministic prefilter, to identify genuine attempts.
- The trusted component adds a UI bundle, Solid dependency, permissions, operations, accessibility obligations, and host-compatibility tests.
- `document.documentElement.lang` is only a temporary locale bridge and does not provide live locale-service semantics.
- A Scope can select a target whose history was collected in other enabled Scopes; this aggregation must remain clear and privacy-bounded.

### Upgrade and migration

- SQLite schema version 1 migrates to version 2; existing messages are assigned to `en`, and existing English patterns, provenance, and retained examples remain intact.
- Existing installations remain inactive until the user explicitly chooses a valid language pair.
- The added `settings.write` and `ui.hostActions` capabilities plus the trusted UI bundle change approval and integrity hashes, so the plugin requires reapproval.

## Evidence

- Accepted prompt-first foundation: `research/70_decisions/adr/2026-07-26-prompt-first-language-coaching.md`
- Synergy surface contract: `/Users/eric/projects/synergy/packages/plugin/src/ui.ts`
- Synergy settings bridge: `/Users/eric/projects/synergy/packages/app/src/plugin/surface-settings.ts`
- Synergy trusted component loader: `/Users/eric/projects/synergy/packages/app/src/plugin/host.tsx`
- Synergy settings layout and semantic tokens: `/Users/eric/projects/synergy/packages/app/src/components/settings/settings-panel.css`
- Implementation and behavioral tests in `src/` and `test/`
- Local visual and keyboard dogfood on 2026-07-27: first activation, configured state, dark theme, and 680px responsive layout.

## Revisit Trigger

Reopen this decision if:

- Synergy publishes a formal plugin locale service;
- `Intl` tag support is too permissive or too limited for user expectations;
- model quality for important non-English targets is consistently below the usefulness threshold;
- users need separate profiles for dialect, writing system, or learning goal within one target-language tag;
- compact settings data controls are insufficient and evidence supports a dedicated progress surface;
- the trusted component cannot remain visually or behaviorally compatible with supported Synergy versions.

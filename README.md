# VibeLingo

VibeLingo is a prompt-first multilingual coaching plugin for Synergy. It keeps the primary Agent focused on real work, adds brief language feedback when useful, and privately tracks recurring patterns by target language.

## Requirements

- Synergy `>=3.0.0`
- Bun `>=1.3.0`

## How It Works

VibeLingo has two independent paths:

1. A system-transform hook gives the primary Agent a compact, work-first coaching contract for the configured language pair and proficiency.
2. A continuing user-message observer asks a private hidden Agent to extract structured target-language signals after the message has already been submitted.

Clear tasks continue immediately. Genuine task ambiguity is clarified. Correct target-language writing, instructions written only in the support language, child Sessions, small internal calls, and escape-hatch messages stay out of the teaching flow.

VibeLingo does not provide Composer completion, submission interception, inline editor decorations, a full dashboard, vocabulary review, or spaced repetition.

## Install for Local Development

```bash
bun install
bun run build
synergy plugin add file:///Users/eric/projects/vibe-lingo
synergy plugin approve vibe-lingo
```

For isolated development:

```bash
export SYNERGY_HOME="$(mktemp -d)"
bun run dev -- --server-url http://127.0.0.1:PORT
```

Version `0.2.0` adds `settings.write`, `ui.hostActions`, two UI-only operations, and a trusted UI bundle. Its manifest, permission hash, and trusted UI hash differ from `0.1.0`, so an existing installation must be approved again.

## First-Time Setup

VibeLingo does not coach or analyze messages until the user saves a complete learning profile:

```jsonc
{
  "nativeLanguage": "zh-Hans", // support/explanation language
  "targetLanguage": "en",      // language being practiced
  "proficiency": "intermediate"
}
```

Language values are canonical BCP-47 tags supported by the current JavaScript `Intl` runtime. Common languages are searchable, and valid tags such as `pt-BR` or `tlh` can be entered directly. The two languages must be different.

The settings page includes English and Simplified Chinese copy. Before setup it follows `document.documentElement.lang`; after setup it uses Chinese for a Chinese support language and otherwise falls back to English. Language names come from `Intl.DisplayNames`.

Non-English targets use the same contract, privacy rules, and isolated storage model as English. Classification quality still depends on the configured mini model, and equal quality across every `Intl`-supported language is not claimed.

## Settings

The complete settings shape is:

```jsonc
{
  "nativeLanguage": "zh-Hans",
  "targetLanguage": "en",
  "proficiency": "intermediate", // beginner | intermediate | advanced
  "correctionMode": "focused",   // focused | strict | off
  "trackingEnabled": true,
  "recurringFocusEnabled": true
}
```

- `beginner` prioritizes simple, usable phrasing and foundational corrections.
- `intermediate` prioritizes clear, transferable high-value feedback.
- `advanced` prioritizes nuance, collocation, register, and natural phrasing.
- `focused` ignores isolated minor slips and shows at most one compact correction.
- `strict` handles every certain target-language error and shows at most two compact corrections.
- `off` disables foreground coaching without deleting or disabling background tracking.
- Turning tracking off stops new analysis but retains existing local data.
- Turning recurring focus off stops injecting established patterns but does not delete them.

Changing the target language switches to that language's learning-data namespace. It does not delete or mix records from an earlier target.

Say `just do it`, `skip the lesson`, `直接做`, or `跳过纠正` to suppress coaching and persistence for that message.

If the trusted UI bundle cannot load, Synergy falls back to the declarative settings schema so the core profile and switches remain editable.

## Progress and Data Controls

When the user explicitly asks about language progress, recurring mistakes, or historical examples, Synergy can discover:

```text
plugin__vibe-lingo__progress
```

The tool defaults to the active target language and accepts an optional BCP-47 `language` override. It can report global or current-Scope counts and show up to three sanitized examples with Scope, Session, and message provenance. It does not estimate proficiency or claim that a pattern has been mastered.

The settings page intentionally shows only a compact summary for the active target language. It can clear that language's records or all VibeLingo learning records through a Synergy host confirmation. Clearing data does not change settings.

## Data and Privacy

VibeLingo stores its SQLite database at:

```text
<synergyRoot>/data/plugins/vibe-lingo/vibe-lingo.sqlite
```

The default is:

```text
~/.synergy/data/plugins/vibe-lingo/vibe-lingo.sqlite
```

`synergyRoot()` follows `SYNERGY_HOME` and `SYNERGY_TEST_HOME`.

The plugin never persists complete user messages or Agent responses. It stores:

- normalized pattern metadata grouped by target-language tag;
- occurrence counts and timestamps;
- Scope, Session, and message IDs;
- at most five recent sanitized fragment pairs per pattern.

Fragments that appear to contain URLs, email addresses, private absolute paths, credentials, long tokens, or code blocks are omitted while aggregate provenance is retained.

Learning records aggregate across Scopes where VibeLingo is enabled, but settings remain Scope-specific. Cross-Scope fragments are never injected into the coaching prompt.

The `0.1.0` database migrates in place to schema version 2. Existing records are retained under target language `en`. Upgraded users must still explicitly choose their language pair before coaching and new tracking resume.

A normal plugin uninstall deletes the VibeLingo data directory. Synergy force uninstall skips lifecycle cleanup and may leave the directory behind.

## Verification

```bash
bun run typecheck
bun run test
bun run build
bun run validate
bun run pack
```

The built `dist/plugin.json` is generated by plugin-kit and must not be maintained by hand.

## Research

Product research, learning-science notes, Synergy integration findings, and decision records remain under [`research/`](./research/00_index/README.md).

# VibeLingo

VibeLingo is a prompt-first multilingual coaching plugin for Synergy. It keeps the primary Agent focused on real work, adds brief language feedback when useful, and privately turns recurring patterns into an evidence-backed review queue.

## Requirements

- Synergy `>=3.0.0`
- Bun `>=1.3.0`

## How It Works

VibeLingo has three independent paths:

1. A system-transform hook gives the primary Agent a compact, work-first coaching contract for the configured language pair and proficiency.
2. A continuing user-message observer asks a private hidden Agent to extract structured errors and natural correct uses after the message has already been submitted.
3. A local learning engine promotes recurring patterns, schedules review, and powers a dedicated learning workspace. Reviews use active recall, progressive hints, repair, and transfer practice.

Clear tasks continue immediately. Genuine task ambiguity is clarified. Correct target-language writing, instructions written only in the support language, child Sessions, small internal calls, and escape-hatch messages stay out of the teaching flow.

VibeLingo `0.4.0` adds a Synergy sidebar entry with overview, journey, pattern, review, and settings views. It still does not send automatic review invitations or notifications, and it does not provide Composer completion, submission interception, inline editor decorations, a vocabulary book, or FSRS. The due queue remains manual and never interrupts a work Session.

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

Version `0.4.0` adds the trusted learning workspace and a private pattern-presentation Agent. The plugin is still unreleased, so startup deliberately replaces any older dogfood database rather than carrying migration code.

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

The tool defaults to the active target language and accepts an optional BCP-47 `language` override. It reports target-language attempts, active days, due reviews, candidate/practicing/verified patterns, natural correct uses, independent reviews, and up to three sanitized examples when explicitly requested. It does not estimate proficiency or claim permanent mastery.

The settings view intentionally shows only a compact summary for the active target language. Detailed history belongs to the learning workspace. Settings can clear that language's records or all VibeLingo learning records through a Synergy host confirmation. Clearing data does not change settings.

## Learning Workspace

The `VibeLingo` sidebar entry is a single host page with horizontal product tabs rather than a nested sidebar:

- **Overview** shows the current learning week, activity streak, 30-day activity heatmap, 7/30/90-day evidence curves, recent journey events, due review, and recent natural use.
- **Review** shows due and upcoming patterns. A review starts only after an explicit user action. When there are fewer than three due items, the user may include patterns due within the next seven days.
- **Learning patterns** provides search, status/Scope filters, deterministic sorting, keyset pagination, pattern evidence, review history, scheduling, and lifecycle actions.
- **Learning journey** provides event/time/Scope filters, keyset pagination, bounded record details, and current-Scope Session navigation when the host can resolve it.
- **Settings** embeds the same trusted settings implementation used by Synergy's native settings surface; there is no second settings controller or schema.

Routes are represented by validated query parameters and opened through `context.host.openPluginPage()`. Invalid pattern, review, or event identifiers fall back to a recoverable parent view instead of entering a broken state. Query work is abortable, and `learning.changed` / `review.changed` events invalidate snapshots without duplicating domain state in the browser.

Canonical pattern metadata remains stable English internal data. The workspace requests native-language labels and rules in batches from the private `vibe-lingo-pattern-presenter` Agent, caches them by target/support language plus source metadata, and falls back to canonical text if generation is unavailable or low-confidence.

## Learning and Review Model

A pattern starts as `candidate`. Three confident errors across at least two Sessions promote it to `practicing` and place it in the due queue. Review intervals follow a transparent `1 → 3 → 7 → 14 → 30` day ladder:

- failed, abandoned, or assisted review returns in one day;
- an independent review requires both unaided recall and a correct transfer task;
- a pattern becomes `verified` only after two independent reviews, a later natural correct use, evidence across two Sessions, and at least seven elapsed days;
- a later confident error records a lapse, returns the pattern to `practicing`, and schedules it for the next day.

`verified` is an evidence state, not a language level or a permanent mastery claim.

The UI uses typed plugin operations for profiles, summary curves, journey records, pattern lists and details, due queue, resumable reviews, localized presentations, pattern controls, and cleanup. Review state includes per-item outcomes, independent-recall and transfer totals, each pattern's next due time, and the completion journey-event ID. The frontend renders these facts but does not reproduce lifecycle, scheduling, or evidence calculations.

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

The plugin never persists complete user messages, Agent responses, or Session titles. It stores:

- normalized pattern metadata grouped by target-language tag;
- error, natural-use, and review evidence with timestamps;
- Scope, Session, and message IDs;
- deterministic review state and due timestamps;
- at most five recent sanitized fragment/review-content records per pattern.

Analyzer fragments are limited to 160 Unicode code points and review answers to 300. Generated review content is also bounded. Values that appear to contain URLs, email addresses, private absolute paths, credentials, long tokens, or code blocks are omitted while aggregate provenance is retained.

Learning records aggregate by target language across Scopes where VibeLingo is enabled, but settings remain Scope-specific. Scope filters change the evidence view, not the global learning state or schedule. Cross-Scope fragments are never injected into the coaching prompt. A Session title is resolved only on demand in its current Scope; it is never copied into SQLite.

SQLite schema version 5 is intentionally destructive during this unreleased development phase. It adds the native-language pattern-presentation cache. VibeLingo validates its required tables, columns, indexes, and current event contract under an exclusive initialization lock. If the version or shape is not current, it recreates its owned tables and discards earlier dogfood statistics. A second plugin generation that starts after the first one has initialized the schema reuses the new database rather than resetting it again.

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

The v0.4 frontend capability and quality audit is recorded in [`research/80_synthesis/product-briefs/2026-07-28-v04-frontend-capability-and-quality-audit.md`](./research/80_synthesis/product-briefs/2026-07-28-v04-frontend-capability-and-quality-audit.md).

## Research

Product research, learning-science notes, Synergy integration findings, and decision records remain under [`research/`](./research/00_index/README.md).

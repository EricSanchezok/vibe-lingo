# VibeLingo

VibeLingo is a prompt-first multilingual coaching plugin for Synergy. It keeps the primary Agent focused on real work, adds brief language feedback when useful, and privately turns recurring patterns into an evidence-backed review queue.

## Requirements

- Synergy `>=3.0.11` with the stable Plugin API 4 family (composable text actions, host-managed result popovers, per-call model roles, `agent.start()`, and `agent.call.after`)
- Bun `>=1.3.0`

## How It Works

VibeLingo has three responsibility-specific paths:

1. A system-transform hook gives the primary Agent a compact, work-first coaching contract for the configured language pair and proficiency.
2. A Nano classifier observes ordinary user messages only to count target-language practice. When the primary Agent decides a correction is useful, it calls VibeLingo's resident correction Tool first; that card is the authoritative correction the user saw.
3. Host-managed, Sessionless asynchronous Agents add bounded metadata to saved correction pairs and detect natural correct use of known patterns. A local learning engine promotes recurring patterns, schedules review, and powers the learning workspace.

Clear tasks continue immediately. Genuine task ambiguity is clarified. Correct target-language writing, instructions written only in the support language, child Sessions, small internal calls, and escape-hatch messages stay out of the teaching flow.

VibeLingo `0.7.1` aligns foreground teaching with durable learning history, uses the stable API4 system-context hook, and adds explicit selected-text translation. Synergy composes VibeLingo's action with other plugin actions, owns the menu and result-popover interaction, and passes VibeLingo an immutable selection snapshot. Translation creates cache/history records but never counts as independent target-language practice, creates a pattern, or enters review. VibeLingo still does not send automatic review invitations or notifications, and it does not provide Composer completion, submission interception, inline editor decorations, a vocabulary book, or FSRS.

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

Version `0.7.1` declares `compatibility.synergy: ">=3.0.11"`; runtime transport revisions are host-owned and are not used as the plugin compatibility contract. The v0.7 development line performs a destructive schema-v8 reset: every earlier local learning and translation database is deleted instead of migrated. Stop the old Synergy/plugin generation before starting v0.7.

## First-Time Setup

VibeLingo does not coach or analyze messages until the user saves a complete learning profile:

```jsonc
{
  "nativeLanguage": "zh-Hans", // support/explanation language
  "targetLanguage": "en", // language being practiced
  "proficiency": "intermediate",
}
```

Language values are canonical BCP-47 tags supported by the current JavaScript `Intl` runtime. Common languages are searchable, and valid tags such as `pt-BR` or `tlh` can be entered directly. The two languages must be different.

The settings page includes English and Simplified Chinese copy. Before setup it follows `document.documentElement.lang`; after setup it uses Chinese for a Chinese support language and otherwise falls back to English. Language names come from `Intl.DisplayNames`.

Non-English targets use the same contract, privacy rules, and isolated storage model as English. Classification, analysis, translation, and review quality depend on the models resolved for their configured Synergy roles; equal quality across every `Intl`-supported language is not claimed.

## Settings

The complete settings shape is:

```jsonc
{
  "nativeLanguage": "zh-Hans",
  "targetLanguage": "en",
  "proficiency": "intermediate", // beginner | intermediate | advanced
  "correctionMode": "focused", // focused | strict | off
  "trackingEnabled": true,
  "recurringFocusEnabled": true,
  "languageDetectionModelRole": "nano",
  "learningAnalysisModelRole": "mini",
  "translationModelRole": "mini",
  "reviewModelRole": "mini",
  "translationHistoryEnabled": true,
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
- The four model-role settings select a Synergy workload role (`nano`, `mini`, `mid`, `thinking`, `long`, or `creative`) for language detection, learning analysis, translation, and review/presentation. They never select a provider or concrete model ID.
- Turning translation history off stops new history writes while preserving and reusing existing persistent cache entries. Existing records must be cleared explicitly.

When a message contains a correction worth surfacing, the main Agent's first visible action is:

```text
plugin__vibe-lingo__record-correction
```

Its input contains only the natural restatement and one or two visible original/corrected fragment pairs. The Tool card renders those exact values immediately; the Agent then continues the real task. Pattern keys, categories, severity, rules, and confidence are assigned later by a private asynchronous Agent. The main Agent must not duplicate the card as ordinary `Got it`/`💡` text or postpone correction until the final answer.

Turning tracking off does not suppress foreground teaching: the same Tool card is shown, but it is marked as chat-only and neither SQLite nor a metadata Agent call is used.

Changing the target language switches to that language's learning-data namespace. It does not delete or mix records from an earlier target.

Say `just do it`, `skip the lesson`, `直接做`, or `跳过纠正` to suppress coaching and persistence for that message.

If the trusted UI bundle cannot load, Synergy falls back to the declarative settings schema so the core profile and switches remain editable.

## Progress and Data Controls

When the user explicitly asks about language progress, recurring mistakes, or historical examples, Synergy can discover:

```text
plugin__vibe-lingo__progress
```

The tool defaults to the active target language and accepts an optional BCP-47 `language` override. It distinguishes target-language practice, visible corrections, accepted pattern evidence, natural correct use, and review evidence. It also reports pending/failed correction analysis without exposing models, confidence, or a technical queue. It does not call a no-correction message “correct,” estimate proficiency, or claim permanent mastery.

The settings view intentionally shows only a compact summary for the active target language. Detailed history belongs to the learning workspace. Settings can clear that language's records or all VibeLingo learning records through a Synergy host confirmation. Clearing data does not change settings.

## Learning Workspace

The `VibeLingo` sidebar entry is a single host page with horizontal product tabs rather than a nested sidebar:

- **Overview** shows today's analyzed messages, target-language attempts, active Sessions and findings; the current learning week; activity streak; 30-day activity heatmap; 7/30/90-day evidence curves; recent journey events; due review; and recent natural use.
- **Review** shows due and upcoming patterns. A review starts only after an explicit user action. When there are fewer than three due items, the user may include patterns due within the next seven days.
- **Learning patterns** provides search, status/Scope filters, deterministic sorting, keyset pagination, pattern evidence, review history, scheduling, and lifecycle actions.
- **Learning journey** provides event/time/Scope filters, keyset pagination, bounded record details, and current-Scope Session navigation when the host can resolve it.
- **Translations** provides cached translation history, direction/search filters, keyset pagination, copy/delete actions, and translation-only cleanup. Missing source previews are shown honestly.
- **Settings** embeds the same trusted settings implementation used by Synergy's native settings surface; there is no second settings controller or schema.

Routes are represented by validated query parameters and opened through `context.host.openPluginPage()`. Invalid pattern, review, or event identifiers fall back to a recoverable parent view instead of entering a broken state. Query work is abortable, and `learning.changed` / `review.changed` events invalidate snapshots without duplicating domain state in the browser.

Canonical pattern metadata remains stable English internal data. The workspace requests native-language labels and rules in batches from the private `vibe-lingo-pattern-presenter` Agent, caches them by target/support language plus source metadata, and falls back to canonical text if generation is unavailable or low-confidence.

## Selected-Text Translation

Select up to 4,000 Unicode code points in a conversation/document, Monaco code surface, or Terminal, then open the context menu and choose **Translate** under **VibeLingo**. Password/sensitive inputs and embedded Browser pages are outside this surface. Synergy freezes the exact selection and opens one accessible result popover beside it, or a bottom sheet on narrow screens.

The adaptive direction translates target-language text into the support/native language and translates support-language or third-language text into the target language. The result can be switched explicitly to either configured language or force-refreshed.

A persistent cache hit returns immediately. A miss asks the private translator for only the translated text and detected source-language tag; VibeLingo derives the destination and privacy state in code. Common equivalent field names are normalized, and malformed structured output receives one bounded repair attempt before a clean retryable error is shown. Synergy's configured model-role fallback and provider retry remain the lower-level availability fallback. Valid output is checked for language direction and size before a short SQLite write. Concurrent identical requests share a single in-process flight. Changing the translation model role does not invalidate cached translations; **Translate again** bypasses the cache and refreshes the record.

The plugin also contributes the searchable `plugin__vibe-lingo__translation-history` Tool, intended only for explicit requests to inspect translation history.

## Learning and Review Model

An accepted correction analysis at confidence `0.85` or above creates a visible `candidate`; rejected or lower-confidence metadata does not create evidence, while the correction card remains in history. Two non-minor corrections (`meaning_affecting` or `high_value`) across two Sessions promote the pattern to `practicing` and place it in the due queue. Minor-only patterns still require three corrections across at least two Sessions. Review intervals follow a transparent `1 → 3 → 7 → 14 → 30` day ladder:

- failed, abandoned, or assisted review returns in one day;
- an independent review requires both unaided recall and a correct transfer task;
- a pattern becomes `verified` only after two independent reviews, a later natural correct use, evidence across two Sessions, and at least seven elapsed days;
- a later confident error records a lapse, returns the pattern to `practicing`, and schedules it for the next day.

`verified` is an evidence state, not a language level or a permanent mastery claim.

The Nano language classifier makes one immediate in-memory retry after a timeout, unavailable model, or invalid response. Correction metadata is submitted through `agent.start()` only after the visible pair is committed; a later `agent.call.after` hook validates and writes the result idempotently. A fresh attempt is shown as waiting for 30 seconds. If a pending or queued attempt loses its terminal delivery, the saved card changes to an interrupted state and offers one explicit, atomically claimed retry; a later user-message observer in the same Scope remains an opportunistic recovery path. Turning foreground coaching off does not strand an already-saved correction while tracking remains enabled. Usage analysis is privacy-first and is not retried across a Synergy restart.

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

The plugin never persists complete user messages, restatements, Agent responses, asynchronous prompts/outputs, or Session titles. It stores:

- normalized pattern metadata grouped by target-language tag;
- the bounded correction fragment pairs actually shown to the user;
- error metadata linked to those correction items, without a duplicate error-fragment copy;
- natural-use and review evidence with timestamps;
- Scope, Session, and message IDs;
- deterministic review state and due timestamps;
- translation identity metadata, a bounded sanitized source preview, and the complete validated translated artifact (at most 8,000 Unicode code points);
- translation use provenance (Scope, optional Session, time, and cache-hit state);
- at most five recent sanitized fragment/review-content records per pattern.

Analyzer fragments are limited to 160 Unicode code points and review answers to 300. Generated review content is also bounded. Values that appear to contain URLs, email addresses, private absolute paths, credentials, long tokens, or code blocks are omitted while aggregate provenance is retained.

Translation cache identity uses SHA-256 over the normalized selection, language pair, destination policy, and translation-contract version. The hash is an identity key, not encryption. The complete selected source is never stored. Ordinary records may retain a sanitized preview of at most 160 code points; a whole user/assistant message has no preview. Sensitive source or output is excluded from SQLite and retained only in a process-local five-minute cache; ordinary unsaved results use a 30-minute cache. The memory cache holds at most 100 entries and is cleared on plugin reload.

Learning records aggregate by target language across Scopes where VibeLingo is enabled, but settings remain Scope-specific. Scope filters change the evidence view, not the global learning state or schedule. Cross-Scope fragments are never injected into the coaching prompt. A Session title is resolved only on demand in its current Scope; it is never copied into SQLite.

V0.7 has one schema-v8 path and no migration/repair adapters. If the database version or required structure differs, VibeLingo closes it, removes the SQLite/WAL/SHM files, and creates the current schema.

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

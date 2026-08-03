# Current Product Decisions

This document records the decisions that define the current VibeLingo product.
It replaces the version-by-version research archive that was useful during
early development but no longer described one coherent implementation.

## Work-first prompt coaching

VibeLingo injects a compact coaching contract into eligible root Sessions. The
primary Agent completes the real task first in priority, corrects without
blocking when intent is clear, and clarifies only material ambiguity.

**Why:** the primary Agent has the task context needed to preserve scope and
distinguish language mistakes from task ambiguity.

## Foreground correction is authoritative

The language-feedback Tool card is the record of what the user actually saw.
One call may combine objective corrections and contextual naturalness
suggestions. Private analysis may attach pattern metadata later, but it cannot
rewrite the visible original or corrected fragments.

**Why:** foreground and background analysis must not create contradictory
learning histories.

## Contextual naturalness is independently controllable

Grammatical wording may still merit feedback when speakers in the current
context would clearly prefer a different convention, collocation, politeness
formula, register, or pragmatic stance. This behavior is enabled by default but
has its own setting because it is more subjective than objective correction.
Focused and Strict control the qualification threshold rather than imposing a
teaching-count limit; a bounded Tool contract remains a runtime safeguard.

**Why:** naturalness is central to useful language coaching, while an explicit
control and a strict contextual threshold prevent stylistic rewriting from
becoming noise.

## Explicit multilingual profile

Coaching and tracking require distinct, canonical BCP-47 support and target
languages plus a self-reported beginner/intermediate/advanced proficiency.

**Why:** language direction, explanation language, analysis, storage, review,
and translation cannot safely rely on one-message inference.

## Activity is separate from trusted learning evidence

Target-language attempts always contribute activity. Only accepted correction,
natural-use, and review evidence changes a pattern lifecycle.

**Why:** real Agent use is sparse. The product should make authentic practice
visible without lowering evidence standards or labelling no-finding messages as
correct.

## Evidence-based pattern lifecycle

Patterns use `candidate → practicing → verified`, with explicit promotion,
review, natural-use, elapsed-time, and lapse rules. Review is user-initiated and
uses a deterministic interval ladder.

**Why:** occurrence counts alone cannot support retrieval practice or honest
progress claims. A transparent schedule is easier to audit than an adaptive
algorithm without enough local review data.

## One learning workspace, no nested navigation

VibeLingo contributes one sidebar page with horizontal Overview, Review,
Learning patterns, Translations, and Settings destinations.

**Why:** the workspace is a product surface inside Synergy, not another app
shell or a sidebar nested inside the host sidebar.

## Host-managed composable text actions

Synergy aggregates actions from every plugin and owns selection capture, menu
composition, popover placement, focus, cancellation, and responsive behavior.
VibeLingo contributes translation behavior and content only.

**Why:** plugins should extend the same context menu without replacing one
another or implementing incompatible floating-surface behavior.

## Translation is assistance, not learner output

Translation has its own cache and history. It never creates target-language
attempts, learning patterns, natural-use evidence, or review items.

**Why:** selected or translated text does not prove that the learner produced
or independently understood the expression.

## Explicit local translation history

VibeLingo uses plugin-owned SQLite. It stores typed metadata, provenance, and
bounded sanitized learning fragments; it does not persist background-analysis
messages, Agent responses, Session titles, private Agent prompts, or raw model
output. When translation history is enabled, an explicit translation action
stores the complete normalized selection and validated translation locally.

**Why:** a reusable translation cache and understandable history require the
actual source text. The translation is explicitly requested and the plugin
database is local, so a preview-only storage model adds complexity while making
history and search materially less useful.

## Role-based models

Users select Synergy model roles for detection, learning analysis, translation,
and review. Plugins never select a concrete provider or model ID.

**Why:** workload intent belongs to the plugin while model availability,
provider configuration, and fallback belong to Synergy.

## Bounded but network-tolerant Agent calls

Learning analysis, translation, review, and localized presentation use the
host's 120-second plugin-Agent ceiling. Language classification uses 60 seconds
per attempt and keeps one immediate in-memory retry. Asynchronous correction
analysis gets another 30 seconds of delivery headroom. A classified transient
failure receives one delayed automatic retry; a second failure or missing
terminal delivery leaves an explicit card retry. Only an allowlisted failure
category and attempt count are persisted. SQLite lock waits and interface-only
timers keep their shorter, domain-specific bounds.

**Why:** remote model latency is variable and a saved correction is valuable
enough to justify one bounded recovery attempt. Capping it at one avoids an
unbounded retry stack, while short database and UI operations retain limits
appropriate to their own failure modes.

## Deliberate non-goals

The current product does not include Composer completion, submission blocking,
inline editor decorations, automatic review notifications, vocabulary books,
FSRS, proficiency scoring, or claims of permanent mastery.

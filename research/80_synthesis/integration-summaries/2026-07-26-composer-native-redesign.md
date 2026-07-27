# VibeLingo Composer-Native Redesign

## Bottom Line

- Redesign VibeLingo around **when help is useful**, not around three visible tool names.
- Use a four-stage interaction loop: **compose → preflight → reflect → reuse**.
- Separate **communication risk** from **learning value**. Communication risk may justify a pre-submit interruption; learning value should usually wait until after send.
- Do not become an always-on grammar checker. Default to silence, offer ghost completion only for strong struggle signals, and show at most one or two high-value observations.
- Keep the July 11 product promise: help the user continue real work first, preserve intent, teach lightly, and persist only with user confirmation.
- Treat the new platform capabilities as an opportunity to remove old compromises, not as a reason to activate every hook in the first release.

## Evidence Base

- [`../../20_synergy-platform/source-map/2026-07-26-plugin-interaction-hooks.md`](../../20_synergy-platform/source-map/2026-07-26-plugin-interaction-hooks.md)
- [`../product-briefs/2026-07-11-vibelingo-plugin-product-design.md`](../product-briefs/2026-07-11-vibelingo-plugin-product-design.md)
- [`../../10_learning-science/feedback-and-correction/feedback-timing.md`](../../10_learning-science/feedback-and-correction/feedback-timing.md)
- [`../../10_learning-science/feedback-and-correction/corrective-feedback-types.md`](../../10_learning-science/feedback-and-correction/corrective-feedback-types.md)
- [`../../10_learning-science/second-language-acquisition/output-hypothesis.md`](../../10_learning-science/second-language-acquisition/output-hypothesis.md)
- [`../../10_learning-science/second-language-acquisition/noticing-hypothesis.md`](../../10_learning-science/second-language-acquisition/noticing-hypothesis.md)

## What Changes from the Previous Design

The previous design exposed Help, Polish, and Explain as agent-invoked tools because an unsent draft was not a reliable plugin surface. That introduced several compromises:

- the user had to stop composing and formulate a meta-request;
- Polish often happened only after the original message was already sent;
- the plugin could not distinguish “this may make the Agent do the wrong thing” from “this is a useful grammar lesson” at the right time;
- Explain required quoting or retyping the difficult fragment;
- suggestions occupied the main conversation even when they were secondary to the task.

The new interaction hooks remove those platform constraints. The action taxonomy remains useful internally, but it no longer needs to define the visible product.

## Proposed Interaction Model

### Stage 1: Compose — help at the point of struggle

The Composer is the primary VibeLingo surface.

#### Strong signals that may justify assistance

- a target-language draft ends with a mother-tongue fragment;
- the user leaves an explicit placeholder or invokes “help with this draft”;
- the caret follows an incomplete phrase and the user has paused;
- a previously corrected, high-confidence pattern recurs;
- the user explicitly requests a check.

#### Default behaviors

1. **Ghost completion for expression retrieval**

   When the user writes a target-language sentence with a clear trailing mother-tongue fragment, offer only the missing target-language suffix. Tab accepts; continued typing or Escape dismisses it.

   This supports the user's own attempt rather than replacing it with a generated prompt.

2. **Quiet annotation for a small number of issues**

   Use an info-level decoration for optional phrasing and warning only when wording may change task meaning. Avoid error-red for ordinary learner language.

   Because the current host does not surface decoration details interactively, a compact plugin-owned card may be needed for the actual explanation and replacement. This needs a prototype before it becomes a product decision.

3. **Explicit “check this draft” action**

   A Composer action runs a full but focused pass when the user asks. It should prioritize:

   - task meaning and scope;
   - one or two high-value language issues;
   - a concise intent-preserving suggestion;
   - an optional “why” explanation.

#### What should not happen

- no completion for every pause;
- no full-sentence replacement when a phrase is enough;
- no analysis while IME composition is active;
- no correction of code, identifiers, paths, or quoted source text;
- no automatic persistence of draft text or analysis.

### Stage 2: Preflight — protect communication, not grammar

Submission interception should be reserved for issues with plausible task consequences:

- negation or scope is ambiguous;
- a technical term appears to express the opposite operation;
- research wording overstates evidence or causality;
- writing tone conflicts with an explicitly selected audience;
- the draft still contains an unresolved mother-tongue placeholder in a target-language session.

Low-stakes grammar, spelling, and naturalness should not block Send.

If preflight pauses submission, the review should offer:

- the original and suggested wording;
- one sentence explaining the task-level risk;
- **Use suggestion**;
- **Send original**;
- **Return to editing**.

The host locks the draft and Escape cancels, but Synergy does not define this three-way review protocol. The first prototype must prove that a plugin-owned Composer card can implement it accessibly.

#### Latency policy

- Reuse a current settled-draft analysis when its revision still matches.
- If there is no risk signal, resolve synchronously.
- If analysis is required, use a short plugin-owned budget and fail open.
- The host's 120-second timeout must never be treated as a UX budget.

Tentative prototype target: no visible delay below 150 ms; cached checks under 300 ms; an uncached explicit check should aim for under 1.5 seconds. These are hypotheses to test, not established thresholds.

### Stage 3: Reflect — teach after the message is safely sent

`session.user-message.after` is a better trigger for learning feedback than blocking submission or waiting for the assistant turn.

The hook can analyze the exact user message asynchronously while the primary Agent continues its work. A message action or conditional message-after slot can then show a quiet result such as:

> 1 language note

Opening it reveals:

- the user's original wording;
- one high-value correction or stronger reusable expression;
- one transferable reason;
- optional Save.

This is where recurring grammar, register, and reusable phrasing belong. The main Agent response remains focused on the user's real task.

Post-submit analysis should be opt-in initially because it requires `session.read`, creates a surveillance risk, and could easily generate noisy feedback. Local filters should skip code-heavy, mother-tongue-only, very short, or low-confidence messages before any Agent call.

### Stage 4: Reuse — explain and save from exact context

Selected-text actions can remove the need to quote difficult text into a command:

- **Explain in context** for an assistant response, Note, source file, or terminal text;
- **Save as a language moment** after the user confirms the minimal stored representation.

However, the host currently does not render a text-action operation's return value. The result surface is therefore an open design question. Candidate prototypes:

1. a small transient explanation surface anchored near the selection;
2. a reusable compact side-workspace tab opened only when requested;
3. a message-adjacent expansion when the selection came from a conversation.

The first option is closest to “in flow,” but it may require a small Synergy host enhancement rather than plugin-only design.

## One Decision Rule for All Workflows

Classify each finding on two independent axes:

| Axis | Question | Controls |
|---|---|---|
| Communication risk | Could this wording make the Agent, reader, or researcher act on the wrong meaning? | Whether to intervene before Send |
| Learning value | Is this a reusable pattern the user is likely to benefit from noticing again? | Whether to offer a post-send note or Save |

This avoids treating every language issue as equally urgent.

Examples:

| Finding | Communication risk | Learning value | Timing |
|---|---:|---:|---|
| “Do change existing behavior” when user means “do not change” | High | Medium | Preflight |
| “can making” | Low | High if recurring | Post-send note |
| A trailing Chinese phrase inside an English draft | Medium | High | Ghost completion before Send |
| “prove” where a paper only “suggests” | High | High | Preflight in research |
| Correct but slightly non-native phrasing | Low | Low | Silence |

## Workflow-Specific Defaults

### Vibe coding

- Preflight only task-boundary, negation, scope, and technical-operation risks.
- Prefer phrase completion over prose rewriting.
- Defer grammar and naturalness until after send.
- Disable proactive feedback during rapid debugging or repeated tool execution.

### Vibe research

- Preflight may cover claim strength, causality, comparison scope, and search-term precision.
- Explain should unpack term boundaries and argumentative role, not only translate.
- Save distinctions and reusable synthesis frames rather than isolated rare words.

### Vibe writing

- Explicit draft checking may cover audience, tone, directness, and register.
- Preserve author voice and show alternatives only when they represent meaningful choices.
- Long-text correction remains selection- or range-scoped, never an automatic full-document pass.

## Proposed MVP

The smallest coherent redesign experiment is:

1. **Composer expression completion**
   - only explicit help or high-confidence trailing mother-tongue fragments;
   - suffix-only ghost text;
   - no automatic whole-draft rewrite.
2. **Explicit draft check**
   - user-initiated;
   - one intent-preserving suggestion and one reason;
   - revision-safe apply or dismiss.
3. **Post-send language note**
   - opt-in;
   - at most one conditional note on a user message;
   - no automatic Save or learner profile.
4. **Selected-text Explain prototype**
   - validate where the result should appear before committing to a permanent surface.

Submission-blocking preflight should be a follow-up experiment, not enabled by default in the first MVP. It has the highest interruption, latency, trust, and UI-protocol risk.

## Privacy and Capability Strategy

Requesting every new capability at install time would weaken the trust story.

The design should minimize raw-text lifetime:

- draft snapshots stay in memory and are keyed by revision;
- cancellation deletes stale work;
- Sessionless Agent calls receive only the minimum draft fragment and a small context hint;
- post-submit analysis stores only a short-lived result keyed by message ID;
- no draft, message, or explanation is written to diagnostics;
- Save shows an explicit preview and persists only the confirmed language moment.

There is an unresolved platform/product tradeoff: manifest capabilities are approved as a static set, while the desirable product model is progressive opt-in. The MVP should avoid `composer.intercept` until its value is proven, and should explain `session.read` narrowly even though the capability itself is broad.

## Success Measures for the Redesign

Primary:

- percentage of accepted completions followed by continued target-language composition;
- percentage of draft checks whose suggestion is accepted without changing intended task scope;
- percentage of post-send notes opened, dismissed, or disabled;
- rate at which users send original wording after a preflight warning;
- time added to ordinary message submission;
- reduction in explicit `@vibe-lingo help/polish` turns.

Guardrails:

- completion dismissal rate;
- false-positive communication-risk warnings;
- messages delayed over the latency budget;
- frequency of “send original” and “disable checks”;
- dependency signal: increasing use of full-message generation with decreasing self-authored target-language text;
- trust signal: refusal of Composer or Session permissions.

## Open Questions

- What exact user behavior is a sufficiently strong “stuck” signal for proactive ghost completion?
- Can the current `composer.above` and operation/event model support a compact revision-bound suggestion card without host changes?
- Does selected-text Explain need a host-owned result popover?
- Should post-submit analysis be session-level opt-in, project-level opt-in, or a plugin-wide setting?
- Which issues reliably predict task misunderstanding in coding, research, and writing?
- Can a local first-stage classifier reduce Agent calls enough to keep cost and latency acceptable?

## Recommended Next Step

Build a non-production interaction prototype with scripted responses for three flows:

1. trailing mother-tongue fragment → ghost completion;
2. explicit draft check → suggestion card → apply/dismiss;
3. sent message → one conditional language note.

Run 10 realistic scenarios each for coding, research, and writing. Measure interruption, intent preservation, latency tolerance, and whether the user continues in the target language. Do not add persistence, FSRS, automatic learner modeling, or submission blocking until these interaction probes produce evidence.

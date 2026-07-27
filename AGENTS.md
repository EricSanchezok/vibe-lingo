# AGENTS.md

## Project Intent

VibeLingo is a Synergy plugin that helps users learn languages naturally while they use Synergy for vibe coding, vibe research, writing, planning, and other agent-native workflows.

The repository has moved past pure research: `src/` contains the first working implementation (v0.1.0), a prompt-first English coaching plugin. The `research/` knowledge base remains the record of why the design looks the way it does; keep feeding durable findings back into it.

The Synergy source tree is located at:

```txt
/Users/eric/projects/synergy
```

Use that source tree for platform understanding and for verifying plugin-interface behavior against the actual host implementation.

## Current Phase Rules

- The plugin is implemented; behavior changes happen in `src/` with tests in `test/`.
- Keep the implementation aligned with the research base. When a design decision changes behavior, update the relevant note or ADR in the same change.
- Verify plugin-interface assumptions against the Synergy source tree before relying on them; do not design around undocumented host behavior.
- Every important claim about language learning, memory, motivation, agent workflows, or Synergy integration should be traceable to a source, observation, or decision record.
- When uncertainty remains, preserve it explicitly rather than prematurely resolving it.

## Research Directory Plan

Use `research/` as the main knowledge base. The directory is organized by question type rather than by implementation module.

```txt
research/
  00_index/
    README.md
    research-map.md
    glossary.md
    open-questions.md
  10_learning-science/
    pedagogy/
    second-language-acquisition/
    memory-and-spaced-repetition/
    feedback-and-correction/
    motivation-and-habit/
    assessment-and-leveling/
  20_synergy-platform/
    source-map/
    plugin-system/
    tool-and-agent-runtime/
    memory-notes-agenda/
    conversation-surfaces/
    constraints-and-risks/
  30_user-workflows/
    vibe-coding/
    vibe-research/
    vibe-writing/
    reading-and-summarization/
    daily-agent-use/
    learner-personas/
  40_integration-patterns/
    proactive-interventions/
    explicit-tools/
    micro-lessons/
    vocabulary-capture/
    correction-flows/
    progress-tracking/
    privacy-and-consent/
  50_product-strategy/
    positioning/
    user-value/
    competitive-landscape/
    mvp-candidates/
    success-metrics/
    failure-modes/
  60_evidence-bank/
    papers/
    web-articles/
    docs/
    examples/
    datasets/
  70_decisions/
    adr/
    rejected-ideas/
    assumptions/
  80_synthesis/
    literature-summaries/
    integration-summaries/
    product-briefs/
    experiment-plans/
```

### Directory Purposes

- `00_index/`: Entry points for humans and agents. Keep maps, glossary, unresolved questions, and navigation aids here.
- `10_learning-science/`: Research on how people learn languages, including second-language acquisition, memory, correction, motivation, fluency, and assessment.
- `20_synergy-platform/`: Findings from `C:\Eric\projects\synergy`, focused on how plugins, tools, agents, memory, notes, agenda, and conversation surfaces work.
- `30_user-workflows/`: Observations about real user contexts where language learning can be embedded without interrupting the main task.
- `40_integration-patterns/`: Candidate interaction patterns for the plugin, such as proactive suggestions, explicit commands, inline vocabulary capture, correction, review, or progress tracking.
- `50_product-strategy/`: Product positioning, learner personas, MVP framing, metrics, competitive analysis, and risks.
- `60_evidence-bank/`: Raw or lightly processed source notes. This is where source-specific records live before synthesis.
- `70_decisions/`: Durable decisions and rejected ideas. Use ADR-style records when a choice affects future design or implementation.
- `80_synthesis/`: Higher-level conclusions that combine multiple notes into actionable direction.

## Research Note Types

Use these note types consistently.

### Source Note

A source note captures one paper, article, documentation page, website, dataset, or observed code area.

Recommended path:

```txt
research/60_evidence-bank/<source-kind>/<yyyy-mm-dd>-<short-slug>.md
```

Template:

```md
# <Source Title>

## Metadata

- Type: paper | web | docs | code | dataset | interview | observation
- Date captured: YYYY-MM-DD
- Source URL / path:
- Authors / organization:
- Year:
- Reliability: high | medium | low
- Tags:

## Why It Matters

Briefly explain why this source matters for VibeLingo.

## Key Claims

- Claim 1
- Claim 2

## Evidence / Details

Quote, paraphrase, or summarize the important evidence. Include page, section, line, or URL anchors when available.

## Implications for VibeLingo

- Product implication
- Teaching implication
- Integration implication

## Limitations

What this source does not answer, or why it may not generalize.

## Follow-up Questions

- Question 1
```

### Concept Note

A concept note explains one idea across multiple sources.

Recommended path:

```txt
research/10_learning-science/<topic>/<concept-slug>.md
research/40_integration-patterns/<topic>/<concept-slug>.md
```

Template:

```md
# <Concept>

## Summary

Short explanation of the concept.

## What We Know

- Evidence-backed point
- Evidence-backed point

## Design Relevance

How this might shape VibeLingo.

## Risks / Misuses

How this idea could be implemented badly.

## Supporting Sources

- `research/60_evidence-bank/...`

## Open Questions

- Question 1
```

### Workflow Note

A workflow note describes where language learning may fit into a real Synergy session.

Recommended path:

```txt
research/30_user-workflows/<workflow>/<workflow-slug>.md
```

Template:

```md
# <Workflow>

## User Goal

What the user is actually trying to accomplish before language learning is introduced.

## Session Shape

Typical sequence of user-agent interaction.

## Language-Learning Opportunities

- Vocabulary
- Phrases
- Corrections
- Comprehension checks
- Output practice
- Review moments

## Interruption Risk

Where learning support may harm the main workflow.

## Candidate Interventions

- Low-friction intervention
- Explicit opt-in intervention
- Review-later intervention

## Evidence / Examples

Link source notes, session observations, or Synergy source findings.
```

### Decision Record

Use decision records when a choice should constrain future work.

Recommended path:

```txt
research/70_decisions/adr/YYYY-MM-DD-<decision-slug>.md
```

Template:

```md
# ADR: <Decision>

## Status

Proposed | Accepted | Rejected | Superseded

## Context

What problem or uncertainty forced this decision?

## Decision

What did we decide?

## Rationale

Why is this the best current choice?

## Consequences

What becomes easier, harder, or impossible?

## Evidence

- Source note or synthesis link

## Revisit Trigger

What new evidence would cause us to reopen this decision?
```

### Synthesis Note

A synthesis note combines many sources into a practical conclusion.

Recommended path:

```txt
research/80_synthesis/<topic>/<yyyy-mm-dd>-<synthesis-slug>.md
```

Template:

```md
# <Synthesis Title>

## Bottom Line

The current best answer in 3-6 bullets.

## Evidence Base

- Source note 1
- Source note 2

## Analysis

Reasoned synthesis across sources. Separate evidence from interpretation.

## Implications

- Teaching strategy
- Product behavior
- Synergy integration
- Data/storage implications

## Open Questions

- Question 1

## Recommended Next Step

One concrete next research, design, or validation step.
```

## Naming and Tagging

- File names should be lowercase kebab-case.
- Prefix source notes and synthesis notes with capture date when chronology matters.
- Use stable tags in metadata where useful:
  - `sla`
  - `spaced-repetition`
  - `comprehensible-input`
  - `corrective-feedback`
  - `motivation`
  - `vibe-coding`
  - `vibe-research`
  - `synergy-plugin`
  - `agent-memory`
  - `privacy`
  - `mvp`
- Prefer links between notes using relative paths.
- If a note depends on a source, link the exact source note rather than only naming the original paper or website.

## Research Ingestion Workflow

When adding new research, follow this sequence:

1. Capture the raw source as a source note in `research/60_evidence-bank/`.
2. Extract only the claims that matter for VibeLingo.
3. Link the source note to one or more concept, workflow, or integration notes.
4. Update `research/00_index/research-map.md` when the source changes the project map.
5. Update `research/00_index/open-questions.md` when the source answers or creates an important question.
6. Create or update a synthesis note only after multiple sources point to a pattern.
7. Create a decision record only when the conclusion should constrain future design or implementation.

Do not skip directly from reading a source to making a product decision unless the decision is small, reversible, and explicitly marked as tentative.

## Research Quality Standards

- Prefer primary sources: academic papers, official documentation, source code, and first-party product docs.
- For language learning claims, distinguish established findings from disputed or context-dependent findings.
- For Synergy integration claims, verify against `/Users/eric/projects/synergy` source or official project documentation.
- For market or competitor claims, record date captured because product behavior changes quickly.
- Do not overfit VibeLingo to English learning. The plugin should be conceptually multilingual unless research justifies narrowing scope.
- Always consider user interruption cost: language learning should support the main workflow, not hijack it.
- Always consider privacy and consent before storing learner data, conversation excerpts, vocabulary, corrections, or proficiency signals.

## Key Research Questions

Maintain and refine these in `research/00_index/open-questions.md`.

### Learning Method Questions

- Which language-learning theories are most relevant to agent-native work sessions?
- How can comprehensible input, output practice, spaced repetition, corrective feedback, and retrieval practice fit into short agent interactions?
- What forms of correction help without embarrassing or distracting the learner?
- How should the plugin adapt to beginner, intermediate, and advanced learners?
- How does the strategy change across target languages with different scripts, grammar, or morphology?

### Workflow Questions

- During vibe coding, what language-learning moments are useful rather than disruptive?
- During vibe research, how can reading, summarization, and vocabulary capture become language practice?
- Should learning interventions happen inline, at task boundaries, or in later review sessions?
- When should the user explicitly request learning support versus receiving proactive suggestions?

### Synergy Integration Questions

- What plugin hooks, tools, commands, memory, note, or agenda mechanisms are available in Synergy?
- Where can VibeLingo store user preferences and learner progress safely?
- How should the plugin interact with Synergy agents and subagents?
- Can review reminders or spaced repetition be integrated with Synergy agenda or memory systems?
- What permissions and consent boundaries are needed?

### Product Questions

- What is the smallest useful version of VibeLingo?
- What user value is unique to agent-native language learning compared with Duolingo, Anki, browser extensions, or tutoring bots?
- What metrics indicate learning value without encouraging annoying behavior?
- What failure modes would make users disable the plugin?

## Working With the Synergy Source Tree

When researching `/Users/eric/projects/synergy`:

- Treat it as a separate source of evidence, not as this project’s implementation directory.
- Do not modify Synergy source unless the user explicitly asks.
- Create source-map notes under `research/20_synergy-platform/source-map/`.
- Record exact file paths and relevant line ranges when documenting plugin architecture or runtime behavior.
- Separate observations from design decisions. Example: “Synergy has X mechanism” belongs in source-map; “VibeLingo should use X mechanism” belongs in integration synthesis or ADR.

## Implementation Rules

- Source lives in `src/` and builds with plugin-kit: `bun run build`, `bun run test`, `bun run typecheck`, `bun run validate`, `bun run pack`. The generated `dist/plugin.json` must not be edited by hand.
- Keep the public contract in `definePlugin()` as the single source of identity, capabilities, and contributions.
- Do not widen the scope of v0.1.0 silently. Composer completion, submission interception, inline decorations, dashboards, vocabulary review, and spaced repetition are deliberately out of scope; adding any of them requires an ADR first.
- Privacy invariants are binding: never persist full user messages or agent responses, store only normalized pattern metadata plus bounded sanitized fragments, and keep the escape-hatch behavior working.
- A normal plugin uninstall must delete the VibeLingo data directory; keep the lifecycle cleanup handler intact.

## Definition of Done for Current Phase Work

An implementation change is complete when it:

- Passes `bun run typecheck`, `bun run test`, `bun run build`, and `bun run validate`.
- Adds or updates tests for the behavior it changes.
- Updates the README and any affected research note or ADR in the same change.

A research task is complete when it produces at least one of:

- A source note with metadata, key claims, implications, and limitations.
- A concept note linked to supporting source notes.
- A workflow note describing user goal, learning opportunities, and interruption risk.
- A synthesis note with evidence-backed recommendations.
- A decision record with context, rationale, consequences, evidence, and revisit trigger.

The initial implementation shipped as v0.1.0 (prompt-first coaching contract + background analyzer + local SQLite tracking, per `research/70_decisions/adr/2026-07-26-prompt-first-language-coaching.md`). New design questions that go beyond that ADR still need synthesis before implementation.

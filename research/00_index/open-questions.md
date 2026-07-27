# Open Questions

Last updated: 2026-07-26

These questions drive our research. Each question should eventually be answered by one or more source notes, concept notes, or synthesis notes. When a question is resolved, move it to an "Answered" section with a link to the evidence.

## Learning Method Questions

### SLA Foundations
- Which SLA theories (Krashen, Swain, Long, Schmidt) are most relevant to agent-native work sessions?
- How does the Interaction Hypothesis apply when one "interlocutor" is an LLM?
- Does the Noticing Hypothesis suggest we should explicitly highlight errors, or let the user notice naturally?

### Input & Output
- How can comprehensible input (i+1) be delivered through Agent responses without the user explicitly asking?
- What role should output practice (speaking/writing) play in a text-only agent environment?
- Should the plugin encourage the user to produce output, or only assist when they choose to?

### Feedback & Correction
- What forms of corrective feedback (recasts, prompts, explicit correction, metalinguistic explanation) work best in short chat interactions?
- Should feedback be immediate (inline) or delayed (end-of-session review)?
- How do we correct without embarrassing the user or breaking their flow?
- Does the user's stated preference for "show me why" align with what SLA research says is effective?

### Memory & Review
- What's the evidence that spaced repetition works for vocabulary acquired incidentally (vs. intentionally studied)?
- How should review prompts be timed relative to agent sessions? During? Between? At session start?
- Can retrieval practice happen naturally within agent conversations, or does it need dedicated review moments?

### Proficiency & Adaptation
- How should the plugin adapt its behavior for beginner vs. intermediate vs. advanced learners?
- How does the strategy change across target languages (e.g., English vs. Japanese vs. Arabic vs. Spanish)?
- Should the plugin assess proficiency, or let the user self-declare?

## Workflow Questions

### Vibe Coding
- During vibe coding, what language-learning opportunities exist that don't disrupt the coding task?
- Code comments, variable names, commit messages — are these valid language practice?
- How do error messages and debugging discussions become vocabulary/grammar learning moments?

### Vibe Research
- During vibe research (reading papers, searching, summarizing), how can the plugin enhance language learning?
- Should the plugin help with reading comprehension of source materials in the target language?
- Can summarization tasks double as output practice?

### Intervention Timing
- Should learning interventions happen inline (mid-conversation), at task boundaries, or in separate review sessions?
- What signals indicate the user is receptive to a learning nudge vs. deep in flow?
- How do we avoid the plugin becoming "spam"?
- Which findings are communication risks that justify pre-submit interruption, versus learning opportunities that should wait until after send?
- What latency can users tolerate for ghost completion, explicit draft checking, and submission preflight?

### Proactive vs. Reactive
- When (if ever) should the plugin proactively offer language help without being asked?
- Could lightweight "notice this?" nudges work, or would they be annoying?
- Is the user's preference for "I lead, plugin supports" a universal design principle or specific to their learning style?

## Synergy Integration Questions

### Plugin Architecture
- What hooks/APIs does Synergy expose for plugins to intercept or augment conversation?
- Can a plugin access the current conversation context (user message, agent response) in real time?
- How does plugin tool registration work? Can tools be invoked mid-conversation?
- Can `composer.above` plus plugin operations/events provide an accessible, revision-bound suggestion card without a Synergy host change?
- Does selected-text Explain require a new host-owned result popover or can an existing plugin surface remain in flow?
- How should system-context injection identify user-facing root Agent work and exclude small, internal, or delegated calls?
- How should the transform remain idempotent across Synergy's `budget` and `final` prompt phases?

### Storage & Persistence
- Where should VibeLingo store: user preferences, vocabulary lists, error patterns, review schedules?
- Can it use Synergy memory (semantic) for vocabulary? Notes (document) for progress? Agenda for review scheduling?
- What are the privacy implications of storing conversation excerpts?
- Where should Plugin API 3 business data live when Synergy does not provide a generic plugin data store or data-directory Host Service?
- What minimum fragment and provenance data is required to answer “where have I made this mistake?” without storing full messages?

### Agent Interaction
- Can a plugin interact with Synergy subagents (e.g., ask a subagent to generate a vocabulary quiz)?
- How does a plugin's tool output appear to the user in different conversation surfaces (web, Feishu)?
- Can a plugin modify or annotate the agent's response before it reaches the user?

### Permissions & Consent
- What permissions does a plugin need to read conversation content?
- How does the user opt in/out of data collection for learning purposes?
- Can VibeLingo work without storing any conversation data (stateless mode)?
- How should a progressive opt-in product request capabilities when manifest approval is static?

## Product Questions

### MVP
- What is the smallest feature set that delivers real value?
- Should MVP focus on one use case (e.g., input assistance only) or cover all three?
- Is a CLI/tool-based interface (@vibe-lingo ...) sufficient for MVP?
- Should submission-blocking preflight remain a later experiment until completion and post-send notes prove useful?

### Differentiation
- What does VibeLingo offer that Duolingo, Anki, Grammarly, LanguageTool, or ChatGPT don't?
- Is "in-flow, agent-native" enough of a differentiator, or do we need a unique pedagogical approach?

### Metrics
- How do we measure learning effectiveness without being annoying (no pop quizzes)?
- What engagement metrics indicate value (assistance requests per session, words reviewed, errors corrected)?
- What failure signals should trigger a redesign (plugin disabled, requests ignored, negative feedback)?

### Risks
- What if the plugin makes users more dependent on assistance rather than more independent?
- What if incorrect AI suggestions reinforce errors rather than correct them?
- What if the plugin feels like surveillance, making users self-conscious about their language use?

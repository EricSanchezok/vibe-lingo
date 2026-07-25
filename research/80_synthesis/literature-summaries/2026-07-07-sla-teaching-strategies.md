# SLA Teaching Strategies for Agent-Native Language Learning

## Bottom Line

The current best answer in 6 bullets:

1. **Input + output + interaction is the non-negotiable trio**. Comprehensible input from Agent responses is necessary but not sufficient (immersion produces comprehension without production). The user's act of writing prompts in the target language IS valid output practice (Swain's three functions activate). Agent conversation provides interaction (negotiation of meaning) — this is the strongest-supported SLA mechanism. VibeLingo must scaffold ALL THREE.

2. **Prompts beat recasts for written feedback**. When polishing user expression, use metalinguistic hints + invitation to self-correct (prompts) rather than silently rewriting text (recasts). Meta-analytic evidence: prompts d=0.83 > recasts d=0.53 (Lyster & Saito, 2010). The user's preference for "show me why" is supported by evidence.

3. **Dual-mode feedback timing solves the interruption problem**. During composition: immediate, inline feedback. During coding/reading: defer to session boundaries. Never interrupt deep work with language corrections. The dual-mode approach resolves the tension between learning effectiveness (immediate) and flow preservation (delayed).

4. **Incidental vocabulary learning is real but slow — 9-18% per session exposure (Webb et al., 2023). Requires 10-15 encounters for durable learning.** Passive in-context exposure works (Broccoli: 50% better short-term retention than memorization), but spaced repetition is essential for long-term retention. VibeLingo's "word book" must capture from both user output (highest involvement) and agent input, then schedule FSRS-based review at session boundaries.

5. **FSRS is the right SRS engine**. Open source (MIT), state-of-the-art (used by Anki since v23.10), 20-30% fewer reviews than SM-2 for equal retention. Cold start: use default parameters for first ~1,000 reviews, then personalize. Seed initial difficulty from LLM-based word complexity estimates (complexity is the #1 predictor of forgetting rate — Zaidi et al., 2020).

6. **Incidental learning = integrated motivation. No gamification needed.** The user's desire to "live in the target language during agent work" maps to SDT's highest-quality motivation (integrated regulation) and Dörnyei's Ideal L2 Self. LingoQ (Yang et al., 2026) validates that work-integrated learning sustains engagement. Points/streaks may backfire by reframing authentic communication as a game.

## Evidence Base

### SLA Foundations (4 concept notes)
- `research/10_learning-science/second-language-acquisition/comprehensible-input.md` — CI is necessary but not sufficient (Lichtman & VanPatten, 2021; Nguyen & Doan, 2025)
- `research/10_learning-science/second-language-acquisition/output-hypothesis.md` — Output triggers noticing, hypothesis testing, metalinguistic reflection (Swain, 1985, 1995)
- `research/10_learning-science/second-language-acquisition/interaction-hypothesis.md` — Negotiation of meaning drives acquisition; text-based CMC is effective modality (Long, 1981, 1996; Loewen & Sato, 2018)
- `research/10_learning-science/second-language-acquisition/noticing-hypothesis.md` — Weak claim (conscious attention helps) accepted; "show me why" is theoretically justified (Schmidt, 1990, 2001)

### Feedback & Correction (2 concept notes)
- `research/10_learning-science/feedback-and-correction/corrective-feedback-types.md` — Six-type taxonomy; prompts > recasts for learning; metalinguistic feedback is optimal for text-based interaction (Lyster & Ranta, 1997; Lyster & Saito, 2010)
- `research/10_learning-science/feedback-and-correction/feedback-timing.md` — Dual-mode: immediate during composition, deferred during coding/reading; written CF effects decay without review (Kang, 2022)

### Memory & Vocabulary (2 concept notes)
- `research/10_learning-science/memory-and-spaced-repetition/spaced-repetition-systems.md` — FSRS recommended; spacing effect robust (Cepeda et al., 2006); retrieval practice > passive review (Roediger & Karpicke, 2006)
- `research/10_learning-science/second-language-acquisition/incidental-vocabulary-acquisition.md` — 9-18% per session; 10-15 encounters needed; involvement load predicts retention (Webb et al., 2023; Hulstijn & Laufer, 2001; Aydin et al., 2020)

### Motivation & LLM Learning (2 concept notes)
- `research/10_learning-science/motivation-and-habit/l2-motivation.md` — SDT autonomy + L2MSS Ideal Self; incidental framing = integrated motivation; avoid gamification (Dörnyei, 2005; Deci & Ryan, 1985; Alberts et al., 2024)
- `research/10_learning-science/pedagogy/llm-chatbot-language-learning.md` — Chatbot learning has affective benefits; grammar-controlled LLM output is feasible; LingoQ validates work-integrated approach (Huang et al., 2025; Yang et al., 2026)

## Analysis

### The Theoretical Tension Is a Design Asset

The SLA literature contains productive tensions that VibeLingo can exploit rather than resolve:

- **Input vs. Output**: Krashen says input is primary; Swain says output is necessary. The synthesis: BOTH are needed, and VibeLingo's agent-native environment naturally provides both. Agent responses = input. User prompts = output. The plugin's job is to enhance both channels.

- **Implicit vs. Explicit**: Schmidt says noticing helps; Krashen says acquisition is unconscious. The synthesis: explicit attention to form is useful for features the learner is ready to acquire, but shouldn't dominate. VibeLingo should offer explicit feedback as an opt-in layer, not a default.

- **Immediate vs. Delayed feedback**: SLA evidence favors immediate; UX evidence favors non-interruption. The synthesis: dual-mode timing — immediate during composition, deferred during task work.

- **Incidental vs. Intentional learning**: Incidental input drives vocabulary acquisition but at low rates; intentional review cements it. The synthesis: capture incidentally (passive, in-flow), review intentionally (brief, scheduled).

### What the Evidence Does NOT Tell Us

Critical unknowns that must be resolved through prototyping and user testing:

1. **Human-LLM interaction as SLA interaction**: No published research tests whether the Interaction Hypothesis mechanisms (negotiation of meaning, recasts, clarification requests) function the same way with an LLM interlocutor as with a human. CMC research supports text modality, but all studies are human-to-human.

2. **Optimal feedback frequency in agent sessions**: SLA research provides no guidance on how many corrections per session is optimal — the classroom context (teacher-student) doesn't translate directly to self-directed agent interaction.

3. **Minimum viable review session**: No research on whether 30-second micro-reviews are effective. The spacing effect literature studies intentional study sessions, not incidental micro-doses.

4. **Technical discourse as learning material**: Most SLA research uses narrative or academic texts. Agent sessions produce code, technical explanations, and mixed-language discourse — unknown incidental learning rates for this genre.

5. **Long-term engagement in work-integrated learning**: Only LingoQ provides >3-week data. No multi-month or multi-year studies of incidental, work-integrated language learning.

## Implications

### Teaching Strategy

1. **Default output-pushing**: Every user message in the target language is a learning opportunity. The plugin should detect struggle signals (pauses, edits, explicit help requests) and offer assistance — but only when the user is actively composing.

2. **Feedback format hierarchy**: Metalinguistic hint → elicitation → explicit correction. Start with the highest-learning format; fall back to simpler formats if the user doesn't self-correct.

3. **Vocabulary triage**: Capture candidate words → rate context quality (via LLM) → prioritize by involvement load. User-authored words (highest priority) > looked-up words > passively encountered words.

4. **Review at boundaries**: Brief review sessions (30s-2min) at session start, session end, and between major task switches. Active recall format (translation, not flashcards).

### Product Behavior

1. **Composition mode detection**: The plugin must distinguish "user is writing a message" from "user is coding/researching." This is a technical challenge for Synergy integration.

2. **Correction queue with prioritization**: Not every error deserves a correction. Focus on pattern errors (recurring, at developmental level) > meaning-impairing errors > stylistic issues.

3. **Persistent word book**: Every word carries: lemma, L1 translation, context snippet, complexity score, concreteness score, first-encounter date, encounter count, FSRS state (D, S, R). Stored in Synergy memory/notes.

4. **No gamification**: The core value proposition is intrinsic. User-controlled frequency, dismissibility, and privacy are the motivational foundations.

### Synergy Integration

1. **Plugin needs conversation access**: Must read user input and agent output to detect language-learning opportunities.
2. **Storage in Synergy memory/notes**: Word book and error patterns in notes (structured), user preferences in memory (key-value).
3. **Review scheduling via Synergy agenda**: Schedule review prompts based on FSRS parameters.
4. **Tools as interaction surface**: `@vibe-lingo help/polish/explain` commands as explicit invocation points; automatic detection for passive features.

### Data/Storage Implications

- **Must store**: Target language, proficiency level, vocabulary entries (with FSRS state), error patterns, review history.
- **Must NOT store**: Full conversation history (privacy), raw user messages beyond context snippets, identifiable personal data without consent.
- **Should consider**: Differential privacy for proficiency estimates, local-first storage option, opt-in data sharing for research.

## Open Questions

- Can the dual-mode feedback timing be implemented reliably given Synergy's plugin architecture?
- What is the minimum context snippet length needed for meaningful vocabulary review?
- How does the FSRS cold start period affect the initial user experience?
- Should the word book be user-visible and editable, or fully automated?
- What happens when the user switches between multiple target languages?
- How to handle code-switching: parts of a message in L1, parts in L2?

## Recommended Next Step

Move to Synergy platform architecture research (Pathway step 2). The teaching strategy is evidence-grounded and ready to be constrained by platform feasibility. Key question to answer: **Can Synergy plugins access conversation content in real time, and can they schedule deferred actions (review prompts) through the agenda system?**

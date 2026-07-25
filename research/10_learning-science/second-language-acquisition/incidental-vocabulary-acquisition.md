# Incidental Vocabulary Acquisition

## Summary

Incidental vocabulary acquisition refers to learning words as a byproduct of meaning-focused activity (reading, listening, viewing, conversation) rather than through intentional memorization. Research consistently shows that incidental learning is real but slow: a single exposure session yields 9-18% word learning rates (Webb et al., 2023). Multiple exposures, richer contexts, and higher learner involvement significantly increase learning. For VibeLingo, this means agent sessions are genuine vocabulary-learning opportunities, but the plugin must actively support the learning process — through vocabulary capture, spaced review, and involvement-enhancing design — to convert incidental encounters into durable knowledge.

## What We Know

### How Much Is Learned

- **Meta-analytic estimate (Webb et al., 2023)**: 9-18% of target words learned on immediate posttests; 6-17% retained on delayed tests (average 34-day delay).
- **Form recognition**: 18% immediate → 6% delayed (sharp decay).
- **Meaning recognition**: 15% immediate → 17% delayed (surprisingly durable).
- **Meaning recall**: 9% immediate → 12% delayed (hardest to acquire but most durable).

### What Affects Learning

- **Number of encounters**: Estimates range from 6 (Rott, 1999) to 20+ encounters (Waring & Takaki, 2003) needed for reliable learning. Webb (2007) found >10 encounters needed.
- **Context quality matters more than quantity**: Webb (2008) found richer contexts produce better meaning learning even with fewer encounters.
- **Learner proficiency**: More proficient learners learn more (g=1.40 vs 0.70 for basic learners).
- **Text type**: Narrative texts (g=1.43) > expository (g=0.61).
- **Text audience**: L2-learner materials (g=1.56) > L1-native materials (g=0.71).
- **Spacing**: Spaced encounters (g=1.51) > massed (g=0.97).

### The Involvement Load Hypothesis (Hulstijn & Laufer, 2001)

Three dimensions determine a task's vocabulary-learning potential:
- **Need**: Is understanding/using the word necessary?
- **Search**: Does the learner look up or infer meaning?
- **Evaluation**: Does the learner compare or assess usage?

Tasks with higher involvement produce better retention: composition-writing > reading + gap-fill > reading only.

### Passive In-Context Learning Works (Broccoli — Aydin et al., 2020)

- Passive word-replacement achieved **50% better short-term retention than explicit memorization**.
- Long-term retention equivalent to memorization, with lower cognitive load.
- Natural reading patterns are compatible with spaced repetition intervals.

## Design Relevance

### Vocabulary Capture Strategy

VibeLingo should capture vocabulary from two streams, with involvement-based priority:

1. **User output stream (HIGHEST priority)**: When the user writes code, prompts, or documentation that contains target-language words — maximum involvement (Need + Search + Evaluation).
2. **Agent response stream (MODERATE priority)**: Words in agent responses the user reads and acts on. Moderate involvement (Need present if comprehension required).
3. **Passive exposure stream (LOWEST priority)**: Words in agent responses the user skims. Low involvement, but Broccoli shows this still drives learning.

### Involvement Enhancement

- **Search triggers**: Highlighted or subtly marked words that invite optional look-up.
- **Evaluation nudges**: Brief "this word appeared 3 times today" summaries.
- **Composition suggestions**: During user writing, suggest target-language alternatives.

### Exposure Requirements

- Target 10-15 encounters per word for reliable incidental learning (Webb 2007, Waring & Takaki 2003).
- Spread encounters across sessions, not within one session.
- Use LLM-based assessment to identify words in rich, guessable contexts for priority capture.

### The "Word Book" Design

Each vocabulary entry stores: word/lemma, L1 translation, original context snippet(s), complexity score, concreteness score, date first encountered, encounter count, SRS state (D, S, R in FSRS terms).

## Risks / Misuses

- **Incidental learning alone is too slow**: 9-18% per session means ~5-11 sessions of exposure needed — without review. SR is essential.
- **Technical/agent discourse may be suboptimal**: Expository text produces lower incidental learning (g=0.61) than narrative (g=1.43).
- **Over-capture**: Capturing every unknown word floods the review queue.
- **Context poverty**: Some agent-session contexts provide minimal clues to word meaning.

## Supporting Sources

- `research/60_evidence-bank/papers/2026-07-07-webb-incidental-meta-analysis.md`
- `research/60_evidence-bank/papers/2026-07-07-aydin-broccoli.md`
- `research/60_evidence-bank/papers/2026-07-07-hulstijn-involvement-load.md`

## Open Questions

- Should VibeLingo capture vocabulary from Agent responses, User writing, or both? Evidence suggests both, with User output prioritized.
- How many encounters are needed when exposure is spread across days?
- What incidental learning rate is achievable from technical/agent-specific discourse?
- Can Broccoli-style word replacement translate to chat-based interfaces?
- Can an LLM reliably identify "high-quality" incidental learning moments?

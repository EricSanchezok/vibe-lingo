# Broccoli: Sprinkling Lightweight Vocabulary Learning into Everyday Information Diets

## Metadata

- Type: paper
- Date captured: 2026-07-07
- Source URL / path: arXiv:2104.07941v1 (published at WWW 2020)
- Authors / organization: Roland Aydin, Lars Klein, Arnaud Miribel, Robert West (EPFL, HZG, byrd valley)
- Year: 2020
- Reliability: high (controlled within-subject study, 58 participants, open-source implementation)
- Tags: sla, incidental-learning, vocabulary-acquisition, embedded-learning, context-based-learning

## Why It Matters

This is the closest existing research paradigm to VibeLingo: embedding vocabulary learning into a user's existing workflow without requiring conscious effort. Broccoli replaces words with translations during normal web browsing. Results show **50% higher short-term retention than explicit memorization** and equal long-term retention — with lower cognitive load. Directly validates VibeLingo's core hypothesis about passive, in-context vocabulary acquisition.

## Key Claims

- **Passive in-context learning beats explicit memorization in the short term**: 50% higher retention (p < 10^-4).
- **Long-term retention is equivalent** to explicit memorization (both ~30% at 1-4 weeks, 50% above random guessing).
- **Drastically lower cognitive load**: users report significantly less use of mnemonic strategies.
- **Natural information diets are SR-compatible**: Word frequencies in browsing and e-book reading naturally space exposures at effective intervals.
- **Context quality matters**: Words in richer, more guessable contexts (selected by language model) are learned better.
- **Reading speed overhead is minimal** (~10%).

## Evidence / Details

- **Within-subject**: 58 participants, 3 conditions (pre-table memorization, Broccoli, post-table memorization).
- **Target language**: Finnish (minimal overlap with participants' known languages).
- **78 word pairs**, fully counterbalanced; 7 exposures per word across 5-6 Wikipedia pages.
- **Short-term MC retention**: pre-table ~38%, Broccoli ~60%, post-table ~35%.
- **Long-term MC retention**: all ~30% (50% above random).
- **Deliberately disadvantaged Broccoli** by placing it in the middle position (recency/primacy effects should hurt it).
- **Cognitive load measure**: self-reported mnemonic strategy usage was significantly lower in Broccoli.

## Implications for VibeLingo

- **Passive in-context exposure WORKS**: VibeLingo does not need to force explicit flashcard review — in-context recognition alone drives learning.
- **But explicit SR is still needed for long-term retention**: The 60% → 30% drop proves review is essential. Broccoli + spaced repetition = the ideal combo.
- **Context quality heuristics**: LLM-based context assessment can identify "high-quality" exposures during agent sessions.
- **Low cognitive overhead is a feature, not a bug**: Users prefer tools that don't feel like studying. VibeLingo must preserve the agent-workflow experience.
- **"Install-and-forget" paradigm**: This is the most powerful UX value proposition — minimal conscious decisions from the user.

## Limitations

- Single learning session; doesn't test extended use over weeks/months.
- Finnish-specific; may not generalize to non-Latin scripts.
- Wikipedia content only; real agent sessions have more diverse, technical content.
- No active recall during learning — only passive recognition.
- 7 exposures/word is a high "dose" for one session.

## Follow-up Questions

- Minimum contextual exposures needed per word for reliable learning?
- How does effectiveness change when exposures are spread across days (real agent sessions)?
- Can Broccoli-style word replacement be adapted to Synergy's chat-based conversation surface?

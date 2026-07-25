# Adaptive Forgetting Curves for Spaced Repetition Language Learning

## Metadata

- Type: paper
- Date captured: 2026-07-07
- Source URL / path: arXiv:2004.11327v1 (published at AIED 2020)
- Authors / organization: Ahmed Zaidi, Andrew Caines, Russell Moore, Paula Buttery, Andrew Rice (University of Cambridge)
- Year: 2020
- Reliability: high
- Tags: sla, spaced-repetition, forgetting-curve, language-learning, word-complexity

## Why It Matters

Demonstrates that incorporating linguistic features — especially word complexity — into forgetting curve models significantly improves recall prediction. The finding that word complexity is the most predictive feature for vocabulary forgetting directly informs how VibeLingo should tag vocabulary items captured from agent sessions.

## Key Claims

- **Word complexity is the single most predictive feature** for vocabulary recall probability.
- Neural network model (N-HLR+) achieves lowest MAE (0.105) vs. linear baselines.
- Incorporating complexity directly into the forgetting curve function (C-HLR+: p = 2^(-Δt·Ci/h)) outperforms adding it as a side feature.
- Concrete words are easier to remember than abstract words.
- Corpus frequency (SUBTLEX) and simple user ID embeddings are insufficient for ESL learner modeling.

## Evidence / Details

- Dataset: ~4.28M learner-word datapoints from Duolingo English learners.
- Base: Half-Life Regression (HLR): p = 2^(-Δ/h).
- Results progression: Pimsleur MAE=0.396 → Leitner 0.214 → HLR 0.195 → HLR+ 0.129 → C-HLR+ 0.109 → N-HLR+ 0.105.
- Neural network learned to weight: complexity (highest) > percent known > concreteness > SUBTLEX > user ID.
- More complex words have steeper forgetting curves — they need closer review spacing.

## Implications for VibeLingo

- **Vocabulary metadata is essential**: Each word in the "word book" should carry complexity, concreteness, and frequency scores.
- **Differential scheduling**: High-complexity, low-concreteness words need closer review intervals than simple, concrete words.
- **Neural personalization**: As review data accumulates, a light neural model can learn personalized forgetting parameters.
- **Capture heuristics**: During initial vocabulary capture, prioritize concrete words; flag abstract/complex words for different treatment.
- **Word-complexity estimation**: VibeLingo can use an LLM or pretrained classifier to estimate complexity from a single agent-session encounter.

## Limitations

- Duolingo data (intentional, flashcard-style), not incidental acquisition.
- English-only; effects may differ for other language pairs.
- Does not address the initial capture problem.

## Follow-up Questions

- Do word complexity effects hold for vocabulary encountered in context (agent responses) rather than in isolation?
- How do complexity scores transfer across different L1→L2 language pairs?
- Can an LLM estimate a word's learnability from a single contextual encounter?

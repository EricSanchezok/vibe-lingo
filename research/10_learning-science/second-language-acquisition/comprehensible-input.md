# Comprehensible Input Hypothesis (Krashen)

## Summary

The Comprehensible Input Hypothesis, proposed by Stephen Krashen as part of his Monitor Model (1982, 1985), holds that second language acquisition occurs in "only one way" — by understanding messages that contain linguistic structures slightly beyond the learner current competence level, formulated as i+1. The learner must receive input that is comprehensible (understood through context, simplification, or non-linguistic cues) but slightly challenging. Focus on meaning — not form — drives acquisition. Conscious learning of rules serves only as a Monitor that checks output under limited conditions.

The hypothesis has been enormously influential but also heavily criticized. The current consensus, as articulated by Lichtman and VanPatten (2021), is that comprehensible input is **necessary but not sufficient** for full L2 proficiency. The core insight — that learners need exposure to understandable language — is well-supported. The stronger claim that input alone is sufficient has been falsified by immersion education studies showing grammatical deficits in students with rich input exposure but limited output opportunities.

## What We Know

**Supported elements:**

- Exposure to comprehensible L2 input is correlated with acquisition gains, particularly in vocabulary and reading comprehension.
- The implicit/explicit knowledge distinction (descended from the acquisition-learning distinction) is widely accepted in modern SLA (Ellis 2005, 2009).
- Extensive reading programs show moderate positive effects on L2 reading comprehension, vocabulary, and general proficiency (2025 Springer meta-analysis on extensive reading).
- Low-anxiety, meaning-focused environments facilitate language uptake — the core insight of the Affective Filter hypothesis survives.

**Disputed or falsified elements:**

- The i+1 formula is too vague to be operationalized or tested. No independent measure of i or +1 exists (McLaughlin 1987; Gregg 1984).
- Input alone does not produce full grammatical accuracy. French immersion students with years of CI still had significant deficits in production accuracy (Swain 1985).
- The Natural Order hypothesis (invariant acquisition order) has weak empirical support; individual variation and L1 transfer are stronger predictors.
- Modern neurolinguistics shows that language production engages distinct, broader neural networks than comprehension, suggesting both are necessary for complete linguistic development (Pulvermuller 2018; Nguyen and Doan 2025).
- The static i+1 model cannot scale to diverse learner needs; adaptive AI systems that track micro-skills outperform one-size-fits-all difficulty leveling (Paladines and Ramirez 2020; Lin et al. 2023).

**Modern synthesis:**

The neuro-ecological critique of Nguyen and Doan (2025) argues that meaningful language growth depends on learners detecting and acting on affordances in rich environments, not merely processing simplified input. Affordance theory (van Lier 2004) reframes learning as emerging from dynamic learner-environment interactions rather than passive absorption. This aligns with modern adaptive learning systems that personalize input based on real-time learner data.

## Design Relevance

### How This Shapes VibeLingo

**Baseline principle: Agent output is learning material.** The single strongest claim from CI research is that exposure to understandable language in the target language contributes to acquisition. When the agent responds to user prompts in the target language, every response is a piece of comprehensible input. VibeLingo should ensure that agent responses are genuinely comprehensible to the learner — which means the plugin needs some model of user proficiency to guide how the agent communicates.

**Input is necessary but not sufficient.** VibeLingo must not fall into the trap of believing that simply immersing the user in agent conversations will produce full proficiency. The immersion deficit finding (Swain 1985) shows that rich input without output produces lopsided competence: strong comprehension, weak production. VibeLingo needs explicit output-pushing mechanisms alongside input provision.

**Do not build for i+1; build for adaptation.** The specific i+1 formula is a design dead-end because it cannot be reliably operationalized. Instead, VibeLingo should adopt a dynamic adaptation model: track what the user understands and struggles with, adjust difficulty in response, and measure learning through interaction rather than external tests. The agent-native environment is uniquely suited to this because every interaction generates proficiency signals.

**The affective filter matters.** One of Krashen most durable insights is that anxiety blocks acquisition. The agent-native format has natural advantages: no peer judgment, user-controlled pace, private interaction. VibeLingo should preserve and amplify these advantages rather than introducing elements that increase affective pressure (mandatory output, public error display, punitive correction).

**Reading is valuable.** Extensive reading meta-analyses support the efficacy of sustained, self-selected L2 reading. In the agent context, the user spends significant time reading agent responses, code explanations, and generated text. VibeLingo should treat this reading time as learning time — and ideally help users select or adjust the difficulty level of what they read.

**The affordance model is more productive than the input model.** Instead of thinking about delivering i+1 input, VibeLingo should think about creating an affordance-rich environment where learners can detect and act on linguistic opportunities. An agent conversation is inherently affordance-rich: the user can ask for clarification, request simpler language, get definitions, see synonyms, and explore usage patterns. The plugin role is to make these affordances visible and actionable.

## Risks / Misuses

**Over-indexing on input-only pedagogy**: The most dangerous design error would be to assume that because CI is the best-known SLA theory, VibeLingo should be a CI-only tool. The evidence strongly suggests this would produce weak productive skills.

**Passive consumption without active engagement**: If VibeLingo only provides agent output for user reading, it replicates the immersion classroom problem — good comprehension, weak production. The plugin must actively scaffold user output too.

**Difficulty miscalibration**: If the agent consistently produces language well above or well below the user level, comprehensible input benefits evaporate. Input that is too hard generates frustration; input that is too easy generates no learning. The plugin must maintain a model of user proficiency and guide difficulty accordingly.

**Neglecting form while focusing on meaning**: The CI emphasis on meaning over form can lead to fossilization of errors. VibeLingo should include mechanisms for occasional focus on form — not grammar drills, but noticing-oriented feedback or form-focused recasts embedded in meaningful interaction.

**Assuming text-only equals sufficient**: CI was developed in the context of spoken language with multimodal cues (gestures, facial expressions, objects in context). Text-only interaction may provide less scaffolding for comprehension. VibeLingo may need to consider how to compensate for this (glosses, translations on hover, embedded definitions).

## Supporting Sources

- `research/60_evidence-bank/papers/2026-07-07-krashen-input-hypothesis.md` — Foundational text (Krashen 1985)
- `research/60_evidence-bank/papers/2026-07-07-lichtman-vanpatten-krashen.md` — 40-year retrospective review (Lichtman and VanPatten 2021)
- `research/60_evidence-bank/papers/2026-07-07-nguyen-neuro-ecological-critique.md` — Neuro-ecological critique (Nguyen and Doan 2025)
- Springer meta-analysis on extensive reading (2025) — confirms moderate positive effects of L2 reading on multiple proficiency dimensions
- Sutton audiovisual input meta-analysis (n.d.) — extends CI to multimodal contexts

## Open Questions

- Can an LLM/agent consistently produce i+1-level text for a learner whose level is unknown or dynamically changing?
- Does the exclusively textual nature of agent conversations (no audio, limited multimodal cues) reduce the comprehensibility and therefore the acquisition potential of input?
- What is the minimum effective dose of comprehensible input in an agent-native environment — how much interaction per session? Per week?
- How should VibeLingo estimate user proficiency (i) from unstructured agent conversation data rather than formal assessments?
- Does reading code/comments in the target language function as comprehensible input with different properties than reading prose?
- Should the agent simplify its language to be comprehensible, or should VibeLingo add comprehension support (glosses, translations) to make authentic agent output comprehensible?
- How does the CI evidence from classroom/immersion contexts transfer to self-directed, task-motivated adult learning in an agent environment?

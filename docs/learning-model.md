# Learning Model

VibeLingo treats real work as the practice context. The user is trying to code,
research, write, or plan; language learning supports that goal rather than
replacing it.

## Product principles

### Work first

Clear requests continue immediately. A correction is brief and appears before
the substantive response, but it does not require the user to restate the task.
Clarification is reserved for ambiguity that would materially change the work.

### Activity and evidence are different

Every successfully classified target-language attempt contributes to visible
practice activity. A message without a finding is not labelled "correct"; it is
simply authentic target-language use.

Learning patterns require stronger evidence. This keeps a sparse day of real
practice visible without manufacturing mistakes or mastery.

### Corrections create a noticing opportunity

The correction card places the user's fragment beside a more natural form. It
focuses attention on a concrete gap without turning the main response into a
grammar lesson. Focused mode selects one consequential, clearly unnatural, or
recurring issue. Strict mode may show one or two certain issues.

### Review requires retrieval and transfer

Review starts with unaided recall. Hints and repair remain useful practice, but
they do not count as independent success. A separate transfer task checks
whether the user can apply the pattern in a new work-like context.

### Progress claims stay evidence-bounded

Patterns move through `candidate`, `practicing`, and `verified` states.
`verified` means that the configured evidence conditions were met; it is not a
language level or permanent mastery claim.

## Pattern lifecycle

- The first accepted foreground correction creates a `candidate`.
- Two non-minor corrections across two Sessions promote a pattern to
  `practicing` and make it reviewable.
- Minor-only patterns require three corrections across at least two Sessions.
- `verified` requires two independent reviews, a later natural correct use,
  evidence from at least two Sessions, and at least seven elapsed days.
- A later accepted error records a lapse, returns the pattern to `practicing`,
  and schedules it for the next day.
- Ignored and rejected patterns do not enter coaching or review.

Review scheduling uses a transparent `1 → 3 → 7 → 14 → 30` day ladder. Failed,
assisted, or abandoned review returns in one day. Only unaided recall plus a
correct transfer task advances the interval.

## Proficiency and correction mode

- **Beginner** prioritizes comprehensibility, foundational forms, and simple
  explanations.
- **Intermediate** prioritizes transferable high-value corrections.
- **Advanced** prioritizes naturalness, collocation, register, and nuance.
- **Focused** ignores isolated minor slips and surfaces one high-value issue.
- **Strict** addresses every certain genuine issue and surfaces up to two.
- **Off** disables foreground correction without deleting learning history.

## Evidence basis

The design draws on established but context-dependent findings rather than
claiming that an agent conversation is a validated language course:

- Producing language can expose gaps and support hypothesis testing (Swain's
  Output Hypothesis).
- Comparing learner output with a target form can support noticing, while
  noticing alone does not establish acquisition (Schmidt).
- Corrective feedback is most useful when selective, interpretable, and paired
  with opportunities for modified output.
- Distributed retrieval generally supports longer retention better than massed
  restudy, but VibeLingo uses a simple deterministic schedule until its own data
  justifies a more adaptive model.

Useful starting references:

- Schmidt, R. (1990), “The Role of Consciousness in Second Language Learning,”
  *Applied Linguistics*, 11(2), 129–158.
- Swain, M. (2005), “The Output Hypothesis: Theory and Research,” in *Handbook
  of Research in Second Language Teaching and Learning*.
- Lyster, R. & Saito, K. (2010), “Oral Feedback in Classroom SLA,” *Studies in
  Second Language Acquisition*, 32(2), 265–302.
- Kang, E. & Han, Z. (2015), “The Efficacy of Written Corrective Feedback in
  Improving L2 Written Accuracy,” *The Modern Language Journal*, 99(1), 1–18.
- Cepeda, N. et al. (2006), “Distributed Practice in Verbal Recall Tasks,”
  *Psychological Bulletin*, 132(3), 354–380.

## Limits

- Model quality varies by language pair and configured Synergy model role.
- VibeLingo does not assess CEFR level or promise equal quality for every
  BCP-47 language.
- Translation, quotations, pasted material, and Agent-authored text are not
  independent learner output.
- Activity metrics measure use of the target language, not learning gains.
- Review evidence supports a local pattern claim, not general proficiency.

# AGENTS.md

## Project

VibeLingo is a Synergy Plugin API 4 plugin for work-first multilingual coaching,
evidence-based review, and selected-text translation.

## Source of truth

- `src/index.ts` owns plugin identity, capabilities, contributions, and public
  compatibility.
- `src/domain/` owns deterministic learning, scheduling, and privacy rules.
- `src/application/` owns use cases and public operation behavior.
- `src/infrastructure/` owns SQLite and query details.
- `src/ui/` owns trusted Solid surfaces and renderers.
- `docs/` contains current architecture and product decisions.

Verify host assumptions against the Synergy source tree or published Plugin API
documentation. Do not design around undocumented behavior.

## Implementation rules

- The user's real task always has higher priority than language coaching.
- Foreground correction cards are authoritative; asynchronous analysis may add
  metadata but must not alter what the user saw.
- Do not persist complete user messages, Agent responses, Session titles,
  private Agent prompts, or raw model output.
- Keep model calls outside SQLite transactions and make completion writes
  idempotent.
- Keep translation separate from independent learning evidence.
- Do not add automatic review invitations, proficiency scores, or mastery claims.
- Do not add compatibility or migration layers for unreleased schemas unless a
  release plan explicitly requires them.
- Update tests and the relevant document for every behavior or contract change.
- Never edit generated `dist/plugin.json` by hand.

## Verification

```bash
bun run typecheck
bun run test
bun run build
bun run validate
bun run pack
```

# Contributing to VibeLingo

Thanks for helping improve VibeLingo. The plugin is developed against Synergy's
stable Plugin API 4 contract.

## Development setup

Requirements:

- Synergy `>=3.0.11`
- Synergy plugin and plugin-kit npm packages `>=3.0.11` (the packages follow the Synergy product version; generated artifacts remain Plugin API `4.0`)
- Bun `>=1.3.0`

```bash
bun install
bun run typecheck
bun run test
bun run build
bun run validate
```

For an isolated local host:

```bash
export SYNERGY_HOME="$(mktemp -d)"
bun run dev -- --server-url http://127.0.0.1:PORT
```

## Repository structure

- `src/domain/`: deterministic learning and privacy rules.
- `src/application/`: learning, review, presentation, and translation services.
- `src/infrastructure/`: SQLite repositories and query support.
- `src/ui/`: trusted Solid surfaces and renderers.
- `test/`: domain, operation, storage, UI, and plugin-contract tests.
- `docs/`: current architecture, learning model, and durable product decisions.

## Change expectations

- Keep the main Agent's real task higher priority than language coaching.
- Keep `definePlugin()` as the single public plugin descriptor.
- Do not persist complete messages, Agent responses, Session titles, private
  Agent prompts, or raw model output.
- Add or update tests for behavior changes.
- Update the relevant document when a product or architecture decision changes.
- Verify Plugin API assumptions against the current Synergy source or official
  API documentation.
- Avoid compatibility layers for unreleased local schemas unless a release plan
  explicitly requires them.

## Before opening a pull request

Run:

```bash
bun run typecheck
bun run test
bun run build
bun run validate
bun run pack
```

`bun run release:check` runs the complete sequence against the published authoring packages.

Do not edit generated `dist/plugin.json` by hand and do not commit local plugin
archives, databases, or Synergy home directories.

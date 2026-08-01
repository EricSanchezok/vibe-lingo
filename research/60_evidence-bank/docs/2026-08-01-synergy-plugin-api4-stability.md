# Synergy Plugin API 4 Stability Contract

## Metadata

- Type: docs | code
- Date captured: 2026-08-01
- Source path: `/Users/eric/projects/synergy/packages/plugin/src/descriptor.ts`, `/Users/eric/projects/synergy/packages/plugin/src/version.ts`, `/Users/eric/projects/synergy/docs/plugins/manifest.md`, `/Users/eric/projects/synergy/docs/plugins/runtime-and-permissions.md`
- Authors / organization: Synergy
- Year: 2026
- Reliability: high
- Tags: synergy-plugin, mvp

## Why It Matters

VibeLingo depends on recently added API4 surfaces including selected-text actions, trusted result popovers, detached Agent calls, and directed completion hooks. Its minimum compatible Synergy version must be expressed through the public compatibility contract rather than an internal transport revision.

## Key Claims

- `apiVersion: "4.0"` identifies the stable API4 family across additive SDK 4.x releases.
- `compatibility.synergy` is the public semver range for the oldest host implementing every stable feature used by a plugin.
- Runtime protocol revisions are host-owned and are not a plugin compatibility contract.
- `chat.system.transform` is the stable system-context hook; the experimental spelling remains only for early API4 artifacts.
- Installation approval compares structured access. Code-only or metadata-only updates do not require confirmation unless access broadens or publisher/source identity changes.

## Evidence / Details

`definePlugin()` now supplies a default API4 base range of `>=3.0.11`, emits it into the generated manifest, and exposes it in the manifest envelope before strict decoding. Current Synergy documentation requires new stable plugins to use `chat.system.transform` and describes approval as a structured publisher/access grant rather than exact manifest-hash consent.

## Implications for VibeLingo

- Declare `compatibility.synergy: ">=3.0.11"` explicitly.
- Replace `experimental.chat.system.transform` with `chat.system.transform`.
- Describe Plugin API 4 and the Synergy compatibility range in user documentation; do not require a runtime protocol number.
- Keep VibeLingo's existing capabilities and contribution requirements unchanged unless it adopts a later additive host feature.

## Limitations

The API4 npm packages were not yet published at capture time; local validation used the Synergy source packages. The dependency lockfile cannot resolve the declared `^4.0.0` packages from the registry until publication.

## Follow-up Questions

- After the API4 packages are published, regenerate and commit the Bun lockfile against the public artifacts.

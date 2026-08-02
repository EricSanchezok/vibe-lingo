# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or privacy
exposure. Use GitHub's private vulnerability reporting for this repository. If
that option is unavailable, contact the repository owner privately before
publishing details.

Include the affected VibeLingo and Synergy versions, reproduction steps, impact,
and any known mitigation. Do not include real credentials, private conversation
content, or another user's learning database in the report.

## Sensitive areas

VibeLingo handles selected text, bounded correction fragments, model output,
Scope/Session/message identifiers, and local learning history. Changes involving
these areas should preserve the following invariants:

- complete user messages and Agent responses are not persisted;
- private Agent prompts and raw model output are not persisted;
- sensitive fragments are omitted from durable content fields;
- translation source text is identified by hash and, when safe, a bounded
  preview rather than stored in full;
- plugin-owned data is removed during normal uninstall;
- background analysis failures cannot interrupt the main Session.

Only the latest development version is actively maintained while VibeLingo is
pre-release.

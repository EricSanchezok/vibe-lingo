# VibeLingo Design Language

VibeLingo inherits Synergy's typography, theme, and interaction tokens. Its own visual identity is expressed through a restrained learning palette and evidence-first hierarchy.

## Palette roles

- Sage ink: primary actions, active navigation, learning links, and positive progress.
- Pale sage: selected states, successful evidence, review invitations, and corrected expressions.
- Warm amber: new findings, pending analysis, hints, and attention states.
- Warm neutral: page backgrounds, borders, secondary copy, and inactive controls.

The implementation keeps these roles separate from Synergy's generic success colors: learning progress uses the muted Figma sage anchors (`#4a613b` and `#edf0e5`) with dedicated dark-theme counterparts, while failure and destructive states continue to use host semantic tokens. This prevents a custom theme's bright success green from changing VibeLingo's learning identity.

## Surface rules

- Use flat surfaces with quiet one-pixel borders and moderate 8–13px radii.
- Use pale color fields for meaning, not decoration.
- Avoid gradients, glow, heavy shadows, and nested card stacks.
- Keep tool cards compact enough to sit naturally inside a conversation.
- Progress cards summarize; the Dashboard owns exploration and history.

## State semantics

- Sage: recorded, verified, naturally used, or ready to continue.
- Amber: discovered, analyzing, assisted, or requiring attention.
- Critical host tokens: failed actions and destructive states only.
- Every state includes text or an icon; color is never the only signal.

## Accessibility

- Preserve Synergy focus rings and semantic text colors.
- Allow wrapping for every learner-provided or localized string.
- Collapse multi-column tool-card content on narrow screens.
- Respect `prefers-reduced-motion`.

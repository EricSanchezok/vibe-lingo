/**
 * VibeLingo's learning palette. Brand learning colors stay separate from
 * Synergy's semantic success colors, while light and dark themes remain explicit.
 */
export const learningThemeDeclarations = `
  --vibe-sage-ref-ink:light-dark(#4a613b,#a2b394);
  --vibe-sage-ref-strong:light-dark(#4a613b,#7f9271);
  --vibe-sage-ref-action:light-dark(#4a613b,#607453);
  --vibe-sage-ref-surface:light-dark(#edf0e5,#252b22);
  --vibe-sage-ref-surface-strong:light-dark(#e3e8d8,#2c3428);
  --vibe-sage-ink:var(--vibe-sage-ref-ink);
  --vibe-sage-strong:var(--vibe-sage-ref-strong);
  --vibe-sage-action:var(--vibe-sage-ref-action);
  --vibe-sage-surface:var(--vibe-sage-ref-surface);
  --vibe-sage-surface-strong:var(--vibe-sage-ref-surface-strong);
  --vibe-amber-ink:color-mix(in srgb,var(--surface-warning-strong) 72%,var(--text-strong));
  --vibe-amber-strong:color-mix(in srgb,var(--surface-warning-strong) 76%,var(--text-strong));
  --vibe-amber-surface:color-mix(in srgb,var(--surface-warning-weak) 78%,var(--surface-base));
  --vibe-warm-border:color-mix(in srgb,var(--border-base) 82%,var(--surface-warning-weak));
`

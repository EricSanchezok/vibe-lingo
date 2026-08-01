/**
 * VibeLingo's learning palette, derived from Synergy semantic tokens.
 * Keep this as CSS declarations so trusted surfaces remain theme-aware.
 */
export const learningThemeDeclarations = `
  --vibe-sage-ink:color-mix(in srgb,var(--text-on-success-base) 72%,var(--text-strong));
  --vibe-sage-strong:color-mix(in srgb,var(--surface-success-strong) 58%,var(--text-strong));
  --vibe-sage-action:light-dark(#4a613b,#708861);
  --vibe-sage-surface:color-mix(in srgb,var(--surface-success-weak) 76%,var(--surface-base));
  --vibe-sage-surface-strong:color-mix(in srgb,var(--surface-success-weak) 88%,var(--surface-base));
  --vibe-amber-ink:color-mix(in srgb,var(--surface-warning-strong) 72%,var(--text-strong));
  --vibe-amber-strong:color-mix(in srgb,var(--surface-warning-strong) 76%,var(--text-strong));
  --vibe-amber-surface:color-mix(in srgb,var(--surface-warning-weak) 78%,var(--surface-base));
  --vibe-warm-border:color-mix(in srgb,var(--border-base) 82%,var(--surface-warning-weak));
`

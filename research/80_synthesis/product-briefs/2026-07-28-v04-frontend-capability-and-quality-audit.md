# VibeLingo v0.4 Frontend Capability and Quality Audit

## Bottom Line

- The trusted sidebar surface implements every state represented by the fourteen-screen Figma contract.
- The browser remains a projection of typed backend state: it does not reproduce lifecycle, schedule, verification, or evidence calculations.
- Review starts only after a user action; due-only remains the backend default, while explicit batches may include items due within seven days.
- Settings has one implementation shared by the native settings surface, first-run activation, and the dashboard settings route.
- Canonical pattern metadata remains stable; localized presentation is bounded, cached, invalidated by source changes, and fail-soft.

## Screen and Interaction Coverage

| Product state | Implementation |
|---|---|
| Overview | learning week, streak, active days, heatmap, four evidence curves, journey preview, review callout, recent natural use |
| Recall | phase-safe prompt, answer field, submit, pause, abandon |
| Hint | two progressive hints without exposing the reference answer |
| Repair | evaluator feedback, natural expression, corrected response |
| Transfer | new task, optional hint, independent/assisted outcome |
| Completion | four evidence totals, per-pattern outcomes, next due, journey-record link |
| Pattern list | search debounce, status/Scope/sort filters, desktop table, mobile cards, opaque cursor pagination |
| Pattern detail | localized rule, schedule, evidence chart/timeline, review history, contexts, pattern review |
| Pattern actions | ignore/restore, confirmed not-error/delete, searched and confirmed merge |
| Journey | event/time/Scope filters and opaque cursor pagination |
| Record | bounded evidence, pattern and review summary, current-Scope Session link |
| Profile menu | current and historical language profiles, keyboard menu, profile switching |
| Configured settings | shared trusted settings component, compact summary, confirmed target/all cleanup |
| First run | profile-required activation with no coaching, analysis, or dashboard data before save |

## Robustness and Edge Cases

- Route parsing rejects malformed UUIDs and pattern keys and falls back to Overview, Patterns, Journey, or Review as appropriate.
- All view queries use abort signals so old responses cannot replace newer filter/profile state.
- Settings, learning, and review events invalidate snapshots; event bursts are debounced.
- Profile switches are optimistic but roll back and notify on failure.
- Pattern localization is requested in visible-page batches, not once per row.
- Presentation results are discarded if the active language pair changed while the Agent was running.
- Review command retries reuse a request ID after transport failure; revision conflicts reload current state.
- Abandoned and paused reviews render recoverable states without dereferencing a missing current item.
- Destructive pattern/data commands use the Synergy confirmation surface.
- Pagination uses backend cursors and a local cursor stack, never offset arithmetic.

## Accessibility and Responsive Audit

- Structure uses a single `main`, labeled tab navigation, real buttons, labeled form fields, live errors, and SVG chart summaries.
- Profile menu supports Escape, Arrow Up/Down, Home/End, outside-click dismissal, and focus return.
- Custom dialogs trap Tab focus, close on Escape/backdrop, and restore the invoking focus.
- Interactive controls have visible host-token focus rings and approximately 40–44 px targets.
- Reduced-motion preferences disable nonessential transitions.
- At widths below 720 px, tables become cards, grids stack, filters wrap, profile text collapses, and review actions become full-width.
- Chinese text is not put inside fixed-height containers; labels and rules wrap with `overflow-wrap`.
- Theme colors are semantic Synergy tokens; there is no independent blue AI palette, gradient, or hard-coded light-only background.

Automated browser-DOM coverage renders and asserts all fourteen states from the actual packaged Solid bundle. Full conformance still requires manual screen-reader and theme checks in the approved running Synergy generation.

### V0.7 conversation-surface supplement

- The foreground correction and explicit Progress Tool now use dedicated trusted renderers instead of generic Tool chrome.
- Progress summarizes authentic practice, active days, due review, verified evidence, and leading patterns; it does not show confidence, canonical keys, or provenance in the primary card.
- Both cards and the workspace derive sage, amber, and warm-neutral roles from Synergy semantic tokens, matching the Figma product tone without creating a light-only theme.
- Narrow cards collapse four metrics to two columns, wrap localized content, retain visible focus, and disable skeleton animation under reduced motion.

An isolated approved Synergy generation was also exercised at 1440 px, 1280 px, and 390 px widths. First-run activation, the populated Overview, desktop and mobile pattern lists, and the manual Review queue rendered without horizontal overflow, clipped Chinese text, or nested scrolling. This runtime pass found and corrected duplicate low-value chart ticks and an empty upcoming-review sidebar. Dark/custom-theme and screen-reader sessions remain explicit follow-up checks rather than inferred claims.

## Maintainability Audit

The frontend follows one direction:

```text
navigation component
  → route views and shared UI primitives
    → dashboard context and typed operation contracts
      → plugin operations and application services
```

The implementation deliberately has:

- one route parser/serializer;
- one settings controller and settings component;
- one dashboard context for profile, locale, routing, refresh, and presentation cache;
- one abortable resource helper;
- one shared pattern-presentation service and repository;
- one scoped dashboard style source plus the pre-existing standalone settings style source;
- no client-side learning store, copied scheduling rules, offset pagination, placeholder Dashboard operation, or compatibility UI.

## Remaining Boundaries

- The app does not notify, badge, or invite users to review.
- It does not implement Composer completion, preflight, decorations, vocabulary capture, FSRS, or automatic review.
- Localization copy is Simplified Chinese and English; other support languages receive English chrome plus localized pattern metadata.
- Hidden-Agent quality depends on the configured mini model.
- A newly changed trusted UI/permission hash must be approved before runtime visual dogfood can load the v0.4 generation.

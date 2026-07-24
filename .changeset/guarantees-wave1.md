---
'@responsivejs/core': patch
'@responsivejs/design': patch
'@responsivejs/runtime': patch
---

Guarantee-correctness fixes (external review, 2026-07-24):

- **A contract can never pass with zero checks.** Global rules (`noOverflow`,
  `breakpointSafe`) now imply a landmark default sweep set, and a run that performed no
  checks fails loudly with a `contract.noChecks` violation instead of passing 0/0.
- **Report counters are mathematically valid.** `failed` counts failed *checks* (one check
  can carry several violations — minSize failing width AND height); `passed = total −
  failed` can no longer go negative. Applies to Asserter reports and contract reports.
- **`touchTarget` sees native controls.** The collector now captures DOM semantics
  (`tagName`, `interactive`: native controls, interactive roles, tabindex ≥ 0, not
  disabled); a `<button>` with `cursor: auto` is checked. `cursor: pointer` remains the
  behavioral fallback; unrendered (0×0) controls are skipped.
- **`breakpoint.below(px, value)` without a fallback no longer leaks globally**: the static
  emission is `@media (max-width: px−1)`-guarded instead of an unguarded declaration.

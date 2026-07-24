---
'@responsivejs/contract': minor
'@responsivejs/design': minor
---

`touchTarget` gains a `min` parameter (registry, JSON Schema, Asserter, dispatch) and its
default changes from 44 to **24px — the WCAG 2.5.8 (AA) floor** — keeping the default set
low-false-positive; raise to platform guidance per rule (`min: 44/48`), per analyze run
(`constraints: { touchTarget: { min } }`), or from the CLI (`--touch-min`). Design-system
profiles now actually enforce their declared `accessibility.touchTarget.min`: Material
Design 3 checks 48px instead of silently falling back to the old default. Violation details,
`expected`, and the structured `fix` all follow the configured minimum.

---
'@responsivejs/runtime': minor
---

**Geometry predicates** — state derived from measured geometry, the niche CSS still can't
express: `whenWraps`, `whenOverflows`, `whenTruncated`, `whenStuck`, `linesOf`,
`whenCollides`, wired by `geometry(target, { wrapped: whenWraps })` into data-attributes
(JS detects, CSS styles: `.nav[data-wrapped] { … }`). Re-measures off the shared
ResizeObserver hub, viewport resizes, and — for sticky/collision predicates — a shared
capture-phase scroll tick. SSR-inert. New hub primitives: `elementSize(el)` and
`scrollTick()`.

**Typed breakpoints** — `defineBreakpoints({mobile: 320, …} as const)` now returns an API
typed on your names: `bp.below('mobile')` autocompletes, a typo is a compile error.
`below/above/between/match/width/matches(name)` all name-checked; still configures the
global runtime as before.

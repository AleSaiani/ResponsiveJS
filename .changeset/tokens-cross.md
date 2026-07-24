---
'@responsivejs/runtime': minor
---

**Token bridge** — `responsive.tokens({'--space-md': fluid(8, 16)})`: fluid values as CSS
custom properties on `:root`. Linear values compile to a static `clamp()` stylesheet (zero JS
at runtime); non-linear/conditional values update their variable from one viewport effect.
`toDTCG()` exports Design-Tokens-Community-Group JSON with responsive curves sampled under
`$extensions`; `css` is the SSR-shippable stylesheet.

**Cross-element dependencies** — `fromElement('.sidebar')` as a fluid `domain` (the value
follows another element's width), `sync(target, 'height'|'width')` (equal sizes across
unrelated containers, max natural size wins), and `ratio(a, b, {min, max})` (the design
constraint promoted to active enforcement: keeps the width ratio in bounds, frees the layout
while it complies).

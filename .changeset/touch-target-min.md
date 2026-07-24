---
'@responsivejs/contract': minor
'@responsivejs/design': minor
---

`touchTarget` gains a `min` parameter (registry, JSON Schema, Asserter, dispatch). Default
stays 44px (platform/AAA guidance; WCAG 2.5.8 AA minimum is 24 — pass `min: 24` for the
letter of AA). Design-system profiles now actually enforce their declared
`accessibility.touchTarget.min`: Material Design 3 checks 48px instead of silently falling
back to 44. Violation details, `expected`, and the structured `fix` all follow the
configured minimum.

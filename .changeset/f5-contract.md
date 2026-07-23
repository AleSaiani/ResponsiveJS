---
'@responsivejs/contract': minor
'@responsivejs/design': minor
---

Design-contract DSL (F5): new `@responsivejs/contract` package — versioned JSON format with published JSON Schema (generated from a 27-constraint registry, drift-tested), fluent builder with round-trip guarantee, zero-dependency validator with did-you-mean errors. `@responsivejs/design` gains `verifyContract(contract, store | page)` (range-scoped rules, per-rule attribution, severity overrides, score thresholds, curve baselines with `recordBaseline`), new `visible`/`hidden` constraints, and `designSystemRules()` — design-system profiles are now contract-rule generators (`applyDesignSystem` delegates, parity-tested). Design-system JSON assets moved under `dist/` (subpath export unchanged).

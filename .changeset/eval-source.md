---
'@responsivejs/design': minor
---

Add `EvalSource`: a `MeasurementSource` over a bare `eval` primitive (agent-browser, browser
extensions, bookmarklet hosts). Optional `setViewport`/`open` callbacks; without a viewport
setter the source verifies the live width (`currentWidth()`) instead of mis-reporting it.
JSON-string wire results from text transports are parsed automatically, and `chunkedEval`
composes over any EvalFn to carry oversized expressions (axe is ~500K) across argument-length
limits. `sweepSource` now accepts `SourceSweepOptions` with an optional `url` for pre-navigated
sources. Live agent-browser composition is covered by a dedicated e2e test.

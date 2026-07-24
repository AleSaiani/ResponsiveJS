---
'@responsivejs/design': minor
---

Add `EvalSource`: a `MeasurementSource` over a bare `eval` primitive (agent-browser, browser
extensions, bookmarklet hosts). Optional `setViewport`/`open` callbacks; without a viewport
setter the source verifies the live width (`currentWidth()`) instead of mis-reporting it.
JSON-string wire results from text transports are parsed automatically. `sweepSource` now
accepts `SourceSweepOptions` with an optional `url` for pre-navigated sources.

---
'@responsivejs/design': minor
---

The unified oracle (F3): `analyze()` merges geometry/responsive constraints, a11y (axe through the driver eval seam — `axe-core` optional peer), and the aesthetic score into one machine-readable `UnifiedReport` with severity summary, flattened fixes and SARIF output. New `MeasurementSource` contract with `PlaywrightSource` and dependency-free `CdpSource` adapters; driver-neutral `sweepSource`/`resweepSource`; one shared injectable in-page collector (`collectPage`) and an explicit wire format (`storeToJSON`/`storeFromJSON`) — also fixing `formatJSON` silently serializing score maps as `{}`. All existing APIs unchanged.

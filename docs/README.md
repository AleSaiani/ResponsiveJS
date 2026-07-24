# ResponsiveJS documentation

**Start here**

- [Getting started](getting-started.md) — install, pick your entry point, first examples
- [Concepts](concepts.md) — the `value = f(width)` model, snapshots, the oracle, CSS-first

**API reference**

- [@responsivejs/core](api/core.md) — geometry, curves, interpolation, color/WCAG/OKLab, typography, aesthetics, snapshot model
- [@responsivejs/runtime](api/runtime.md) — `responsive()`, `fluid()`, conditionals, layout/typography helpers, signals
- [@responsivejs/design](api/design.md) — `r$(page)`, the Asserter, `analyze()`, MeasurementSource, browser core, reporters
- [@responsivejs/contract](api/contract.md) — the contract format, registry, builder, loader, `verifyContract`
- [@responsivejs/cli](api/cli.md) — the `rjs` command line: analyze / verify / record, driver-pluggable

**Guides**

- [Responsive regression in CI](guides/ci.md) — assertions → oracle → contracts, SARIF, baselines
- [r$ for AI agents](guides/agents.md) — the fix loop, CDP/eval drivers, contracts as instructions

The aesthetic score is grounded in Ngo, Teo & Byrne (2003), *Modelling interface aesthetics*,
and Birkhoff (1933), *Aesthetic Measure* — see [api/core.md](api/core.md#aesthetics--the-17-metric-score).

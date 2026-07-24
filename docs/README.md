# ResponsiveJS documentation

**Start here**

- [Getting started](getting-started.md) — install, pick your entry point, first examples
- [Concepts](concepts.md) — the `value = f(width)` model, snapshots, the oracle, CSS-first
- [DIRECTION](DIRECTION.md) — the founding document: vision, surfaces, roadmap

**API reference**

- [@responsivejs/core](api/core.md) — geometry, curves, interpolation, color/WCAG/OKLab, typography, aesthetics, snapshot model
- [@responsivejs/runtime](api/runtime.md) — `responsive()`, `fluid()`, conditionals, layout/typography helpers, signals
- [@responsivejs/design](api/design.md) — `r$(page)`, the Asserter, `analyze()`, MeasurementSource, browser core, reporters
- [@responsivejs/contract](api/contract.md) — the contract format, registry, builder, loader, `verifyContract`

**Guides**

- [Responsive regression in CI](guides/ci.md) — assertions → oracle → contracts, SARIF, baselines
- [r$ for AI agents](guides/agents.md) — the fix loop, CDP/eval drivers, contracts as instructions

**Background**

- [Rating research](rating-research.md) — the literature behind the 17-metric aesthetic score

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

**Examples**

- [Fluid landing](../examples/landing) — every runtime construct on one real page, each
  documented as "the hack it replaces vs the construct" (wrap-driven burger, stuck shadow,
  fluid tokens, equal-height cards, cross-element type, typed breakpoints)

**Guides**

- **[The runtime guide](guides/runtime.md)** — using `r$` in JS/TS: the mental model, every
  construct explained with its purpose and gradual examples. Start here for authoring.
- [Runtime cookbook](guides/runtime-cookbook.md) — one recipe per construct: fluid tokens,
  wrap-driven burger, stuck shadow, truncation, equal heights, cross-element, typed breakpoints
- [Validation cookbook](guides/validation-cookbook.md) — zero-setup audit → CI gate →
  contract record/verify, reading scores, cutting false positives
- [Responsive regression in CI](guides/ci.md) — assertions → oracle → contracts, SARIF, baselines

**For AI agents** (compact, exact I/O)

- [Validation reference](agents/validation-reference.md) — commands, exit codes, report JSON
  shapes, the 27 constraints, contract skeleton, the fix loop
- [Authoring reference](agents/authoring-reference.md) — invariants, signatures, construct
  chooser, the minimal correct pattern
- [r$ for AI agents](guides/agents.md) — the narrative guide: drivers (CDP/eval/agent-browser),
  contracts as instructions

The aesthetic score is grounded in Ngo, Teo & Byrne (2003), *Modelling interface aesthetics*,
and Birkhoff (1933), *Aesthetic Measure* — see [api/core.md](api/core.md#aesthetics--the-17-metric-score).

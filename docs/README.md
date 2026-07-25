# ResponsiveJS documentation

One page per question — start from what you're trying to do.

| Your question | The page |
| --- | --- |
| What is this, where do I start? | [Getting started](getting-started.md) |
| **Teach me — I'll build along** | **[The tutorial](tutorial.md)** — empty page → fluid, measured, contract-pinned landing in 7 steps (~30 min) |
| How does the model work? | [Concepts](concepts.md) — `value = f(width)`, snapshots, the oracle, CSS-first |
| **How do I author responsive behavior in JS/TS?** | **[The runtime guide](guides/runtime.md)** — `r$.`: every construct's purpose, gradual examples, customizing & debugging |
| What's the pattern for MY problem? | [The pattern catalog](guides/case-studies.md) — every construct on a real problem, organized by what you're building; three unpacked end to end |
| **How do I validate/score a page?** | **[The design guide](guides/validation.md)** — `r$(page)`: measure → model → judge, `analyze()`, contracts, cutting false positives |
| How do I test all of this? | [Testing responsive behavior](guides/testing.md) — what's unit-testable vs what needs a browser, patterns and traps |
| How do I wire it into CI? | [CI guide](guides/ci.md) — pipelines, SARIF, baselines strategy |
| What's the exact signature of X? | API reference: [runtime](api/runtime.md) · [design](api/design.md) · [contract](api/contract.md) · [cli](api/cli.md) · [core](api/core.md) |
| A live page using everything | [Fluid landing example](../examples/landing) — run it, resize it, read its tutorial |
| The oracle inside DevTools | [The r$ devtool](../packages/devtool) — sweep, curve inspector, score HUD, contract recorder (load unpacked) |

**For AI agents** (compact, exact I/O — different documents on purpose):

- [Validation reference](agents/validation-reference.md) — commands, exit codes, report JSON
  shapes, the 27 constraints, contract skeleton, the fix loop
- [Authoring reference](agents/authoring-reference.md) — invariants, signatures, construct
  chooser, the minimal correct pattern
- [r$ for AI agents](guides/agents.md) — the narrative guide: drivers (CDP/eval/agent-browser),
  contracts as instructions

The aesthetic score is grounded in Ngo, Teo & Byrne (2003), *Modelling interface aesthetics*,
and Birkhoff (1933), *Aesthetic Measure* — see [api/core.md](api/core.md#aesthetics--the-17-metric-score).

# @responsivejs/cli

> The command line of [`r$`](https://github.com/AleSaiani/ResponsiveJS): audit, verify and
> record responsive design on any URL — zero setup, machine-readable, agent-loop-ready.

```bash
npx @responsivejs/cli analyze https://example.com -w 320,768,1280
```

The binary is **`rjs`**. Exit codes: `0` pass, `1` violations, `2` usage/run error.

```
rjs analyze <url>              sweep + oracle (constraints + aesthetic score + a11y)
rjs verify <contract> <url>    execute a design contract against a live page
rjs record <contract> <url>    measure and pin baseline curves into the contract
rjs doctor                     check drivers and environment readiness
```

Output formats: branded console report, `--format json`, `--format sarif` (code scanning).

## Drivers

`--driver auto` (default) picks the first available:

- **playwright** — chromium via the optional `playwright` peer; the CI driver.
- **[agent-browser](https://github.com/vercel-labs/agent-browser)** — Vercel's browser CLI:
  audits any live URL with nothing installed in the target project. Oversized injections
  (axe is ~500K) are chunked through the eval seam automatically.

## The record → verify loop

`verify`/`record` derive the whole sweep (selectors, widths, height) from the contract itself:

```bash
rjs record home.contract.json https://staging.example.com   # pin today's geometry
rjs verify home.contract.json https://pr-42.example.com     # regressions exit 1
```

Full reference: [docs/api/cli.md](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/api/cli.md) ·
License: MPL-2.0

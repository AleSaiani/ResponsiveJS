# r$ for agents

r$ is the **judgment** in your loop: you (or your browser tool) are the arm; r$ measures,
validates, and tells you exactly what to fix. Every output is machine-readable.

## The loop

```
render → rjs analyze <url> → violations + fixes → apply fix → re-run → converge
```

Zero-setup, works on any URL:

```bash
npx @responsivejs/cli analyze https://localhost:3000 -w 320,768,1280 -f json
```

- Exit `0` = pass, `1` = violations, `2` = usage/run error. Gate on the exit code.
- `-f json` gives `{ violations, fixes, scores, summary }`. Each violation has `rule`,
  `element` (selector), `width`, `detail`, `severity`; many carry a structured `fix`
  (`{ selector, property, value, reason }`) — apply those first, then re-run.
- Drivers resolve automatically: Playwright if installed, else
  [agent-browser](https://github.com/vercel-labs/agent-browser). Force with
  `-d agent-browser` to audit live URLs with nothing installed in the project.
- `-f sarif` for code-scanning pipelines. `--strict` to chase warnings too.

## Contracts: your task description

A design contract is an executable spec — authored intent (`description`) plus
machine-checkable rules. Treat it as the acceptance criteria:

```bash
rjs verify home.contract.json http://localhost:3000 -f json   # what breaks, and WHY it matters
rjs record home.contract.json http://localhost:3000           # after an approved visual change
```

Fix what has a `fix`; for the rest, reason from `detail` + `expected/actual` + the rule's
`description`. Stop when `pass` is true. After an approved visual change, `record` re-pins the
baseline curves so the next verify has a fresh reference.

## Library-level control

For custom loops (partial sweeps, cached stores, in-page scoring) use
`@responsivejs/design` directly — `analyze()`, `EvalSource` over any eval primitive,
`verifyContract`, `analyzeStore` on JSON-transported measurements. Read the
[agents guide](docs/guides/agents.md).

## Working on this repo

Node ≥ 20.19, pnpm. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must stay green;
e2e via `pnpm test:e2e` (needs Playwright chromium; agent-browser tests skip when absent).
See [CONTRIBUTING.md](CONTRIBUTING.md).

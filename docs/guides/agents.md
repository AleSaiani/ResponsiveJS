# Guide — r$ for AI agents (AX)

r$ is built to be the **judgment** in an agent loop: an agent (or its browser tool) is the arm;
`analyze()`/`verifyContract()` are the eyes and the verdict. Everything the oracle emits is
machine-readable: `{ violations, fixes, scores }`.

## The loop

```
render page → measure (any driver) → analyze() → violations + fixes
     ↑                                                  │
     └───────────── apply fix, re-run ─────────────────┘
```

Every `Violation` carries `rule`, `element` (selector), `width`, `detail`, `severity`, and —
where an honest one exists — a structured `fix`:

```json
{ "selector": ".cta", "property": "min-height", "value": "44px", "reason": "WCAG touch target" }
```

`UnifiedReport.fixes` is the flattened list. Apply, re-measure, converge.

## Driving from CDP (agent-browser, remote Chrome)

`CdpSource` takes any structural `{ send(method, params) }` client — no dependency:

```typescript
import { CdpSource, analyze } from '@responsivejs/design';

const source = new CdpSource(cdpClient);          // agent-browser bridge, CDPSession, CRI…
const report = await analyze({
    source,
    selectors: ['main', 'nav', '.card', 'button'],
    widths: [320, 768, 1280],
    // url omitted → the page you already navigated is measured as-is
});
```

Under the hood the collector is injected as a string via `Runtime.evaluate` — the same collector
every driver uses, so measurements are identical across Playwright, CDP, and in-page runs.

### Raw injection (no adapter at all)

If all you have is an `eval` primitive:

```typescript
import { buildCollectExpression, fromWire, analyzeStore } from '@responsivejs/design/browser';

const wire = await yourEval(buildCollectExpression({ selectors: ['main', '.card'] }));
const report = analyzeStore({ snapshots: new Map([[wire.width, fromWire(wire)]]), widths: [wire.width], selectors: ['main', '.card'] });
```

`storeToJSON`/`storeFromJSON` let you ship measurements across process boundaries as plain JSON.

## Contracts as agent instructions

A contract is a task description an agent can execute against: authored intent per rule
(`description`), machine-checkable args, and stable `ruleId`s to correlate.

```typescript
import { verifyContract } from '@responsivejs/design';

const report = await verifyContract(homeContract, page);
for (const v of report.violations) {
    // v.ruleId        → which expectation broke
    // v.ruleDescription → WHY it exists (the authored intent)
    // v.fix           → what to change, when derivable
}
```

Agent workflow: fix what has a `fix`; for the rest, use `detail` + `expected/actual` + the
intent to reason about a patch; re-verify; stop when `report.pass`. After an *approved* visual
change, `recordBaseline` re-pins the geometry so the next run has a fresh reference.

## Practical notes

- **Costs**: axe runs at `[min, max]` widths by default (opt into `'all'`); constraint checks
  and scoring are pure math on the measured store — re-running `analyzeStore` on a cached store
  is free.
- **Severity**: gate on `report.pass` (errors only) for hard loops; use `clean` when the agent
  should also chase warnings/info.
- **a11y**: needs `axe-core` installed and an evaluate-capable source. `sources.a11y` in the
  report tells you whether it ran (`'axe' | 'skipped' | 'unavailable'`).
- **SARIF**: `formatSARIF(report)` when the consumer is a code-scanning pipeline rather than a
  live loop.
- **Determinism**: contrast is computed from measured colors (never axe's sampler); scores are
  deterministic per store — identical inputs give identical reports.

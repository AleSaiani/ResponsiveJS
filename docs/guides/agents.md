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

`CdpSource` takes any structural `{ send(method, params) }` client — no dependency. This is how
r$ composes with browser tools like [Vercel's agent-browser](https://github.com/vercel-labs/agent-browser),
Playwright's `CDPSession`, or chrome-remote-interface:

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

### Driving from a bare `eval` primitive

If all you have is a way to evaluate a JS string in the page — agent-browser's eval, a browser
extension, a REPL over a live tab — `EvalSource` turns it into a full driver:

```typescript
import { EvalSource, analyze } from '@responsivejs/design';

const source = new EvalSource((expr) => yourEval(expr), {
    // optional: wire these when your environment can resize/navigate
    setViewport: (w, h) => yourResize(w, h),
    open: (url) => yourNavigate(url),
});

// Viewport not controllable? Analyze honestly at the live width:
const report = await analyze({
    source,
    selectors: ['main', 'nav', '.card', 'button'],
    widths: [await source.currentWidth()],
});
```

Without a `setViewport` callback the source refuses widths that don't match the real viewport —
measurements never lie. Text transports that return JSON strings are parsed automatically.

Argument-length limits (Windows command lines cap at ~32K; axe injection alone is ~500K) are
solved by composing `chunkedEval`, which stages oversized expressions in-page chunk by chunk:

```typescript
import { EvalSource, chunkedEval, analyze } from '@responsivejs/design';
import { spawn } from 'node:child_process';

// agent-browser CLI as the driver — one isolated session, JSON output.
// Resolve on exit, NOT stream close: the first command spawns the CLI's
// daemon, which inherits the stdio pipes and holds them open forever.
const ab = (...args: string[]) =>
    new Promise<string>((res, rej) => {
        const child = spawn('agent-browser', ['--session', 'rjs', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.on('error', rej);
        child.on('exit', (code) => setTimeout(() => (code === 0 ? res(out.trim()) : rej(new Error(out))), 30));
    });
const abEval = async (expr: string) => {
    const res = JSON.parse(await ab('--json', 'eval', expr));
    if (!res.success) throw new Error(res.error);
    return res.data.result;
};

const source = new EvalSource(chunkedEval(abEval), {
    setViewport: async (w, h) => void (await ab('set', 'viewport', String(w), String(h))),
    open: async (url) => void (await ab('open', url)),
});

const report = await analyze({ source, url: 'https://example.com', selectors: ['main', 'nav'], widths: [320, 768, 1280] });
```

This exact composition runs in the repo's e2e suite (`packages/design/e2e/agent-browser.e2e.test.ts`).

For fully manual control the raw pieces are also exported:

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

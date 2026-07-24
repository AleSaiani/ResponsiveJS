# Validation cookbook — from zero to CI gate

Task-first recipes for `@responsivejs/design` and the `rjs` CLI. New to validation? Read
[the design guide](validation.md) first — it explains the measure → model → judge pipeline
and every API's purpose. Full reference:
[design API](../api/design.md) · [CLI](../api/cli.md) · [CI guide](ci.md).

## Audit any URL right now (zero setup)

```bash
npx @responsivejs/cli analyze https://example.com -w 320,768,1280
```

Constraints + aesthetic score + a11y (axe), exit `0` pass / `1` violations. No config, no
project changes — with [agent-browser](https://github.com/vercel-labs/agent-browser) installed
it works on any live URL (`-d agent-browser`); with Playwright installed it uses chromium.

Useful flags: `-s "main,.card"` (scope selectors — the fastest way to cut noise on big pages),
`-f json|sarif`, `--strict` (fail on warnings too), `--touch-min 44` (platform touch rule
instead of the WCAG 24px floor), `--scroll` (below-the-fold).

## A CI gate in five minutes

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('layout holds at all widths', async ({ page }) => {
    const r = r$(page);
    await r.sweep({ url: 'http://localhost:3000', widths: [320, 768, 1280], selectors: ['main', 'h1', '.btn', '.card'] });
    r.assert.noOverflow().minSize('.btn', { height: 44 }).monotonic('h1', 'fontSize', 'up');
    expect(r.report().pass).toBe(true);
});
```

Or the whole oracle in one call: `await r.analyze()` → `UnifiedReport` with `pass`, `clean`,
`violations`, `fixes`, `scores`, `summary`.

## Pin the layout as a contract (record → verify)

A contract is the executable spec of your layout — reviewable JSON that travels with the repo:

```jsonc
// home.contract.json
{
    "name": "home",
    "version": 1,
    "viewport": { "widths": [320, 768, 1280] },
    "rules": [
        { "assert": "noOverflow", "description": "nothing bleeds out of the viewport" },
        { "assert": "minSize", "args": { "selector": ".cta", "min": { "height": 44 } } }
    ],
    "baselines": [{ "selector": "h1", "prop": "fontSize" }]
}
```

```bash
rjs record home.contract.json https://staging.example.com   # pins today's h1 curve
rjs verify home.contract.json https://pr-42.example.com     # a drifted curve exits 1
```

After an *approved* visual change, `record` again. The sweep (selectors, widths) is derived
from the contract itself. Design-system profiles bundle rule packs:
`"designSystem": { "profile": "material-design-3" }` (also `apple-hig`, `fluent-ui-2`).

## Read the aesthetic score

`scores.average.overall` is 0..1 over 17 measured metrics (Ngo/Birkhoff lineage). Read the
per-metric values, not just the total — each low metric maps to a concrete adjustment
(`balance` → redistribute visual weight, `proportion` → harmonic ratios, `density` → spacing).
Enforce it in a contract: `"score": [{ "min": 0.6 }]`. On long document-style pages expect low
`equilibrium` (visual mass tops out) — score sections, not the page.

## Cut false positives

- **Scope selectors** — audit `main, nav, .content`, not the whole DOM.
- Contrast is computed from **measured effective backgrounds** (transparent ancestors are
  resolved), so what it flags is what users see.
- Touch targets default to WCAG 2.5.8's 24px floor and **exempt inline prose links**;
  `--touch-min 44` (or `min` in the rule) opts into platform guidance.
- Gate on `pass` (errors only) in loops; chase `clean` (zero anything) when polishing.

## Machine output

- `-f json` → the full `UnifiedReport` (see the [agents reference](../agents/validation-reference.md) for exact shapes).
- `-f sarif` → SARIF 2.1.0 for code-scanning UIs (GitHub Security tab).
- Library: `formatJSON(report)`, `formatSARIF(report)`, `storeToJSON(store)` to ship raw
  measurements across processes.

## No driver at all

```typescript
import { scoreDOM, collectStore, analyzeStore } from '@responsivejs/design/browser';
const report = analyzeStore(collectStore(['main', '.card']));   // inside any live DOM
```

Same collector, same math — usable from devtools consoles, in-page tooling, or injected via
any eval-capable driver (`EvalSource`).

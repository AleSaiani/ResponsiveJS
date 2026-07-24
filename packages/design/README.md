# @responsivejs/design

> The layout & design oracle of [`r$`](https://github.com/AleSaiani/ResponsiveJS): measure a page
> across widths, validate it with constraints, score its aesthetics, and get machine-readable
> reports with fix suggestions — built for humans and AI agents.

```bash
npm install --save-dev @responsivejs/design
```

`@playwright/test` is an **optional** peer dependency: only the sweep driver needs it. The
[browser core](#zero-driver-browser-core) runs anywhere a DOM exists.

## Validate with Playwright

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('layout is correct at all viewports', async ({ page }) => {
    const r = r$(page);
    await r.sweep({
        url: 'http://localhost:3000',
        widths: [320, 768, 1280, 1920],
        selectors: ['h1', '.btn', '.card'],
    });

    r.assert
        .noOverflow()
        .sameHeight('.btn', '.input')
        .minSize('.btn', { height: 44 })
        .monotonic('h1', 'fontSize', 'up')
        .gapUniform('.card');

    expect(r.report().pass).toBe(true);
});
```

~24 chainable constraints: containment, alignment, monotonicity, continuity, proportions, touch
targets, WCAG contrast, typography scales, spacing tokens, z-order, focus visibility… Violations
carry a `fix` suggestion (`{ selector, property, value, reason }`).

## Zero-driver browser core

```typescript
import { scoreDOM, collectStore } from '@responsivejs/design/browser';

const { average, suggestions } = scoreDOM(['main', '.card', 'nav a']);
```

Playwright-free by construction: import it in a browser app or inject it into any page via a
driver's `eval` (CDP, agent-browser, devtools). It exposes the live-DOM collector plus the pure
scoring core — 17 aesthetic metrics (Ngo/Teo/Byrne 2003 + Birkhoff 1933), see
[rating research](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/rating-research.md).

## The unified oracle: `analyze()`

One call → geometry + responsive constraints + a11y (axe) + aesthetic score, merged in a single
machine-readable `UnifiedReport { violations, fixes, scores, summary }`:

```typescript
import { analyze, PlaywrightSource } from '@responsivejs/design';

const report = await analyze({
    source: new PlaywrightSource(page),
    url: 'http://localhost:3000',
    selectors: ['h1', '.btn', '.card'],
    widths: [320, 768, 1280],
});
report.pass; // no error-severity violations
report.fixes; // flattened {selector, property, value, reason} — agent-loop native
```

`pass` fails only on `error` severity; `clean` demands zero violations of any kind. Axe rules are
namespaced (`axe:aria-required-attr`) with impact mapped to severity (critical/serious → error,
moderate → warning, minor → info). `formatSARIF(report)` emits SARIF 2.1.0 for code-scanning CI.

**a11y degradation** — `axe-core` is an optional peer, injected through the driver's eval seam
(works on every driver, not just Playwright): omitted + installed → runs; omitted + missing →
silently skipped (`sources.a11y: 'unavailable'`); explicitly configured + missing → throws;
store-only input or `a11y: false` → skipped. `color-contrast` is always delegated to the
deterministic `contrastRatio` constraint (axe false-positives on gradients/translucency).

## MeasurementSource: bring your own driver

The oracle is driver-neutral. A source is just:

```typescript
interface MeasurementSource {
    kind: string;
    open?(url: string): Promise<void>;
    setViewport(width: number, height: number): Promise<void>;
    measure(selectors: string[]): Promise<ViewportSnapshot>;
    evaluate?<T>(expression: string): Promise<T>; // string-only: CDP-compatible
}
```

Shipped adapters: **`PlaywrightSource`** (CI) and **`CdpSource`** — the latter takes any
structural `{ send(method, params) }` client (chrome-remote-interface, Playwright `CDPSession`,
agent-browser bridges) and injects the browser collector via `Runtime.evaluate`:

```typescript
import { CdpSource, analyze } from '@responsivejs/design';
const source = new CdpSource(await context.newCDPSession(page));
```

The pure half — `analyzeStore(store)` — is also exported from `@responsivejs/design/browser`
(driver-free) together with `collectPage`/`buildCollectExpression` (the injectable collector) and
`storeToJSON`/`storeFromJSON` (JSON transport of measurements).

## Design-system profiles

Ready-made validation profiles ship as JSON assets:

```typescript
import { applyDesignSystem } from '@responsivejs/design';
import materialDesign from '@responsivejs/design/design-systems/material-design-3.json' with { type: 'json' };

applyDesignSystem(r.assert, materialDesign, { interactive: ['.btn', 'a'] });
```

Available: `apple-hig`, `fluent-ui-2`, `material-design-3`, `pragmatic`.

## Documentation

Full API reference: [docs/api/design.md](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/api/design.md) · guides: [CI regression](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/guides/ci.md), [AI agents](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/guides/agents.md)

Licensed under [MPL-2.0](LICENSE).

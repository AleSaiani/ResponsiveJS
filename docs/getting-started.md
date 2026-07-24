# Getting started

ResponsiveJS (`r$`) is four packages around one model — **`value = f(width)`**. Pick the entry
that matches what you want to do:

| I want to…                                             | Install                                | Start here |
| ------------------------------------------------------ | -------------------------------------- | ---------- |
| Author responsive behavior (fluid values, breakpoints) | `npm i @responsivejs/runtime`          | [§ Authoring](#authoring) |
| Validate/score a page in CI                            | `npm i -D @responsivejs/design @playwright/test` | [§ Validation](#validation) |
| Score a live DOM without any driver                    | `npm i @responsivejs/design`           | [§ Zero-driver](#zero-driver) |
| Pin a layout down as a verifiable contract             | `npm i -D @responsivejs/contract`      | [§ Contracts](#contracts) |
| Just the math (curves, geometry, WCAG, aesthetics)     | `npm i @responsivejs/core`             | [API: core](api/core.md) |

All packages are ESM-only, zero runtime dependencies (Playwright and axe-core are optional
peers of `design`), Node ≥ 20.19, MPL-2.0.

## Authoring

```typescript
import { responsive, fluid, breakpoint } from '@responsivejs/runtime';

responsive.breakpoints({ mobile: 320, tablet: 768, desktop: 1024, wide: 1440 });

responsive('.hero', {
    fontSize: fluid(16, 32),                              // → static CSS clamp()
    padding: fluid(8, 32, { curve: 'ease-in' }),          // → JS-driven (non-linear)
    display: breakpoint.below('tablet', 'none', 'flex'),  // → static @media
});
```

`responsive()` is CSS-first: everything expressible as `clamp()`/`@media` becomes one injected
stylesheet; only the rest is driven by JavaScript through a single shared resize listener,
coalesced to one style write per frame. Add `{ container: true }` to any value to bind it to the
nearest container instead of the viewport.

→ [API: runtime](api/runtime.md) · [concepts](concepts.md)

## Validation

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('layout holds at all widths', async ({ page }) => {
    const r = r$(page);
    await r.sweep({ url: 'http://localhost:3000', widths: [320, 768, 1280], selectors: ['h1', '.btn'] });
    r.assert.noOverflow().minSize('.btn', { height: 44 }).monotonic('h1', 'fontSize', 'up');
    expect(r.report().pass).toBe(true);
});
```

Or run the whole oracle in one call — constraints + aesthetic score + a11y (axe):

```typescript
const report = await r$(page).sweep({ ... }).then((r) => r.analyze());
// UnifiedReport: { pass, violations, fixes, scores, summary, … }
```

→ [API: design](api/design.md) · [guide: CI](guides/ci.md)

## Zero-driver

The browser subpath runs anywhere a DOM exists — no Playwright:

```typescript
import { scoreDOM, analyzeStore, collectStore } from '@responsivejs/design/browser';

const { average, suggestions } = scoreDOM(['main', '.card']);   // 17-metric aesthetic score
const report = analyzeStore(collectStore(['main', '.card']));   // full constraint report
```

Inject it into any page via a driver's `eval` (CDP, agent-browser) — see the
[agents guide](guides/agents.md).

## Contracts

```typescript
import { contract } from '@responsivejs/contract';
import { verifyContract } from '@responsivejs/design';

const home = contract('home')
    .select('sidebar', '.app-sidebar')
    .assert('noOverflow', undefined, { id: 'no-bleed' })
    .below(768).assert('hidden', { selector: '$sidebar' }, { id: 'sidebar-mobile' })
    .from(768).assert('visible', { selector: '$sidebar' }, { id: 'sidebar-desktop' })
    .build();

const report = await verifyContract(home, page);   // sweep derived from the contract
```

Contracts serialize to JSON (published [schema](../packages/contract/schema/design-contract.v1.json)),
travel with the repo, and double as the machine-readable spec agents enforce.

→ [API: contract](api/contract.md) · [guide: CI](guides/ci.md)

## Development setup (this repo)

```bash
git clone https://github.com/AleSaiani/ResponsiveJS.git && cd ResponsiveJS
pnpm install
pnpm test        # 464 unit tests, plain Node
pnpm typecheck   # no build needed (source-resolved)
pnpm build       # tsc, topological
pnpm test:e2e    # needs: pnpm --filter @responsivejs/design exec playwright install chromium
```

# Getting started

ResponsiveJS (`r$`) is one model — **`value = f(width)`** — with two halves: *author*
responsive behavior CSS can't express, *verify* the rendered result with measurements.

## What it replaces

| The hack you write today | The r$ construct | What you gain |
| --- | --- | --- |
| A `@media` ladder for every size | `r$.tokens({ '--space-m': r$.fluid(16, 24) })` | Smooth scaling, static `clamp()`, zero JS |
| The burger breakpoint that rots | `r$.geometry('.nav', { wrapped: r$.whenWraps })` | Adapts by *measurement* — add a link, still correct |
| IntersectionObserver sticky-sentinel | `r$.whenStuck()` | One line, no sentinel DOM |
| Resize listeners + manual measuring | `r$.sync`, `r$.ratio`, `r$.fromElement` | Cross-element relations, cleanup included |
| `'mobile'` strings that typo at runtime | `r$.breakpoints({...} as const)` | Names the compiler checks |
| Squinting at three screen sizes | `rjs analyze <url>` | Measured verdict at every width, exit-code gated |
| Screenshot diffing for regressions | `rjs record` / `verify` contracts | The layout's rules as reviewable JSON |

**Fastest way in: [the tutorial](tutorial.md)** — build a page with all of it in ~30 minutes.
Or pick your entry:

| I want to…                                             | Install                                | Start here |
| ------------------------------------------------------ | -------------------------------------- | ---------- |
| Audit a URL right now, zero setup                      | nothing — `npx @responsivejs/cli`      | [§ Audit](#audit-cli) |
| Author responsive behavior (fluid, geometry, tokens)   | `npm i @responsivejs/runtime`          | [§ Authoring](#authoring) |
| Validate/score a page in CI                            | `npm i -D @responsivejs/design @playwright/test` | [§ Validation](#validation) |
| Score a live DOM without any driver                    | `npm i @responsivejs/design`           | [§ Zero-driver](#zero-driver) |
| Pin a layout down as a verifiable contract             | `npm i -D @responsivejs/contract`      | [§ Contracts](#contracts) |
| Use it in React / Vue / Angular                         | `npm i @responsivejs/react` · `/vue` · `/angular` | [§ Adapters](#adapters) |
| Just the math (curves, geometry, WCAG, aesthetics)     | `npm i @responsivejs/core`             | [API: core](api/core.md) |
| Drive r$ as an AI agent                                | —                                      | [agents docs](agents/validation-reference.md) |

No bundler? `<script src="…/@responsivejs/runtime/dist/global.js"></script>` gives you the
same `r$` on `window` (~15.5 kB gzip) — CMS pages, plain HTML, live demos.

All packages are ESM-only, zero runtime dependencies (Playwright and axe-core are optional
peers of `design`), Node ≥ 20.19, MPL-2.0.

## Audit (CLI)

```bash
npx @responsivejs/cli analyze https://example.com -w 320,768,1280
# constraints + aesthetic score + a11y · exit 0 pass / 1 violations · -f json|sarif

npx @responsivejs/cli audit https://example.com --vs https://competitor.com
# → one self-contained HTML report: screenshots with violation overlays, side-by-side
```

Driver-pluggable (Playwright, or [agent-browser](https://github.com/vercel-labs/agent-browser)
for any live URL with nothing installed). `verify`/`record` run the contract flow.

→ [CLI reference](api/cli.md) · [the design guide](guides/validation.md)

## Authoring

One import, the whole surface behind your editor's autocomplete:

```typescript
import { r$ } from '@responsivejs/runtime';

const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1024 } as const);

r$.tokens({ '--space-m': r$.fluid(16, 24), '--font-hero': r$.fluid(28, 64) });  // clamp() on :root
r$.geometry('.site-nav', { wrapped: r$.whenWraps });   // CSS: .site-nav[data-wrapped] { … }
r$('.cards', { gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)') });
```

r$ is CSS-first: everything expressible as `clamp()`/`@media` becomes one injected stylesheet;
JS drives only what CSS cannot — non-linear curves, **geometry state** (wrap, overflow,
sticky, truncation), **cross-element dependencies** (`fromElement`, `sync`, `ratio`). Add
`{ container: true, from, to }` to bind a value to the nearest container instead of the
viewport — `from`/`to` are the container's own range, and are required.

→ **[the runtime guide](guides/runtime.md)** (purposes, gradual examples, the mental
model) · [case studies](guides/case-studies.md) · [API: runtime](api/runtime.md) ·
[live example](../examples/landing)

## Adapters

The constructs are framework-agnostic; the adapters own the **lifecycle**.

```tsx
// React
const ref = useRef<HTMLDivElement>(null);
useResponsive(ref, { padding: r$.fluid(12, 24) });   // applied on mount, disposed on unmount
const isDesktop = useBreakpoint('desktop');
```

```vue
<!-- Vue -->
<script setup>
const card = ref(null);
useResponsive(card, { padding: r$.fluid(12, 24) });
</script>
<template><div ref="card" v-responsive="{ gap: r$.fluid(8, 16) }" /></template>
```

Changing a declaration calls `update()` on the live handle instead of recreating it; React's
StrictMode double-invocation is handled. Angular ships decorator-free helpers (`injectResponsive`,
`injectViewportWidth`, …) that need no compilation step.
→ **[adapters reference](api/adapters.md)**

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

→ **[the design guide](guides/validation.md)** (measure → model → judge) ·
[API: design](api/design.md) · [guide: CI](guides/ci.md)

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
pnpm test        # unit tests, plain Node
pnpm typecheck   # no build needed (source-resolved)
pnpm build       # tsc, topological
pnpm test:e2e    # needs: pnpm --filter @responsivejs/design exec playwright install chromium
```

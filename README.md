# ResponsiveJS (`r$`)

[![CI](https://github.com/AleSaiani/ResponsiveJS/actions/workflows/ci.yml/badge.svg)](https://github.com/AleSaiani/ResponsiveJS/actions/workflows/ci.yml)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE)

> The screen is a parametric Cartesian plane. Every layout property is a function of width:
> **`value = f(width)`** — viewport _and_ container.

**The responsive design tool**: _author_ responsive behavior, _validate_ that it is correct,
accessible and well composed, and _fix_ it — with machine-readable reports built for both humans
and AI agents. One lineage (`r$`), one model, three uses:

- **measure** a real page → validate it, score it;
- **author** the function you want (breakpoints/curves) → apply it, reactively;
- **tune** the function visually (devtool) → see problems and fixes while you resize.

## Packages

| Package                                    | What it is                                                                                                            | Status      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| [`@responsivejs/core`](packages/core)      | The shared math: geometry, curves, stats, color, typography, aesthetics, snapshot model. Pure, zero-dep, browser-safe. | **alpha**   |
| [`@responsivejs/design`](packages/design)  | The validation oracle: constraints, reports with fix suggestions, aesthetic score (experimental), Playwright driver + zero-driver browser core. | **alpha**   |
| [`@responsivejs/runtime`](packages/runtime) | Authoring: reactive `value = f(width)`, container-aware, `clamp()` where CSS suffices.                                | **alpha**   |
| [`@responsivejs/cli`](packages/cli)        | The `rjs` command line: analyze / verify / record any URL, driver-pluggable (Playwright, agent-browser).               | **alpha**   |
| `@responsivejs/devtool`                    | The DevTools extension: page report, element `f(width)` inspector, contract recorder, in-page overlay. Loaded unpacked (not an npm module). | **alpha**   |
| [`@responsivejs/contract`](packages/contract) | The design-contract DSL: declarative, serializable expectations for CI regression and AI agents.                     | **alpha**   |
| [`@responsivejs/react`](packages/react)    | React bindings: hooks that own the construct lifecycle (mount → update → unmount).                                     | **alpha**   |
| [`@responsivejs/vue`](packages/vue)        | Vue bindings: the same composables, plus a `v-responsive` directive.                                                   | **alpha**   |
| [`@responsivejs/angular`](packages/angular) | Angular bindings: decorator-free `inject*` helpers and signals — no compilation step.                                | **alpha**   |

## Quick start — audit any URL (CLI)

```bash
rjs analyze https://example.com -w 320,768,1280
# r$ ✗ fail — 3 errors … noOverflow @320px .card[0] — right=496 > viewport=320
# exit 1 → CI- and agent-loop-ready; -f json | sarif for machines

rjs record home.contract.json https://staging.example.com   # pin today's geometry
rjs verify home.contract.json https://pr-42.example.com     # regressions fail the build
```

Driver-pluggable: Playwright when installed, [agent-browser](https://github.com/vercel-labs/agent-browser)
for zero-setup audits of any live URL. See the [CLI reference](docs/api/cli.md).

## Quick start — author fluid behavior (runtime)

```typescript
import { r$ } from '@responsivejs/runtime';

const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);
r$.tokens({ '--space-m': r$.fluid(16, 24), '--font-hero': r$.fluid(28, 64) }); // clamp() on :root
r$.geometry('.site-nav', { wrapped: r$.whenWraps });  // CSS: .site-nav[data-wrapped] { … }
r$('.cards', { gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)') });
```

CSS-first: linear math ships as static CSS; JS drives only what CSS cannot (curves, geometry
state, cross-element). See [the runtime guide](docs/guides/runtime.md).

## Quick start — validate a layout (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('layout is correct at all viewports', async ({ page }) => {
    const r = r$(page);

    await r.sweep({
        url: 'http://localhost:3000',
        widths: [320, 768, 1280, 1920],
        selectors: ['h1', '.btn', '.card', '.sidebar'],
    });

    r.assert
        .noOverflow() // nothing outside the viewport
        .sameHeight('.btn', '.input') // aligned heights
        .minSize('.btn', { height: 44 }) // WCAG touch target
        .monotonic('h1', 'fontSize', 'up') // font never shrinks
        .proportion('.sidebar', '.main', { min: 0.15, max: 0.35 });

    expect(r.report().pass).toBe(true);
});
```

## Quick start — score a live DOM (no driver)

```typescript
import { scoreDOM } from '@responsivejs/design/browser';

const result = scoreDOM(['main', '.card', 'nav a']);
// → { perWidth, average, suggestions } — 17 aesthetic metrics (Ngo/Birkhoff)
```

The browser entry is Playwright-free: inject it into any page (devtools, agents, CI drivers) via
`eval` — or import it directly in a browser app.

## The model

- **Every element is a rectangle**: `{ x, y, width, height, right, bottom, centerX, centerY, area }`.
- **Every property is a curve**: `fontSize = f(width)`, sampled at N widths.
- **Constraints are equations** that must hold at every width — `child.right <= parent.right`,
  `dFontSize/dWidth >= 0`, `stddev(gaps)/mean(gaps) < 0.1`.
- **Reports are machine-readable**: `{ violations, fixes, scores }` — an agent can act on them.

## Documentation

Start with **[the tutorial](docs/tutorial.md)** — empty page to fluid, contract-pinned
landing in ~30 minutes. Full docs live in [docs/](docs/README.md):
[getting started](docs/getting-started.md) · [concepts](docs/concepts.md) · API reference for
[core](docs/api/core.md) / [runtime](docs/api/runtime.md) / [design](docs/api/design.md) /
[contract](docs/api/contract.md) · guides for [CI regression](docs/guides/ci.md) and
[AI agents](docs/guides/agents.md).

## Works with your tools

The validation oracle is **driver-pluggable**: Playwright for CI, any CDP client for agent
loops — including [Vercel's agent-browser](https://github.com/vercel-labs/agent-browser) or a
raw `eval` primitive. The browser tool is the arm, `r$` is the judgment: they compose, no
lock-in. See the [agents guide](docs/guides/agents.md).

For agents specifically, the docs site publishes source markdown rather than HTML to scrape —
[`llms.txt`](https://responsivejs.com/llms.txt) as the index,
[`llms-full.txt`](https://responsivejs.com/llms-full.txt) for one fetch, and a `.md` twin of
every page. And in Claude Code, [`plugins/responsivejs`](plugins/responsivejs/README.md) adds
two skills — authoring and verification — plus an `/rjs-audit` command:

```
/plugin marketplace add AleSaiani/ResponsiveJS
/plugin install responsivejs@responsivejs
```

## Roadmap

**Available now (alpha)**: the shared math (`core`); the authoring runtime (`runtime`) with
geometry predicates (`whenWraps`, `whenStuck`, …), fluid design tokens, cross-element
dependencies and typed breakpoints; the validation oracle with a11y and aesthetic scoring
(`design`); the contract DSL (`contract`); and the `rjs` CLI. See the
[fluid landing example](examples/landing) for every runtime construct on one page.

**Next**:

- **Devtool** — the in-page visual overlay: width-sweep with live problem highlighting, a curve
  inspector (`f(width)` per property), an aesthetic-score HUD, and a recorder that exports your
  adjustments as `clamp()` / runtime config / design tokens.
- **Framework adapters** — thin React/Vue bindings over the runtime's TC39-shaped signals.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Development needs Node ≥ 20.19 and pnpm.

## License

[MPL-2.0](LICENSE). **Every file in this repository is subject to the Mozilla Public License,
v. 2.0** unless that file says otherwise — the notice lives here rather than at the top of each
file, which is the placement the license itself contemplates (Exhibit A). A copy ships inside
every published package.

What that means in practice: MPL is copyleft **per file**, not per project. You can use these
packages in a closed-source product with no obligation on your own code. If you modify a file
that came from here and distribute it, that file's source has to stay available under the same
license. Linking, importing and bundling are not modifications.

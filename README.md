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
| [`@responsivejs/design`](packages/design)  | The validation oracle: constraints, 17-metric aesthetic score, reports with fix suggestions, Playwright driver + zero-driver browser core. | **alpha**   |
| `@responsivejs/runtime`                    | Authoring: reactive `value = f(width)`, container-aware, `clamp()` where CSS suffices.                                 | planned     |
| `@responsivejs/devtool`                    | The in-page visual overlay: width-sweep, problem overlay, curve inspector, score HUD.                                  | planned     |
| Adapters (`react`, `vue`, …)               | Thin framework bindings.                                                                                               | planned     |

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

See [docs/DIRECTION.md](docs/DIRECTION.md) for the full picture and
[docs/rating-research.md](docs/rating-research.md) for the research behind the aesthetic score.

## Roadmap

- **F0 — Extraction** ✅ `core` + `design` published from the existing, battle-tested codebase.
- **F1 — Core authoring**: `sample`/`interpolate` on `Curve` (the authoring half of the model).
- **F2 — Runtime**: reactive values, container-aware, `clamp()` generation where CSS suffices.
- **F3 — Design complete**: unified `analyze()` — geometry + responsive + a11y (WCAG/axe) + aesthetics.
- **F4 — Devtool**: the in-page overlay.
- **F5 — Design-contract DSL**: declarative, serializable specs for authoring and regression.
- **F6 — Adapters & DX**: framework bindings, docs, agent skill.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Development needs Node ≥ 20.19 and pnpm.

## Provenance & license

Extracted from [Pragmatic.Design.UI](https://github.com/AleSaiani), where the validation layer was
developed and battle-tested against a 100+ component library. Licensed under
[MPL-2.0](LICENSE).

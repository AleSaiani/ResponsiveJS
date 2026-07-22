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

## Design-system profiles

Ready-made validation profiles ship as JSON assets:

```typescript
import { applyDesignSystem } from '@responsivejs/design';
import materialDesign from '@responsivejs/design/design-systems/material-design-3.json' with { type: 'json' };

applyDesignSystem(r.assert, materialDesign, { interactive: ['.btn', 'a'] });
```

Available: `apple-hig`, `fluent-ui-2`, `material-design-3`, `pragmatic`.

Licensed under [MPL-2.0](LICENSE).

# Testing responsive behavior

How to test code that uses r$ — what belongs in unit tests, what genuinely needs a browser,
and the patterns (and traps) we learned building r$'s own suite.

## The one decision: does it need layout?

Everything in r$ splits cleanly in two:

- **Pure logic** — values, curves, conditionals, contracts. `ResponsiveValue.resolve(width)`
  is a pure function; no DOM involved. Test it in plain unit tests, instantly.
- **Geometry** — anything that measures the real page: `whenWraps`, `whenStuck`, `sync`,
  overflow checks, the whole validation oracle. **jsdom and happy-dom do not do layout** —
  every element measures 0×0, so a geometry predicate in a DOM emulator returns garbage that
  looks plausible. These tests must run in a real browser.

When in doubt: if the behavior depends on where boxes ended up, it's a browser test.

## Unit-testing your responsive logic (no browser)

Values resolve without any DOM — test your functions as functions:

```typescript
import { describe, it, expect } from 'vitest';
import { r$ } from '@responsivejs/runtime';

describe('the hero scale', () => {
    const size = r$.fluid(24, 48, { from: 320, to: 1280 });

    it('clamps at the domain edges', () => {
        expect(size.resolve(320)).toBe(24);
        expect(size.resolve(1280)).toBe(48);
        expect(size.resolve(200)).toBe(24);    // never extrapolates
    });

    it('is halfway at the domain midpoint', () => {
        expect(size.resolve(800)).toBe(36);
    });
});
```

The same works for conditionals (`bp.below('tablet', 'a', 'b').resolve(500)`) and for any
`custom(fn)` you wrote. If your app builds style maps dynamically, test the *map building* —
pure — and leave the application to a browser test.

Contracts are pure too: `verifyContract(contract, store)` against a hand-built or recorded
store runs in milliseconds with no browser (r$'s own suite does exactly this).

## Browser tests: the patterns

Setup is ordinary Playwright (or the runner you prefer) serving your page. The r$-specific
patterns:

### Assert on what the CSS keys on

Geometry's entire output is data-attributes — so that's what tests read. Resize, then **wait
for the attribute**, never sleep:

```typescript
await page.setViewportSize({ width: 400, height: 800 });
await page.waitForFunction(() => document.querySelector('.site-nav')!.hasAttribute('data-wrapped'));

await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForFunction(() => !document.querySelector('.site-nav')!.hasAttribute('data-wrapped'));
```

`waitForFunction` re-checks until true, absorbing the (deliberate) async between a resize and
the re-measure. A fixed `waitForTimeout` is a flaky version of the same thing.

### Assert on computed styles for tokens and fluid values

```typescript
const hero = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-hero').trim(),
);
expect(hero).toBe('64px');

const applied = await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontSize);
```

For statically-compiled values (linear fluid, breakpoint switches) there is nothing async at
all — the browser applies the stylesheet; read the computed style directly.

### Test state STABILITY, not just state

A geometry state that oscillates (the `display: none` mistake) can look green in a
single-check test and flicker in production. Check it holds across frames:

```typescript
const stable = await page.evaluate(
    () =>
        new Promise<boolean>((resolve) => {
            let frames = 0;
            const check = () => {
                if (!document.querySelector('.site-nav')!.hasAttribute('data-wrapped')) return resolve(false);
                if (++frames >= 5) return resolve(true);
                requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
        }),
);
expect(stable).toBe(true);
```

### Let the oracle do the asserting

For whole-page correctness, don't hand-write twenty assertions — run r$'s validation side as
the judge in the same test:

```typescript
import { r$ } from '@responsivejs/design';   // note: the DESIGN package's r$(page)

const r = r$(page);
await r.sweep({ url, widths: [320, 768, 1280], selectors: ['main', 'nav', '.card', '.cta'] });
r.assert.noOverflow().minSize('.cta', { height: 44 });
expect(r.report().pass).toBe(true);
```

Or from CI without writing a test at all: `rjs analyze <url>` / `rjs verify <contract> <url>`
— exit code 1 fails the build. The contract flow (`record` → commit → `verify`) is visual
regression for geometry, no screenshots involved.

## Traps we hit so you don't

- **The page must actually scroll** before asserting `data-stuck`: at a wide viewport a short
  page has no scrollbar, `scrollTo` does nothing, and the wait times out. Scroll at a narrow
  viewport, or `scrollTo(0, document.body.scrollHeight)`.
- **Serve over HTTP, not `file://`**, when your bundler emits `crossorigin` assets (vite
  does): from `file://` the browser blocks them and your page silently runs with no JS at all
  — everything measures like browser defaults and nothing you assert makes sense.
- **`r$.flush()`** exists for unit-style tests that drive the JS path synchronously (drain
  the batched style writes after an event you dispatched). In real-browser tests you rarely
  need it — prefer `waitForFunction` on the outcome.
- **One-shot measures** are your debugging tool inside a paused test:
  `r$.whenWraps().measure(el)` in `page.evaluate` tells you what the predicate sees *right
  now*, bypassing all wiring.

## Living examples

r$'s own e2e suite uses every pattern above against the [landing example](../../examples/landing)
— see `packages/runtime/e2e/landing.e2e.test.ts` (constructs, stability check, stuck
round-trip) and `packages/cli/e2e/cli.e2e.test.ts` (the oracle + contract round-trip as test
assertions).

# Runtime cookbook — task-first recipes

Every recipe: the problem, the paste-ready construct, the gotcha if there is one. New to the
runtime? Read [the guide](runtime.md) first — it explains the model and every API's purpose.
Full signatures in the [runtime API](../api/runtime.md); all constructs live on one page in
the [landing example](../../examples/landing).

Recipes use named imports; every function is also available on the `r$` namespace
(`import { r$ } …` → `r$.fluid`, `r$.geometry`, `r$.tokens`, …) — same objects.

## A fluid type & spacing scale (no breakpoints)

```typescript
import { responsive, fluid } from '@responsivejs/runtime';

responsive.tokens({
    '--font-body': fluid(15, 18),
    '--font-hero': fluid(28, 64),
    '--space-s': fluid(8, 12),
    '--space-m': fluid(16, 24),
});
```
```css
h1 { font-size: var(--font-hero); }
.card { padding: var(--space-m); }
```

Linear values compile to a static `clamp()` on `:root` — **zero JS at runtime**. Only
non-linear curves (`{ curve: 'exponential' }`) stay JS-driven. One write point, themable,
visible in devtools.

## The burger menu without a magic breakpoint

```typescript
import { geometry, whenWraps } from '@responsivejs/runtime';
geometry('.site-nav', { wrapped: whenWraps });
```
```css
.site-nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .menu-button { display: block; }
```

The burger appears exactly when the links stop fitting — adding a seventh link, renaming one,
or translating to German just works.

**Gotcha (the one rule of geometry)**: never `display: none` what a predicate measures — the
children's rects go to zero, the predicate flips back, the state oscillates. Collapse while
keeping layout (`visibility: hidden; height: 0; overflow: hidden`).

## Header shadow only while actually sticky

```typescript
geometry('.site-header', { stuck: whenStuck() });
```
```css
.site-header[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / 0.12); }
```

Replaces the IntersectionObserver-sentinel hack. Works for `top` and `bottom` sticky.

## "Show more" only when text is actually truncated

```typescript
geometry('.excerpt', { truncated: whenTruncated() });
```
```css
.excerpt { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; }
.excerpt + .show-more { display: none; }
.excerpt[data-truncated] + .show-more { display: inline; }
```

`whenTruncated` is true only when overflow is *clipped* — a scrollable box is not "truncated".

## Style by line count

```typescript
geometry('h2', { lines: linesOf() });   // → <h2 data-lines="2">
```
```css
h2[data-lines='1'] { text-align: center; }
```

Non-boolean predicates write their value into the attribute.

## Equal heights across unrelated containers

```typescript
import { sync } from '@responsivejs/runtime';
const cards = sync('.card h3', 'height');   // max natural height wins
// cards.measure() after dynamic content changes; cards.dispose() lifts it
```

Where grid/subgrid can't reach (different parents). Re-syncs on viewport resize.

## A value driven by another element's width

```typescript
import { responsive, fluid, fromElement } from '@responsivejs/runtime';

responsive('.main-content', {
    fontSize: fluid(14, 18, { domain: fromElement('.sidebar'), from: 200, to: 400 }),
});
```

Container queries only see *ancestors* — `fromElement` binds to **any** element. `from`/`to`
are the source element's width range.

## An enforced layout ratio

```typescript
import { ratio } from '@responsivejs/runtime';
ratio('.sidebar', '.main', { min: 0.2, max: 0.33 });
```

Outside the bounds the sidebar's width is constrained; inside them the layout flows free.
This is the validation constraint (`proportion`) promoted to runtime enforcement.

## Breakpoint names the compiler checks

```typescript
const bp = defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

responsive('.cards', { gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)') });
bp.matches('tablet');   // reactive { signal, dispose } for JS logic
```

A typo (`bp.below('moble', …)`) is a **compile** error, not a runtime throw.

## Ship design tokens to your design tooling

```typescript
const t = responsive.tokens({ '--space-m': fluid(16, 24) });
t.toDTCG();   // Design Tokens Community Group JSON, curves sampled under $extensions
```

## SSR

Linear constructs never need JS: ship `responsive.static(selector, map)` or `tokens(...).css`
as server-rendered CSS. Geometry predicates are progressive enhancement — `geometry()` is
inert without `window` and hydrates cleanly.

## Cleanup contract

Every construct returns a handle whose `dispose()` removes **everything it did** — effects,
observers, injected CSS, inline styles, data-attributes. If you mount/unmount (SPA routes,
components), keep the handle and dispose it.

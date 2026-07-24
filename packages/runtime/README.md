# @responsivejs/runtime

> The authoring half of [`r$`](https://github.com/AleSaiani/ResponsiveJS): reactive
> `value = f(width)` — viewport **and** container aware, CSS-first.

```bash
npm install @responsivejs/runtime
```

The rule that shapes everything: **where CSS suffices, emit CSS**. A linear `r$.fluid()`
compiles to a `clamp()` (the Utopia formula); breakpoint switches compile to `@media` blocks.
JavaScript drives only what CSS cannot express — non-linear curves, colors, **geometry state**,
**cross-element relations**, measurement-driven logic.

## 60 seconds

One import; type `r$.` and autocomplete the whole surface:

```typescript
import { r$ } from '@responsivejs/runtime';

const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

r$.tokens({
    '--space-m': r$.fluid(16, 24),                    // → static clamp() on :root, zero JS
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }), // → JS-driven variable
});

r$.geometry('.site-nav', { wrapped: r$.whenWraps });  // CSS: .site-nav[data-wrapped] { … }

r$('.cards', {
    gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)'),  // → static @media
    padding: r$.fluid(8, 32, { curve: 'ease-in' }),                    // → JS (non-linear)
});
```

`r$(target, map)` splits the map automatically: static parts land in one injected stylesheet,
the rest updates via a single shared resize listener, coalesced to one style write per frame.

## What's on `r$.`

- **Values** — `fluid(min, max, unit? | opts)` (linear→clamp; curves; colors via OKLab;
  per-breakpoint arrays; structural strings) · `custom(fn)` · `combine([...])` ·
  `when(pred, a, b)` · `whenInRange(min, max, v)` · `breakpoint.below/above/between/match`.
- **Typed breakpoints** — `r$.breakpoints({mobile: 320, …} as const)` returns an API typed on
  your names: `bp.below('tablet', …)` autocompletes, a typo is a compile error.
- **Tokens** — `r$.tokens({'--space-m': r$.fluid(16, 24)})`: the design scale as fluid custom
  properties on `:root`; `.css` for SSR, `.toDTCG()` for design tooling.
- **Geometry** ("JS detects, CSS styles") — `geometry(target, states)` keeps data-attributes
  in sync with measured facts: `whenWraps`, `whenOverflows`, `whenTruncated`, `whenStuck`,
  `linesOf`, `whenCollides`. Style them from the stylesheet: `.nav[data-wrapped] { … }`.
- **Cross-element** — `fromElement(sel)` as a fluid domain (a value driven by *another*
  element's width) · `sync(sel, 'height')` (equal sizes across containers) ·
  `ratio(a, b, {min, max})` (an enforced layout invariant).
- **Utilities** — `static(sel, map)` (CSS-only, throws if JS needed) · `dynamic` · `lazy` ·
  `memo` · `batch` · `debug` · `flush()` · the tagged-template and utility micro-grammars.

Every value accepts `{ container: true }` to bind to the nearest container width instead of
the viewport (shared `ResizeObserver`; static emission switches `vw` → `cqi`).

Named exports of every function exist for tree-shaking-sensitive code (`import { fluid,
geometry } …`) — they are the same objects. Subpaths: `/signals` (the TC39-shaped reactive
engine), `/curves`, `/layout`, `/typography`, `/geometry`.

## Contracts worth knowing

- **Disposal**: every construct returns a handle; `dispose()` removes exactly what it did —
  effects, observers, injected CSS, inline styles, data-attributes.
- **Geometry's one rule**: never `display: none` the element a predicate measures; collapse
  keeping layout (`visibility: hidden; height: 0; overflow: hidden`).
- **SSR**: no `window` access at module level; ship `r$.static()` / `r$.tokens(...).css`.
- **Cost**: one resize listener, one ResizeObserver, one scroll listener — refcounted, total.
  ~11 kB gzipped, zero dependencies.

## Documentation

[The runtime guide](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/guides/runtime.md)
(start here) · [case studies](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/guides/case-studies.md)
· [API reference](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/api/runtime.md)
· [live example](https://github.com/AleSaiani/ResponsiveJS/tree/main/examples/landing)

Licensed under [MPL-2.0](LICENSE).

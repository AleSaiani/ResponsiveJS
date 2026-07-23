# @responsivejs/runtime

> The authoring half of [`r$`](https://github.com/AleSaiani/ResponsiveJS): reactive
> `value = f(width)` — viewport **and** container aware, CSS-first.

```bash
npm install @responsivejs/runtime
```

The rule that shapes everything: **where CSS suffices, emit CSS**. A linear `fluid()` compiles to
a `clamp()` (the Utopia formula); breakpoint switches compile to `@media` blocks. JavaScript
drives only what CSS cannot express — non-linear curves, colors, string interpolation,
measurement-driven logic.

## 60 seconds

```typescript
import { responsive, fluid, breakpoint, when } from '@responsivejs/runtime';

responsive('.hero', {
    fontSize: fluid(16, 32), // → static clamp(16px, calc(12.8px + 1vw), 32px)
    padding: fluid(8, 32, { curve: 'ease-in' }), // → JS-driven (non-linear)
    display: breakpoint.below('tablet', 'none', 'flex'), // → static @media
    width: when((w) => w > 1200, '80%', '100%'), // → JS-driven (arbitrary predicate)
});
```

`responsive()` splits the map automatically: static parts land in one injected stylesheet, the
rest updates via a single shared resize listener, coalesced to one style write per frame.

## Values

- `fluid(min, max, unit? | opts)` — linear by default; `curve: 'exponential' | 'logarithmic' | 'ease-in' | … | [x1,y1,x2,y2]`
- `fluid([8, 16, 24, 32])` — per-breakpoint multi-segment
- `fluid('#ff0000', '#0000ff')` — perceptual color interpolation (OKLab)
- `fluid('scale(0.8)', 'scale(1.2)')` — structural string interpolation (transforms, shadows, filters)
- `combine([scale(fluid(0.8, 1.2)), rotate(fluid(0, 45))])` + `scale/rotate/translate/skew` helpers
- `(width) => value` — custom functions, always JS-driven
- `when(pred, a, b)` / `when([[pred, v], …])` / `whenInRange(min, max, v, else?)`
- `breakpoint.below/above/between/match` — named via `responsive.breakpoints({mobile: 320, …})`

Every value accepts `{ container: true }` to bind to the nearest container width instead of the
viewport (a shared `ResizeObserver`; static emission switches `vw` → `cqi`).

## Subpaths (tree-shaking)

| Import                            | Contents                                              |
| --------------------------------- | ----------------------------------------------------- |
| `@responsivejs/runtime`           | Everything below, plus `responsive()` itself.         |
| `@responsivejs/runtime/signals`   | The TC39-shaped reactive engine (`state/computed/effect/subscribe/batch`). |
| `@responsivejs/runtime/curves`    | `linear/exponential/logarithmic/easeIn(Out)/cubic`.   |
| `@responsivejs/runtime/layout`    | `grid.adaptive`, the `space` scale system.            |
| `@responsivejs/runtime/typography`| `typography.scale('major-third')` → fluid type scales.|

## Utilities

- `responsive.static(sel, map)` — CSS-only compilation (throws if anything needs JS)
- `responsive.dynamic(target, map)` — force everything through JS
- `responsive.lazy` (IntersectionObserver) · `responsive.memo` · `responsive.batch` · `responsive.debug`
- Tagged template and `responsive.apply('.el', 'text-fluid-sm-xl p-fluid-2-8')` micro-grammars

## Contracts worth knowing

- **Disposal**: every `responsive()` returns a handle; `dispose()` removes effects, observers,
  injected CSS and inline styles. No listener outlives its last consumer.
- **SSR**: no `window` access at module level; values resolve at `config.ssrWidth` (default 1024).
  Prefer `responsive.static()` for server-rendered CSS.
- **Reactivity**: the internal signal engine follows the TC39 `{get}`/`{get,set}` shape — framework
  adapters map trivially; `subscribe(signal, cb)` for everything else.

Licensed under [MPL-2.0](LICENSE).

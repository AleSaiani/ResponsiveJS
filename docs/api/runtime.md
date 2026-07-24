# API — @responsivejs/runtime

The authoring half: reactive `value = f(width)`, CSS-first. Depends only on
`@responsivejs/core`. Subpaths: `/signals`, `/curves`, `/layout`, `/typography` (everything is
also re-exported from the root).

## `responsive()` — apply styles

```typescript
responsive(target, map): ResponsiveHandle
responsive`selector { prop: ${fluid(14, 24)}px }`   // tagged-template form
```

- `target`: selector string, `Element`, `Element[]`, or `NodeList`.
- `map`: `Record<prop, StyleValue>` where a value is a `ResponsiveValue`, a
  `(width) => value` function, or a plain string/number.
- With a selector target and `useMediaQueries` on (default), the map is **split**: statically
  expressible values become one injected `<style data-responsivejs>`; the rest is JS-driven.

`ResponsiveHandle`: `elements`, `update(map)`, `pause()`, `resume()`, `dispose()` — dispose
removes effects, observers, injected CSS **and** applied inline styles.

### The namespace

| Member | Meaning |
| --- | --- |
| `responsive.config({ breakpoints, defaultUnit='px', useMediaQueries=true, debug, ssrWidth=1024 })` | Global configuration (itself reactive). |
| `responsive.breakpoints({ mobile: 320, … })` | Define named breakpoints. |
| `responsive.static(selector, map): string` | CSS-only compilation — throws if anything needs JS. |
| `responsive.dynamic(target, map)` | Skip the static split, drive everything via JS. |
| `responsive.lazy(target, map)` | Apply on first intersection (IntersectionObserver). |
| `responsive.batch(fn)` | One signal flush + one style flush for several calls. |
| `responsive.memo(map)` | Cache custom-function values per 1px width bucket. |
| `responsive.debug(bool)` | Log resolved values on change. |
| `responsive.flush()` | Synchronously drain pending style writes (tests). |
| `responsive.apply(target, 'text-fluid-sm-xl p-fluid-2-8')` | Utility micro-grammar (`{text\|p\|m\|gap\|bg\|color}-fluid-{from}-{to}`). |

## Values

### `fluid()` — polymorphic

```typescript
fluid(min, max, unit? | opts?)          // numbers → linear (static clamp) or curved (JS)
fluid([8, 16, 24, 32], opts?)           // per-breakpoint multi-segment
fluid('#ff0000', '#0000ff', opts?)      // colors → perceptual OKLab mix (JS)
fluid('scale(0.8)', 'scale(1.2)')       // strings → structural interpolation (JS)
```

`FluidOpts`: `curve` (`'linear' | 'exponential' | 'logarithmic' | EasingName | Bezier`), `unit`,
`container: true` (bind to nearest container; static output uses `cqi`), `from`/`to` (domain
override — defaults to the configured breakpoint range).

String interpolation requires **structural congruence** (same tokens, literals, units — bare `0`
inherits the other side's unit) and throws a descriptive error otherwise. No fuzzy matching.

### Conditionals

| Function | Static CSS? | Meaning |
| --- | --- | --- |
| `when(pred, a, b?)` / `when([[pred, v], …])` | no | Arbitrary predicate; first match wins. |
| `whenInRange(min, max, value, otherwise?)` | yes* | 2013 heritage; min+max `@media`. |
| `breakpoint.below(ref, a, b?)` | yes* | `ref` is a name or px. Mobile-first emission. |
| `breakpoint.above(ref, a, b?)` / `.between(lo, hi, a, b?)` | yes* | |
| `breakpoint.match({ mobile: 14, desktop: 18 })` | yes* | Largest matching breakpoint wins. |

\* static only when the branches are plain strings/numbers; nested `ResponsiveValue` branches
resolve correctly but force the JS path.

### Helpers

- `custom(fn, opts?)` — wrap `(width) => value`; always JS.
- `combine([...])` — space-join parts (transform lists).
- `scale(v)`, `rotate(v)`, `translate(x, y)`, `translateX/Y(v)`, `skew(x, y?)` — transform
  templates with conventional default units.
- `isResponsiveValue(v)` — brand check.

## `/curves` — sugar

`linear`, `exponential`, `logarithmic`, `easeIn`, `easeOut`, `easeInOut`, `cubic(min, max,
bezier)` — each equals `fluid(min, max, { curve })`.

## `/layout`

- `grid.adaptive({ minColumnWidth, maxColumns?, gap? }): StyleMap` — without `maxColumns` it is
  pure CSS (`repeat(auto-fit, minmax(min(Wpx, 100%), 1fr))`); with it, the column count is
  computed per width.
- `space` — geometric spacing scale (`base 8 × ratio 1.5^level`, `space.config()` to change):
  `level(n)`, `inset(v, h?)`, `stack(n)`, `inline(from, to?)`, `fluid(from, to)`, `rhythm(n)`.

## `/typography`

`typography.scale('major-third' | { ratio, base: [min, max] }): TypeScale` — reuses core's
`SCALES`. `size(level)` is a fluid value (`base × ratio^level` at each domain edge);
`lineHeight(level)` eases 1.5 → 1.2 as levels grow (display sizes tighten); `spacing(level)` is
half the size. Unknown names throw with the valid list.

## `/signals` — the reactive engine

TC39-shaped, zero-dep, no DOM:

```typescript
state<T>(initial, equals?): State<T>          // { get(); set(v) }
computed<T>(fn, equals?): Computed<T>         // { get() } — lazy, version-validated, diamond-safe
effect(fn): Disposer                          // runs now, re-runs on change; cleanup via return
subscribe(signal, cb): Disposer               // cb on change (not on subscription)
batch(fn)                                     // defer effects, flush synchronously at exit
untrack(fn)                                   // read without depending
```

Width sources (all SSR-safe, all disposable):

| Function | Backed by |
| --- | --- |
| `viewportWidth(): State<number>` | ONE passive resize listener (lazy singleton). |
| `mediaQuery(q): { signal, dispose }` | Refcounted matchMedia registry. |
| `breakpointSignal(ref)` | `mediaQuery('(min-width: …)')` via named breakpoints. |
| `containerWidth(el): { signal, dispose }` | ONE shared ResizeObserver, refcounted per element. |

## Emission

`emitCSS(selector, map): { css, dynamicRest }` and `injectStyle(css, key)` /
`removeStyle(key)` are exported for build-time use. Linear fluid compiles with the Utopia
formula: `slope = (max−min)/(vMax−vMin)`, `intercept = min − slope·vMin` →
`clamp(lo, calc(intercept + slope·100vw), hi)` (bounds reordered for descending ranges,
`cqi` for containers).

## SSR

No `window` access at module level. Values resolve at `config.ssrWidth` until hydration; prefer
`responsive.static()` for server-rendered CSS.

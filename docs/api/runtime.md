# API — @responsivejs/runtime

The authoring half: reactive `value = f(width)`, CSS-first. Depends only on
`@responsivejs/core`. Subpaths: `/signals`, `/curves`, `/layout`, `/typography`, `/geometry`
(everything is also re-exported from the root).

**The entry point is `r$`** — one callable namespace carrying the everyday authoring surface
(`r$.fluid`, `r$.tokens`, `r$.geometry`, `r$.whenWraps`, `r$.breakpoints`, `r$.sync`, …), so
the editor's autocomplete is the API browser. `responsive` is an alias of the same object (the
historical name). Precisely: every `r$` member exists, plus root named exports for the same
functions and for the lower layers — the signal engine, curve sugar, `layout`/`typography`
helpers and transform templates live as named exports / subpaths, not on the namespace.
New to the runtime? Start from the [guide](../guides/runtime.md), not this reference.

## `r$()` — apply styles

```typescript
r$(target, map): ResponsiveHandle
r$`selector { prop: ${r$.fluid(14, 24)}px }`   // tagged-template form
```

- `target`: selector string, `Element`, `Element[]`, or `NodeList`.
- `map`: `Record<prop, StyleValue>` where a value is a `ResponsiveValue`, a
  `(width) => value` function, or a plain string/number.
- With a selector target and `useMediaQueries` on (default), the map is **split**: statically
  expressible values become one injected `<style data-responsivejs>`; the rest is JS-driven.

`ResponsiveHandle`: `elements`, `update(map)`, `pause()`, `resume()`, `dispose()`.
Ownership guarantees: every handle owns a **unique** stylesheet (two `r$('.x', …)` calls never
clobber each other; the cascade goes to the later injection); the inline value present before
the handle's first write to a property is **restored** on dispose; `update(map)` restores
properties the new map no longer contains; `container: true` values acquire
`container-type: inline-size` on the parent through a refcounted owner that never overrides a
user declaration (also on the static path — the stylesheet says `cqi`, the handle provides
the container; with `r$.static()` alone, declaring the container is on you).

### The namespace

| Member | Meaning |
| --- | --- |
| `r$.config({ breakpoints, defaultUnit='px', useMediaQueries=true, debug, ssrWidth=1024 })` | Global configuration (itself reactive). |
| `r$.breakpoints({ mobile: 320, … } as const)` | Define named breakpoints — returns the [typed API](#typed-breakpoints). |
| `r$.tokens({ '--space-md': fluid(8, 16) })` | [Token bridge](#tokens--fluid-custom-properties): fluid custom properties on `:root`. |
| `r$.static(selector, map): string` | CSS-only compilation — throws if anything needs JS. |
| `r$.dynamic(target, map)` | Skip the static split, drive everything via JS. |
| `r$.lazy(target, map)` | Apply on first intersection (IntersectionObserver). |
| `r$.batch(fn)` | One signal flush + one style flush for several calls. |
| `r$.memo(map)` | Cache custom-function values per 1px width bucket. |
| `r$.debug(bool)` | Log resolved values on change. |
| `r$.flush()` | Synchronously drain pending style writes (tests). |
| `r$.apply(target, 'text-fluid-sm-xl p-fluid-2-8')` | Utility micro-grammar (`{text\|p\|m\|gap\|bg\|color}-fluid-{from}-{to}`). |
| `r$.manifest()` | The live provenance manifest: every active construct with target, behavior, call site and its serialized declaration (`config`) — also published on `window.__rjs_manifest` for the validation oracle: violations trace back to their owning construct, and `rjs init` generates contracts from it. |

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
override — defaults to the configured breakpoint range), `domain: fromElement('.sidebar')`
(cross-element: the value follows that element's width — always JS-driven).

String interpolation requires **structural congruence** (same tokens, literals, units — bare `0`
inherits the other side's unit) and throws a descriptive error otherwise. No fuzzy matching.

### Conditionals

| Function | Static CSS? | Meaning |
| --- | --- | --- |
| `when(pred, a, b?)` / `when([[pred, v], …])` | no | Arbitrary predicate; first match wins. |
| `whenInRange(min, max, value, otherwise?)` | yes* | 2013 heritage; min+max `@media`. |
| `breakpoint.below(ref, a, b?)` | yes* | `ref` is a name or px. Mobile-first emission; without `b` the value is `@media (max-width)`-guarded — it never leaks above the threshold. |
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

## `/geometry` — state from geometry

The niche CSS still can't select on. **JS detects, CSS styles**: predicates measure facts off
the live DOM; `geometry()` mirrors them into data-attributes for your stylesheets.

```typescript
geometry('.nav', { wrapped: whenWraps, crowded: whenOverflows });
// → <nav data-wrapped>       CSS: .nav[data-wrapped] { /* burger */ }
```

| Predicate | True when | Extra sensitivity |
| --- | --- | --- |
| `whenWraps()` | a child starts below the first row | |
| `whenOverflows(axis?)` | scroll size > client size (`'x'` default, `'y'`, `'both'`) | |
| `whenTruncated()` | content overflows an axis whose overflow is hidden/clip | |
| `whenStuck()` | a `position: sticky` element is currently pinned | scroll |
| `linesOf()` | *(number)* rendered text lines → `data-lines="3"` | |
| `whenCollides(other)` | the rects of the element and `other` overlap | scroll |

Re-measures on element resize (shared ResizeObserver), viewport resize, and scroll for the
scroll-sensitive ones. Every predicate's `measure(el)` is pure and callable one-shot.
**Never `display: none` what a predicate measures** (zeroed rects flip the state back and it
oscillates) — collapse keeping layout: `visibility: hidden; height: 0; overflow: hidden`.
`GeometryHandle`: `elements`, `measure()`, `pause()`, `resume()`, `dispose()` (removes the
attributes). SSR: inert. Bare factories are accepted (`wrapped: whenWraps` ≡ `whenWraps()`).

## Cross-element

- `fromElement(target)` — a fluid **domain**: `fluid(14, 18, { domain: fromElement('.sidebar'),
  from: 200, to: 600 })` makes the value follow the sidebar's width, not the viewport.
- `sync(target, 'height' | 'width')` — equalize a dimension across unrelated containers (max
  natural size wins). Re-measures on viewport resize and `handle.measure()`.
- `ratio(a, b, { min?, max? })` — the design constraint promoted to **enforcement**: keeps
  `width(a)/width(b)` in bounds by constraining `a`, and frees it while the layout complies.

## Typed breakpoints

```typescript
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1024 } as const);  // defineBreakpoints as named export
bp.below('tablet', 'column', 'row');   // autocompletes; a typo is a COMPILE error
bp.between('mobile', 'desktop', …);
bp.match({ mobile: 14, desktop: 18 });
bp.width('tablet');                    // 768
bp.matches('tablet');                  // reactive { signal, dispose }
bp.names;                              // ['mobile', 'tablet', 'desktop'] (ascending)
```

Also configures the global runtime, so the string-based `breakpoint.*` API keeps working.

## Tokens — fluid custom properties

```typescript
const t = r$.tokens({ '--space-md': fluid(8, 16), '--font-hero': fluid(24, 48, { curve: 'exponential' }) });
```

One write point instead of N styled elements: linear values compile to a static `clamp()`
stylesheet on `:root` (zero JS at runtime); non-linear/conditional/color values update their
variable from ONE viewport effect. The page consumes `var(--space-md)` anywhere — themable,
inspectable, SSR-friendly (`t.css` is the stylesheet to ship). `t.dynamic` lists the JS-driven
names; `t.toDTCG()` exports Design-Tokens-Community-Group JSON (static values verbatim,
responsive curves sampled under `$extensions['design.responsivejs']`); `t.dispose()` removes
everything.

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
| `elementSize(el): { signal, dispose }` | `{width, height}` off the same observer and refcount. |
| `scrollTick(): State<number>` | ONE capture-phase scroll listener (nested containers too). |

## Emission

`emitCSS(selector, map): { css, dynamicRest }` and `injectStyle(css, key)` /
`removeStyle(key)` are exported for build-time use. Linear fluid compiles with the Utopia
formula: `slope = (max−min)/(vMax−vMin)`, `intercept = min − slope·vMin` →
`clamp(lo, calc(intercept + slope·100vw), hi)` (bounds reordered for descending ranges,
`cqi` for containers).

## SSR

No `window` access at module level. Values resolve at `config.ssrWidth` until hydration; prefer
`r$.static()` for server-rendered CSS.

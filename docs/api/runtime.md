# API — @responsivejs/runtime

The authoring half: reactive `value = f(width)`, CSS-first. Depends only on
`@responsivejs/core`. Subpaths: `/signals`, `/curves`, `/layout`, `/typography`, `/geometry`
(everything is also re-exported from the root).

**The entry point is `r$`** — one callable namespace carrying the everyday authoring surface
(`r$.fluid`, `r$.tokens`, `r$.geometry`, `r$.whenWraps`, `r$.breakpoints`, `r$.sync`, …), so
the editor's autocomplete is the API browser. `responsive` is an alias of the same object (the
historical name). Precisely: every `r$` member exists, plus root named exports for the same
functions and for the lower layers. The namespace is a **superset of the authoring surface**:
transforms, curve sugar, `layout`/`typography` helpers and the measurement signals are all on
`r$.` too. Only module-level internals (`emitCSS`, `injectStyle`, `registerProvenance`) stay
named-export-only.
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
- In the tagged-template form a literal suffix that is *just a unit* (`${fluid(14, 24)}px`)
  belongs to the value: it is folded in, so the declaration still compiles to `clamp()`.
  Genuinely mixed content (`${a} solid red`) is a composed string and stays JS-driven — CSS
  has no way to express it.

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
| `r$.configure({ breakpoints, defaultUnit='px', useMediaQueries=true, debug, ssrWidth=1024, nonce })` | Change the config (itself reactive — **both** halves of every construct re-emit). `nonce` is copied onto every injected `<style>` for strict CSP. |
| `r$.config(): ResolvedConfig` | Read the config in force (frozen copy). |
| `r$.breakpoints({ mobile: 320, … } as const)` | Define named breakpoints — returns the [typed API](#typed-breakpoints). |
| `r$.tokens({ '--space-md': fluid(8, 16) })` | [Token bridge](#tokens--fluid-custom-properties): fluid custom properties on `:root`. |
| `r$.static(selector, map): { css, dispose }` | CSS-only compilation — throws if anything needs JS. Each call owns its own stylesheet (two static maps for one selector never clobber each other) and can remove it. |
| `r$.dynamic(target, map)` | Skip the static split, drive everything via JS. |
| `r$.observe(selector, map): ObserveHandle` | **SPA**: the selector stays bound as elements come and go. The static half is injected once (CSS already covers future elements); the JS half is wired per element on mount and released on removal. `refresh()` re-scans on demand. |
| `r$.scope(): Scope` | Group handles: `s.add(handle)` returns it unchanged, `s.dispose()` releases everything in reverse order. One call to tear a component down. |
| `r$.renderStatic(): string` | Every stylesheet emitted so far — what a server inlines into `<head>`. |
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
`container: true` (bind to nearest container; static output uses `cqi` — **requires `from`/`to`**,
see below), `from`/`to` (domain override — defaults to the configured breakpoint range),
`domain: fromElement('.sidebar')`
(cross-element: the value follows that element's width — always JS-driven).

`container: true` **must** come with `from`/`to` (or a `domain` source): it changes what is
measured, not the range it is measured over, so without them the value would interpolate across
your viewport breakpoints and a 240–820px card would walk a fifth of its curve. That failure is
silent and reads as "the library does nothing", so it is a construction-time error instead.

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

\* static when the branches compile to plain declarations — including nested values:
`breakpoint.above('md', fluid(14, 24))` emits `clamp()` **inside** the `@media` block. A branch
that needs its own media blocks (a per-breakpoint array) cannot nest and stays JS-driven.

### Helpers

- `custom(fn, opts?)` — wrap `(width) => value`; always JS.
- `combine([...])` — space-join parts (transform lists). Static when every part is.
- `scale(v)`, `rotate(v)`, `translate(x, y)`, `translateX(v)`, `translateY(v)`, `skew(x, y?)` — transform
  templates with conventional default units. They compile to static CSS whenever their
  arguments do: `transform: translateX(clamp(…)) scale(clamp(…))` is ordinary CSS.
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
  from: 200, to: 600 })` makes the value follow the sidebar's width, not the viewport. Honoured
  by every value kind (numbers, per-breakpoint arrays, colors, structural strings, `custom`);
  a `combine()` whose parts follow *different* elements throws, since a combined value has one
  driving width. A source selector that matches nothing throws **at construction**, before any
  stylesheet or provenance entry exists.
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
| `scrollTick(): Computed<number>` | ONE capture-phase scroll listener (nested containers too). |
| `releaseViewportHub()` | Drop every listener/observer and all registries (embedded hosts, SPA teardown). Signals re-arm lazily. |

Every signal the hub hands out is **read-only** (`Computed`): the entries are shared, so a
consumer writing to one would desynchronize every other consumer of the same element.

## Named imports ↔ the namespace

`r$.x` and the named import are the same function — the namespace is a convenience, not a
wrapper. Import names differ in a few places where the bare word would be too generic:

| Named import | Namespace | |
| --- | --- | --- |
| `applyResponsive` | `r$()` | apply a style map |
| `applyDynamic` | `r$.dynamic` | skip the static split, drive everything from JS |
| `staticCSS` | `r$.static` | emit + inject the stylesheet, returns `{ css, dispose }` |
| `applyUtilities` | `r$.apply` | the utility grammar below |
| `parseUtilities` | — | the same grammar, returning a `StyleMap` you can extend |
| `batchWrites` | `r$.batch` | coalesce signal updates *and* style writes into one flush |
| `defineBreakpoints` | `r$.breakpoints` | typed breakpoints |
| `bpWidth(name)` | — | the px of a named breakpoint; throws with the valid names |
| `emittedStyles()` | — | every stylesheet key r$ has injected (tests, SSR audits) |
| `releaseViewportHub()` | `r$.releaseViewportHub` | drop the shared listeners (tests) |

Everything else is spelled the same in both forms.

### The utility grammar — `r$.apply`

`r$.apply(target, spec)` parses a Tailwind-shaped string into a style map, for when a fluid
value is easier to write inline than to declare:

```typescript
r$.apply('.card', 'text-fluid-sm-2xl p-fluid-12-32 bg-fluid-slate50-slate200');
```

Grammar: `{alias}-fluid-{from}-{to}`, where `alias` is `text` · `p` · `m` · `gap` · `bg` ·
`color`. Sizes accept the named scale (`xs sm base lg xl 2xl 3xl`) or raw numbers; colours
accept hex or the named set. Anything it cannot parse throws naming the grammar — no silent
partial application. `parseUtilities(spec)` returns the map instead of applying it, so you can
merge it with hand-written declarations.

## Emission

`emitCSS(selector, map): { css, dynamicRest }` and `injectStyle(css, key)` /
`removeStyle(key)` are exported for build-time use. Linear fluid compiles with the Utopia
formula: `slope = (max−min)/(vMax−vMin)`, `intercept = min − slope·vMin` →
`clamp(lo, calc(intercept + slope·100vw), hi)` (bounds reordered for descending ranges,
`cqi` for containers).

## No build step

`@responsivejs/runtime/global` is the whole runtime as one IIFE (~15.5 kB gzip). Drop it in
with a `<script>` and `window.r$` is the same callable namespace — nothing else changes, the
CSS-first split included:

```html
<script src="https://unpkg.com/@responsivejs/runtime/dist/global.js"></script>
<script>
    r$.tokens({ '--space-m': r$.fluid(16, 24) });   // → clamp() on :root, zero JS after this
    r$.geometry('.site-nav', { wrapped: r$.whenWraps });
</script>
```

For CMS pages, plain HTML, docs demos, and agents injecting the runtime into a page they do
not own. `responsive` is published as an alias of the same object.

## SSR

No `window` access at module level; values resolve at `config.ssrWidth` until hydration.
The CSS-first half is fully server-renderable:

```typescript
r$('.hero', { fontSize: r$.fluid(16, 32) });      // handle.css is its compiled half
r$.tokens({ '--space-m': r$.fluid(16, 24) });     // tokens().css likewise
const sheet = r$.renderStatic();                   // …or every emission at once
// → inline `sheet` into <head> and the page is correct BEFORE any JS runs
```

Under a strict Content-Security-Policy pass `r$.configure({ nonce })`: every injected
`<style>` carries it.

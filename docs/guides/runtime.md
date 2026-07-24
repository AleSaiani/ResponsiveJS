# Using r$ in JavaScript / TypeScript — the runtime guide

This is the guide to `@responsivejs/runtime`: what each API is *for*, how the pieces fit,
and worked examples that grow from one line to a real page. Prefer building along?
The [tutorial](../tutorial.md) walks the same ground hands-on. The
[API reference](../api/runtime.md) has every exact signature; the
[pattern catalog](case-studies.md) covers every construct on a real problem.

```bash
npm i @responsivejs/runtime
```

```typescript
import { r$ } from '@responsivejs/runtime';
```

Everything in this guide hangs off that one import. Type `r$.` in your editor and the whole
surface autocompletes — values, geometry, tokens, breakpoints. (Named imports of the same
functions exist too — `import { fluid, geometry } from '@responsivejs/runtime'` — use them
when you want maximum tree-shaking; they are literally the same objects.)

## The mental model

r$ treats the screen as a **parametric plane**: every style property is a *function of width*
— `fontSize = f(viewportWidth)`. Instead of enumerating breakpoints ("at 768px switch to
this"), you describe the function, and r$ decides the cheapest correct way to run it:

- if the function is **linear**, it becomes a static CSS `clamp()` — shipped as a stylesheet,
  **zero JavaScript at runtime**;
- if CSS can't express it (curves, geometry, values measured from other elements), r$ drives
  it from one shared, batched reactive graph.

That decision is the **CSS-first contract**, and it's automatic. You write intent; the split
is r$'s job.

## Your first fluid value

```typescript
r$('.hero h1', { fontSize: r$.fluid(24, 48) });
```

What just happened, precisely:

1. `r$.fluid(24, 48)` created a **ResponsiveValue** — a pure description meaning "24px at the
   narrowest breakpoint, 48px at the widest, interpolated linearly in between".
2. `r$(target, map)` applied it. Because this value is linear and the target is a selector,
   r$ *did not* attach a resize listener — it computed the Utopia formula and injected

   ```css
   .hero h1 { font-size: clamp(24px, calc(15.2px + 2.75vw), 48px); }
   ```

   as a `<style data-responsivejs>` tag. Resize all you want: the browser does the work.
3. The call returned a **handle**. Keep it if this code can unmount:

   ```typescript
   const hero = r$('.hero h1', { fontSize: r$.fluid(24, 48) });
   // …later, e.g. on route change:
   hero.dispose();   // removes what it did AND restores pre-existing inline values
   ```

Every r$ construct follows this same shape: *describe → apply → get a disposable handle*.

### Where do 24 and 48 apply? The domain

By default the function's domain is the configured breakpoint range (320→1920 out of the box).
Three ways to control it:

```typescript
r$.fluid(24, 48);                        // over the configured range
r$.fluid(24, 48, { from: 480, to: 1200 }); // explicit domain for this value
r$.config({ breakpoints: [360, 768, 1440] }); // change the global range
```

Below the domain the value clamps to `min`, above it to `max` — a fluid value never
extrapolates.

### Units and other options

The third argument is either a unit string or an options object:

```typescript
r$.fluid(1.5, 3, 'rem');                          // unit
r$.fluid(16, 40, { curve: 'exponential' });       // growth shape — see “Curves”
r$.fluid(16, 24, { container: true });            // driven by the nearest container, not the viewport
```

`fluid` is polymorphic beyond numbers: `r$.fluid('#666', '#111')` interpolates colors
perceptually (OKLab), `r$.fluid([12, 16, 24])` places one value per configured breakpoint,
`r$.fluid('scale(0.9)', 'scale(1.1)')` interpolates structured strings token by token.

## Breakpoints with names your compiler checks

Magic numbers scattered through code rot. Define them once — `as const` matters, it's what
lets TypeScript learn your names:

```typescript
const bp = r$.breakpoints({ mobile: 360, tablet: 768, desktop: 1280 } as const);
```

That call does two things: configures the global runtime (so `fluid` domains and array values
use your range), and returns an API **typed on your names**:

```typescript
r$('.cards', {
    gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)'),
});

bp.width('tablet');        // 768
bp.between('mobile', 'desktop', …);
bp.match({ mobile: 14, desktop: 18 });   // largest matching name wins

// bp.below('moble', …)   ← this is a COMPILE error, not a runtime surprise
```

For JS logic (not styles), `bp.matches('tablet')` returns a reactive signal you can read and
subscribe to, with a `dispose` that releases the underlying media-query listener.

Where possible these emit static `@media` blocks — `bp.below('tablet', 'none', 'flex')` costs
zero JavaScript.

## Tokens: the recommended backbone

Styling elements one by one is fine for a hero. For a *system* — spacing scale, type scale,
radii — write the scale once as **custom properties** and let CSS consume it:

```typescript
const theme = r$.tokens({
    '--space-s': r$.fluid(8, 12),
    '--space-m': r$.fluid(16, 24),
    '--font-body': r$.fluid(15, 18),
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }),
});
```

```css
.card  { padding: var(--space-m); }
h1     { font-size: var(--font-hero); }
```

Why this is usually better than styling elements directly:

- **One write point.** Linear tokens compile to a single `clamp()` stylesheet on `:root`;
  non-linear ones update one variable from one effect. N elements consume them for free.
- **Inspectable.** Open devtools, look at `:root`, see your whole scale and its current values.
- **Themable.** A theme is just another set of the same variables.
- **Portable.** `theme.css` is the stylesheet (ship it from the server for SSR);
  `theme.toDTCG()` exports the scale as Design Tokens Community Group JSON — with the
  responsive curve sampled per breakpoint under `$extensions` — for Figma/Style Dictionary
  pipelines.

`theme.dynamic` lists which names stayed JS-driven, so you always know what you're paying for.

## Geometry: state CSS can't see

CSS has no selector for *"my children wrapped onto two rows"*, *"this sticky header is
currently pinned"*, *"this text is actually truncated"*. Detecting those is why layout code
degenerates into ResizeObserver + measurement + class-toggling spaghetti.

r$'s answer is a family of **predicates** — small measurements — and one wiring function:

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```

From now on the nav carries `data-wrapped` exactly while its children sit on more than one
row. The styling stays where styling belongs:

```css
.site-nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .menu-button { display: block; }
```

This is the **“JS detects, CSS styles”** pattern. JS maintains a fact; CSS decides what the
fact looks like. Your burger menu now has no breakpoint to go stale — add a seventh link,
translate the labels to German, it keeps working. (If any step here feels compressed, the
[case studies](case-studies.md) unpack this exact example end to end — what is measured, the
DOM before/after, and the test.)

**The one rule** (learn it once): never `display: none` the element a predicate measures.
Hidden-by-display elements have zero-sized children, so the predicate would flip back and the
state would oscillate. Collapse while *keeping layout* — `visibility: hidden; height: 0;
overflow: hidden` — as above.

The predicates, and when to reach for each:

| Predicate | The fact it maintains | Typical use |
| --- | --- | --- |
| `r$.whenWraps()` | children flow on >1 row | burger menus, toolbar overflow |
| `r$.whenOverflows('x'\|'y'\|'both')` | content exceeds the box | "scroll for more" affordances |
| `r$.whenTruncated()` | text is clipped (ellipsis/clamp active) | show a "more" link only when needed |
| `r$.whenStuck()` | a sticky element is pinned right now | header shadow, condensed toolbar |
| `r$.linesOf()` | number of rendered text lines | `data-lines="2"` → balance-dependent styling |
| `r$.whenCollides(other)` | two elements' boxes overlap | floating UI avoiding content |

Details worth knowing:

- Boolean facts toggle attribute *presence*; numeric ones (`linesOf`) write the value —
  `data-lines="3"` — so CSS can key on counts: `h2[data-lines='1'] { text-align: center; }`.
- Re-measurement is automatic — element resize (one shared ResizeObserver), viewport resize,
  and scroll for the scroll-dependent predicates (`whenStuck`, `whenCollides`).
- Every predicate's `measure(el)` is a pure function you can call once, without wiring:
  `r$.whenWraps().measure(nav)` → boolean.
- The handle: `measure()` forces a re-check after you mutate content; `pause()/resume()`
  suspend it; `dispose()` removes observers *and* the attributes.
- Server-side, `geometry()` is inert (no window → no-op) — it's progressive enhancement by
  construction.

## Cross-element relations

Container queries look **up** the tree; nothing in CSS lets element A react to element B's
size. Three constructs cover the useful cases:

```typescript
// 1. A value whose domain is ANOTHER element's width:
r$('.main-content', {
    fontSize: r$.fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
});
// reads: 14px when the sidebar is 200px wide, 18px when it's 400px.

// 2. Equal heights across different parents (where grid/subgrid can't reach):
const heads = r$.sync('.card h3', 'height');   // max natural height wins, re-synced on resize
heads.measure();                               // call after dynamic content changes

// 3. A layout invariant, enforced:
r$.ratio('.sidebar', '.main', { min: 0.2, max: 0.33 });
```

`ratio` deserves a note: it's the same `proportion` constraint the validation oracle *asserts*
in CI — here promoted to runtime *enforcement*. Inside the bounds the layout flows free (the
constraint is removed); outside them the first element's width is pinned to the boundary.

## Conditionals, when a function isn't enough

```typescript
r$('.panel', {
    // arbitrary predicate — always JS-driven:
    padding: r$.when((w) => w > 600 && isLoggedIn(), 32, 16),
    // range value — static @media when branches are plain values:
    outline: r$.whenInRange(320, 767, '2px solid red'),
});
```

Branches nest: a `fluid` inside a `when` resolves correctly (and forces the JS path).

## Lifecycle, testing, SSR

**Handles.** Everything returns one. `dispose()` always un-does exactly what the construct
did — including restoring inline values that existed before it (an inline `font-size` you
had set survives a handle's lifetime). Handles are isolated: two on the same selector own
separate stylesheets and dispose independently. In component frameworks, tie it to unmount:

```typescript
useEffect(() => {
    const h = r$.geometry(ref.current, { wrapped: r$.whenWraps });
    return () => h.dispose();
}, []);
```

**Testing.** Style writes are batched to one rAF flush per frame; in tests call `r$.flush()`
to drain them synchronously after triggering a resize.

**SSR.** No construct touches `window` at import time. For zero-flash server rendering, emit
the static half yourself: `r$.static(selector, map)` returns the CSS (and throws — on purpose
— if the map contains anything that would silently need JS), and `r$.tokens(...).css` is the
token stylesheet. Geometry attributes appear on hydration.

## Customizing, extending, seeing inside

r$'s constructs are deliberately small objects — which means every one of them can be
customized, extended, or interrogated.

**Write your own predicate.** A geometry predicate is just `{ measure(el) }` — a function
that answers a question about an element (plus `scroll: true` if scrolling changes the
answer). If r$ doesn't ship the fact you need, define it:

```typescript
const whenPortrait = {
    measure: (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.height > r.width;
    },
};

r$.geometry('.media-card', { portrait: whenPortrait });
// → <div class="media-card" data-portrait> … CSS takes it from there
```

Your predicate gets the exact same re-measurement machinery as the built-ins.

**Rename the attributes.** `r$.geometry(target, states, { prefix: 'data-r-' })` if `data-*`
names could collide with something else in your app.

**React in JS, not just CSS.** Data-attributes are for stylesheets; when *logic* needs the
fact, drop one level to the signal layer the constructs are built on:

```typescript
import { effect, elementSize, viewportWidth, subscribe } from '@responsivejs/runtime';

const { signal: size, dispose } = elementSize(document.querySelector('.sidebar')!);
const stop = effect(() => {
    if (size.get().width < 250) collapseSidebarInYourStateStore();
});

const bp = r$.breakpoints({ tablet: 768 } as const);
const tablet = bp.matches('tablet');
subscribe(tablet.signal, (isTablet) => reloadLighterImages(isTablet));
```

Same sources, same refcounting — a predicate and your effect share one ResizeObserver.

**Escape hatches at every level.** A value that no combinator expresses is one function away:
`r$.custom((width) => myFormula(width))` participates in maps like any fluid. A one-shot
answer without any wiring: `r$.whenWraps().measure(el)`. A forced re-check after you mutated
content: `handle.measure()`.

**Provenance: the closed loop.** Every construct registers itself in a live manifest —
`r$.manifest()` (also `window.__rjs_manifest`) lists what controls the page: construct kind,
target, behavior, best-effort call site. When the validation side measures a page running the
runtime, it ships the manifest with the measurements and annotates violations with their
`owner` — so a report doesn't just say ".nav overflows at 320px", it says *which construct
declared at src/navigation.ts:18 owns .nav* — and an agent patches the construct, not the CSS.

**See what r$ is doing.** Three inspection points, all in plain devtools:

- `r$.debug(true)` — logs every resolved value as it's applied (`[r$] .hero font-size @
  400px → 27.5`).
- The injected stylesheets are ordinary `<style data-responsivejs>` tags in `<head>` — open
  one and read the exact `clamp()`/`@media` CSS your values compiled to.
- Tokens live on `:root` — the Styles panel shows every variable and its current value; the
  Elements panel shows geometry's `data-*` attributes appearing and leaving live as you
  resize.

## What it costs

One passive resize listener, one shared ResizeObserver, one capture-phase scroll listener —
total, not per construct; each is refcounted and removed when the last consumer disposes.
Style writes coalesce to one flush per frame. The reactive graph is pull-based (reading a
signal is a property access), and the whole runtime is ~11 kB gzipped with zero dependencies.

## Where next

- [The pattern catalog](case-studies.md) — every construct on a real problem, three of them
  unpacked end to end (DOM before/after, the measurement, the test).
- [Testing guide](testing.md) — unit-test the pure half, browser-test the geometric half.
- [Landing example](../../examples/landing) — all of the above on one real page, with the
  hack each construct replaces.
- [API reference](../api/runtime.md) — every signature, including the signal layer
  (`state`/`computed`/`effect`) the constructs are built on.
- Validating what you authored: [the design guide](validation.md) — the same
  `value = f(width)` model, measured and asserted from outside.

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
r$.configure({ breakpoints: [360, 768, 1440] }); // change the global range (r$.config() reads it back)
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

CSS has no selector for *"my children wrapped"*, *"this sticky header is pinned"*, *"this
text is truncated"*. r$'s answer is a family of **predicates** — pure measurements — wired by
`geometry()` into data-attributes your stylesheet reacts to (**JS detects, CSS styles**):

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
// → <nav data-wrapped> while the links sit on >1 row; CSS does the burger.
```

| Predicate | The fact it maintains | Typical use |
| --- | --- | --- |
| `r$.whenWraps()` | children flow on >1 row | burger menus, toolbar overflow |
| `r$.whenOverflows('x'\|'y'\|'both')` | content exceeds the box | "scroll for more" affordances |
| `r$.whenTruncated()` | text is clipped (ellipsis/clamp active) | show "more" only when needed |
| `r$.whenStuck()` | a sticky element is pinned right now | header shadow, condensed toolbar |
| `r$.linesOf()` | number of rendered text lines | `data-lines="2"` styling |
| `r$.whenCollides(other)` | two elements' boxes overlap | floating UI avoiding content |

Mechanics in brief: boolean facts toggle attribute presence, numeric ones write the value
(`data-lines="3"`); re-measurement is automatic (shared ResizeObserver, viewport resize,
scroll for the scroll-sensitive two); every `measure(el)` is pure and callable one-shot;
handles expose `measure()/pause()/resume()/dispose()`; SSR-inert.

**The one rule**: never `display: none` what a predicate measures — collapse keeping layout
(`visibility: hidden; height: 0; overflow: hidden`), or the state oscillates.

This is taught hands-on in [tutorial steps 3–4](../tutorial.md#step-3--the-burger-that-cant-go-stale),
unpacked completely (DOM before/after, the measurement, the test) in the
[deep dives](case-studies.md#deep-dives), and every predicate has a pattern in the
[catalog](case-studies.md).

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

## Responsive or adaptive? Choosing the mechanism

Every responsive decision is one of three kinds — and r$ has one mechanism per kind:

| The property/behavior is… | Mechanism | Examples |
| --- | --- | --- |
| **Continuous** — it can meaningfully take every in-between value | `r$.fluid` (responsive) | sizes, spacing, type, colors, shadows, radii |
| **Discrete by width** — the layout changes *structure* at a threshold | `bp.*` / `whenInRange` / `when` (adaptive) | display, grid templates, flex-direction, component variants |
| **Discrete by geometry** — the trigger is a measured fact, not a width | `r$.geometry` (adaptive) | nav wrapped, header stuck, text truncated |

The test: *does an in-between value mean anything?* A font can be 16.37px — fluid. A sidebar
can't be 37% visible — that's a switch. And if the right moment for the switch is "when it no
longer fits" rather than "at 768px", the trigger is geometric — use a predicate, not a
breakpoint.

### Adaptive by width, concretely

```typescript
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

r$('.sidebar', {
    display: bp.below('tablet', 'none', 'block'),          // hide on mobile — static @media
});
r$('.filters', {
    flexDirection: bp.below('tablet', 'column', 'row'),    // stack → row
});
r$('.panel', {
    outline: r$.whenInRange(320, 767, '2px solid red'),    // only inside a range
    padding: r$.when((w) => w > 600 && isCompactMode(), 16, 32),  // arbitrary logic — JS path
});
```

Plain-value branches compile to static `@media`; a `when()` with a lambda stays JS (CSS can't
run your predicate). `bp.below(px, value)` **without** a fallback is max-width-guarded — the
value never leaks above the threshold.

### Mixing the regimes

Branches nest: an adaptive switch can hold fluid values, so each regime stays fluid *inside*
its range —

```typescript
r$('.hero h1', {
    // two regimes, each fluid: tighter curve on mobile, wider on desktop
    fontSize: bp.below('tablet', r$.fluid(24, 32, { to: 767 }), r$.fluid(36, 64, { from: 768 })),
});
```

(Nested `ResponsiveValue` branches resolve correctly and take the JS path.) The complete
per-property examples — backgrounds, shadows, transforms — live in the
[catalog's styling section](case-studies.md#styling-any-property).

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

**A component usually creates several constructs.** Group them instead of juggling handles:

```typescript
const s = r$.scope();
s.add(r$('.card', { padding: r$.fluid(12, 24) }));
s.add(r$.geometry('.card', { wrapped: r$.whenWraps }));
s.add(r$.sync('.card h3', 'height'));
// …later, one call releases all three, in reverse order:
s.dispose();
```

**Single-page apps: elements come and go.** `r$('.card', …)` binds to the elements that exist
at call time. When a router or a list re-renders them, bind the *selector* instead:

```typescript
const cards = r$.observe('.card', { padding: r$.fluid(12, 24) });
// new .card nodes are picked up automatically; removed ones are released
```

The static half is injected once — CSS already applies to elements that don't exist yet — so
`observe()` only wires the JS half per element. Framework adapters use the same mechanism.

**Testing.** Style writes are batched to one rAF flush per frame; in tests call `r$.flush()`
to drain them synchronously after triggering a resize.

**SSR.** No construct touches `window` at import time, and the CSS-first half is fully
server-renderable. Three ways in, from most to least surgical: `handle.css` (what that one
construct compiled), `r$.tokens(...).css` (the token stylesheet), or `r$.renderStatic()` —
every emission so far, ready to inline into `<head>` so the page is correct before any JS
runs. `r$.static(selector, map)` is the strict variant: it returns `{ css, dispose }` and
throws — on purpose — if the map contains anything that would silently need JS. Geometry
attributes appear on hydration. Under a strict CSP, `r$.configure({ nonce })` puts the nonce
on every injected `<style>`.

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
target, behavior, best-effort call site, and the **serialized declaration itself** (a
`fluid(16, 32, { curve: 'exponential' })` ships as
`{value:'fluid', min:16, max:32, curve:'exponential'}`). When the validation side measures a
page running the runtime, it ships the manifest with the measurements and annotates
violations with their `owner` — so a report doesn't just say ".nav overflows at 320px", it
says *which construct declared at src/navigation.ts:18 owns .nav*, and when the construct
controls the violating property the fix arrives as a **runtime-patch** (current declaration +
the value that would satisfy the constraint) — an agent patches the construct, not the CSS.
The declarations also power `rjs init <url>`: it generates a design contract *from* your
constructs (fluid → monotonic + continuous + baseline, ratio → proportion, your breakpoints →
the sweep widths) — a regression net you didn't have to write.

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

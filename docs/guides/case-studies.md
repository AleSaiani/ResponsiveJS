# The pattern catalog — every construct, on a real problem

One pattern per real-world problem, organized by what you're building. Each: the problem, the
construct, what it replaces. New here? Do the [tutorial](../tutorial.md) first — it builds a
page with the core patterns. Three of the entries below are also
[unpacked end to end](#deep-dives) (DOM before/after, the measurement, the test).

## Navigation & page chrome

### The burger that appears exactly when needed — `whenWraps`

Replaces: the hand-tuned `@media (max-width: 843px)` that rots when a link is added or the
site is translated.

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```
```css
.site-nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .menu-button { display: block; }
```

[Full anatomy below](#deep-dive-1--the-burger-menu-whenwraps). Rule: collapse *keeping
layout* — never `display: none` what a predicate measures.

### Toolbar "More…" overflow — `whenOverflows`

Replaces: guessing how many toolbar buttons fit at which width.

```typescript
r$.geometry('.toolbar', { crowded: r$.whenOverflows() });
```
```css
.toolbar { overflow: hidden; }
.toolbar[data-crowded] ~ .more-menu-button { display: inline-flex; }
```

The "More…" button exists exactly while content exceeds the box.

### Header effects only while pinned — `whenStuck`

Replaces: the IntersectionObserver-sentinel hack. `r$.geometry('.site-header', { stuck:
r$.whenStuck() })` → `.site-header[data-stuck] { box-shadow: …; }` — shadow, condensed logo,
blur: anything, only while actually stuck. [Full anatomy below](#deep-dive-2--header-effects-only-while-pinned-whenstuck).

## Content

### "Read more" only when something was cut — `whenTruncated`

Replaces: character-count heuristics that break with fonts, widths, languages.
`r$.geometry('.excerpt', { truncated: r$.whenTruncated() })` →
`.excerpt[data-truncated] + .read-more { display: inline; }`.
[Full anatomy below](#deep-dive-3--read-more-only-when-truncated-whentruncated).

### Layout that reacts to line count — `linesOf`

Replaces: nothing — this wasn't feasible. A heading that centers when it fits on one line,
left-aligns when it wraps:

```typescript
r$.geometry('.card h2', { lines: r$.linesOf() });   // → data-lines="1" | "2" | …
```
```css
.card h2[data-lines='1'] { text-align: center; }
```

### The carousel scroll affordance — `whenOverflows('x')`

Show the "scroll →" hint only while there IS more content:

```typescript
r$.geometry('.chip-row', { scrollable: r$.whenOverflows('x') });
```
```css
.chip-row[data-scrollable]::after { content: '→'; /* fade gradient, arrow, anything */ }
```

## Relations between elements

### Equal heights across unrelated containers — `sync`

Replaces: subgrid (when the DOM allows it) or hand-rolled measure loops with stale-value
bugs. `r$.sync('.card h3', 'height')` — max natural height wins, re-synced on resize,
restored on dispose. Call `handle.measure()` after swapping content dynamically.

### A layout invariant, enforced — `ratio`

Replaces: hoping the CSS holds. `r$.ratio('.sidebar', '.main', { min: 0.2, max: 0.33 })` —
inside the bounds the layout flows free; outside them the sidebar is pinned to the boundary.
This is the validation constraint `proportion` promoted to runtime *enforcement*: author and
verifier speak the same rule.

### A value driven by ANOTHER element — `fromElement`

Replaces: nothing — container queries only see ancestors.

```typescript
r$('.main-content', {
    fontSize: r$.fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
});
```

Master-detail panes, editors whose type tracks the preview pane, anything where element A
answers to element B's size.

### Floating UI that yields to content — `whenCollides`

```typescript
r$.geometry('.floating-cta', { overlapping: r$.whenCollides('.footer') });
```
```css
.floating-cta[data-overlapping] { opacity: 0.15; pointer-events: none; }
```

The FAB fades exactly while it covers the footer — measured, not scripted to scroll offsets.

## Fluid values & the design system

### The type scale with character — curves

Linear is free (static `clamp()`); when linear feels flat, shape the growth:

```typescript
r$.tokens({
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }),  // restrained on mobile, dramatic on wide
    '--font-body': r$.fluid(15, 18),                            // linear → zero JS
});
```

### Per-breakpoint values without the ladder — `fluid([...])`

`r$.fluid([12, 16, 24, 32])` places one value per configured breakpoint and interpolates the
segments — the multi-stop scale as one expression, still statically compiled where linear.

### Perceptual color transitions — `fluid(color, color)`

`r$.fluid('#1a1a2e', '#4a4a6a')` interpolates in OKLab — no gray dead-zone in the middle
(the classic sRGB-mix artifact). Backgrounds that lighten as the viewport grows, borders that
soften: `color: r$.fluid('#111', '#555')`.

### Themes and design tokens as a pipeline — `tokens` + DTCG

The scale lives in one place, CSS consumes `var()` everywhere, themes are alternative token
sets — and `handle.toDTCG()` exports the whole system (curves sampled per breakpoint) as
Design Tokens Community Group JSON for Figma/Style Dictionary pipelines. `handle.css` is the
SSR stylesheet.

### Container-aware components — `{ container: true }`

`r$.fluid(14, 18, { container: true })` binds to the nearest container instead of the
viewport (static output uses `cqi`; the handle configures `container-type` on the parent,
refcounted). The same card component sizes correctly in a sidebar and in the main column.

**Give it the container's range.** `container: true` changes *what is measured*, not the
domain the value is interpolated over — that still defaults to your configured breakpoints.
A card that lives between 240px and 820px inside a `[320, 1440]` project therefore only ever
walks a fifth of its own curve, and the result looks like nothing is happening:

```ts
const panel = { container: true, from: 240, to: 820 };   // the container's real range

r$('.card', {
    fontSize: r$.fluid(15, 26, panel),
    padding: r$.fluid(10, 30, panel),
});
```

Rule of thumb: if a value is bound to a container, `from`/`to` are not optional polish — they
are the other half of the declaration.

## Styling any property

The style map takes **any** CSS property (camelCase), and `fluid` is polymorphic — numbers,
colors, structured strings. These patterns show the range on real problems.

### The hero that sets a mood — background color ramps

Problem: on a phone the hero must be quiet and readable; on a cinema display it can be
atmospheric. Discrete theme swaps at a breakpoint look like a glitch.

```typescript
r$('.hero', {
    backgroundColor: r$.fluid('#16181d', '#1e2340'),   // deepens as space grows
    color: r$.fluid('#e8e8e8', '#ffffff'),
});
```

Interpolation runs in OKLab — no gray dead-zone mid-ramp (the classic sRGB artifact). Any
color property works: `borderColor`, `outlineColor`, `caretColor`.

### Depth that grows with space — fluid shadows

Problem: design systems scale elevation in steps (sm/md/lg) and pick one per breakpoint;
cards jump between flat and floating. Structured-string interpolation makes elevation
continuous — numbers *and* the shadow color interpolate together:

```typescript
r$('.card', {
    boxShadow: r$.fluid('0 1px 3px rgba(0,0,0,0.30)', '0 16px 48px rgba(0,0,0,0.18)'),
    borderRadius: r$.fluid(8, 16),
});
```

Mobile: tight, dark, close to the surface. Desktop: soft, wide, floating. Same works for
`filter: blur(…)`, `textShadow` — any congruent value string.

### Presence without reflow — fluid transforms

Problem: a decorative element should be subtler on small screens, but animating `width`
causes reflow. Transforms are compositor-only:

```typescript
import { combine, scale, rotate } from '@responsivejs/runtime';

r$('.hero-badge', {
    transform: combine([scale(r$.fluid(0.85, 1.15)), rotate(r$.fluid(-2, -6, 'deg'))]),
});
```

### Density as a system — the dashboard ramp

Problem: dashboards need to be dense on laptops and breathable on big monitors — usually
solved by a "compact mode" toggle users must find. Make density a *function of space*
instead, in one place:

```typescript
r$.tokens({
    '--cell-pad': r$.fluid(6, 14),
    '--row-gap': r$.fluid(4, 10),
    '--font-data': r$.fluid(12.5, 15),
});
```

```css
td { padding: var(--cell-pad); font-size: var(--font-data); }
tr { margin-block: var(--row-gap); }
```

Every table, list and card in the app breathes together — and the whole ramp is one token
block you can hand to design as DTCG.

### Structure switching — the adaptive side

When the change is *structural* (an in-between value means nothing), switch discretely —
plain-value branches compile to static `@media`:

```typescript
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

r$('.filters', { flexDirection: bp.below('tablet', 'column', 'row') });
r$('.sidebar', { display: bp.below('tablet', 'none', 'block') });
```

And the regimes mix: a switch's branches can hold fluid values, so each regime stays fluid
inside its range. When to flow vs when to switch — and when the trigger should be geometric
rather than a width — is the [responsive-or-adaptive framework](runtime.md#responsive-or-adaptive-choosing-the-mechanism)
in the guide.

## Lifecycle & environments

### SPA components — keep the handle

Every construct returns a handle; tie it to unmount and everything is undone *and restored*:

```typescript
useEffect(() => {
    const nav = r$.geometry(ref.current!, { wrapped: r$.whenWraps });
    return () => nav.dispose();
}, []);
```

Note: selectors resolve at creation — for elements mounted later, create the construct in the
component that owns them — or let an [adapter](../api/adapters.md) do it for you
(React, Vue and Angular bindings own the lifecycle), or `r$.scope()` to release a group at once.

### SSR without flashes — static emission

Linear constructs never needed JS: ship `r$.tokens(...).css` / `r$.static(selector, map).css` as
server-rendered CSS; geometry attributes hydrate on the client (constructs are inert without
`window`). The page is correct before a single byte of JS runs.

---

# Deep dives

Three of the patterns above, unpacked completely: the HTML, what the predicate measures, the
exact DOM before/after, why the CSS is shaped that way, and the test.

## Deep dive 1 — The burger menu (`whenWraps`)

### The situation

A header with a logo, six nav links, and a burger button that should appear **only when the
links no longer fit on one line**:

```html
<header class="site-header">
    <span class="logo">r$</span>
    <nav class="site-nav">
        <a href="/model">Model</a>
        <a href="/authoring">Authoring</a>
        <a href="/validation">Validation</a>
        <a href="/contracts">Contracts</a>
        <a href="/agents">Agents</a>
        <a href="/docs">Docs</a>
    </nav>
    <button class="menu-button" hidden aria-label="Menu">☰</button>
</header>
```

The classic solution is `@media (max-width: 843px)` — where 843 is whatever width the links
happened to overflow at the day you wrote it. Add a link, rename one, translate the site to
German, and 843 is silently wrong.

### What `whenWraps` actually does

`whenWraps` is a **measurement**, nothing more: given an element, it reads the rectangles of
its children and answers one question — *does any child start below the first row?*

```
one row (fits):                    two rows (wrapped):
[Model][Authoring]…[Docs]          [Model][Authoring][Validation]
                                   [Contracts][Agents][Docs]
 all tops equal → false             a child's top ≥ first child's bottom → true
```

You can call it yourself, one-shot, no wiring — this is worth trying in a console to demystify
it:

```typescript
r$.whenWraps().measure(document.querySelector('.site-nav'));   // → true | false
```

### What `geometry()` adds

`geometry()` turns that one-shot measurement into a **maintained fact on the DOM**:

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```

From this line on, r$ re-runs the measurement whenever it could change — the nav resizes
(one shared ResizeObserver), the viewport resizes — and mirrors the answer into an attribute.
Concretely, this is the *only* thing it does to your DOM:

```html
<!-- viewport 1200px: the links fit -->
<nav class="site-nav">…</nav>

<!-- viewport 400px: the links wrapped -->
<nav class="site-nav" data-wrapped>…</nav>
```

No styles are touched, no classes added, nothing hidden. The key you chose (`wrapped`)
becomes the attribute name (`data-wrapped`).

### The CSS reacts

Styling is entirely yours, in the stylesheet, keyed on that attribute:

```css
/* collapsed nav: hidden but STILL LAID OUT (see the rule below) */
.site-nav[data-wrapped] {
    visibility: hidden;
    height: 0;
    overflow: hidden;
}
.site-nav[data-wrapped] ~ .menu-button {
    display: block;
}
```

Why `visibility: hidden; height: 0` and **not** `display: none`: the predicate must keep
measuring the nav to know when to un-wrap. `display: none` gives every child a 0×0 rect, so
the measurement would flip back to "not wrapped", the nav would reappear, wrap again — an
oscillation. Collapsing *while keeping layout* makes the state stable. This is the one rule
of geometry; it will fail loudly in front of you the first time you forget it, and now you
know why.

### Seeing it work

Open the page, open devtools on the `<nav>`, and drag the window narrower: at the exact width
where the sixth link would fall to a second row, `data-wrapped` appears and the burger shows.
Drag wider: it disappears. There is no number anywhere in your code.

### Verifying it in a test

```typescript
await page.setViewportSize({ width: 400, height: 800 });
await page.waitForFunction(() => document.querySelector('.site-nav').hasAttribute('data-wrapped'));

await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForFunction(() => !document.querySelector('.site-nav').hasAttribute('data-wrapped'));
```

(Why `waitForFunction` and not a fixed sleep, and why this must be a real browser and not
happy-dom: see [the testing guide](testing.md).)

---

## Deep dive 2 — Header effects only while pinned (`whenStuck`)

### The situation

A sticky header that should cast a shadow **only while it is actually stuck** to the top —
not at page load, not while the page is at scroll 0.

CSS can make an element sticky (`position: sticky; top: 0`) but has no selector for "is it
currently pinned". The folklore workaround is an IntersectionObserver watching an invisible
1px sentinel element placed above the header — extra DOM, extra code, easy to break.

### What `whenStuck` measures

For a `position: sticky` element, being "stuck" is a geometric fact: the element sits exactly
at its `top` offset while its parent has scrolled past it. `whenStuck` reads both rectangles
and answers that. Because scrolling changes the answer, this predicate re-measures on scroll
too (a single shared, passive scroll listener — you don't manage it).

```typescript
r$.geometry('.site-header', { stuck: r$.whenStuck() });
```

```html
<!-- at scroll 0 -->            <!-- scrolled down -->
<header class="site-header">    <header class="site-header" data-stuck>
```

```css
.site-header[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / 0.12); }
```

Scroll down → shadow. Scroll back to the top → the attribute leaves, the shadow goes. The
same attribute can drive anything: a condensed logo, a background blur, a border.

### Verifying it

```typescript
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForFunction(() => document.querySelector('.site-header').hasAttribute('data-stuck'));

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForFunction(() => !document.querySelector('.site-header').hasAttribute('data-stuck'));
```

One trap from our own test suite: make sure the page is tall enough to scroll at the viewport
you chose — at a wide viewport a short page may not scroll at all, and the test waits forever.

---

## Deep dive 3 — "Read more" only when truncated (`whenTruncated`)

### The situation

Card excerpts clamped to three lines, with a "Read more" link — but the link should exist
**only when something was actually cut off**. Rendering it always is noise; guessing by
character count breaks with different fonts, widths, and languages.

### What `whenTruncated` measures

Truncation is, again, geometry: the content's scroll size exceeds the box's client size *on an
axis whose overflow is clipped* (`hidden`/`clip`). That last condition matters — a scrollable
box overflows too, but nothing is lost, so it does not count as truncated.

```typescript
r$.geometry('.excerpt', { truncated: r$.whenTruncated() });
```

```html
<!-- long text, clamped -->                      <!-- short text, fits -->
<p class="excerpt" data-truncated>…</p>          <p class="excerpt">…</p>
```

```css
.excerpt { display: -webkit-box; -webkit-line-clamp: 3; overflow: hidden; }
.excerpt + .read-more { display: none; }
.excerpt[data-truncated] + .read-more { display: inline; }
```

Resize the card, change the font, translate the copy — the link appears exactly when the
third line ends in an ellipsis, because that is what is being *measured*, not assumed.

### After content changes

Geometry re-measures on resize automatically, but if you swap the excerpt's text from JS the
box size may not change even though the truncation state did. Keep the handle and ask for a
re-measure:

```typescript
const excerpts = r$.geometry('.excerpt', { truncated: r$.whenTruncated() });
// …after injecting new text:
excerpts.measure();
```

---

## The shape all three share

1. **A predicate is a measurement** — a pure function you can call once, in a console, to see
   what it sees.
2. **`geometry()` maintains it** — the measurement re-runs when it could change, and the
   answer lives on the element as a `data-*` attribute. That attribute is the entire API
   between JS and CSS.
3. **CSS owns the styling** — your stylesheet decides what the fact *looks like*.
4. **Tests read the attribute** — the same thing your CSS keys on is the thing you assert.

Next: [how to test all of this](testing.md) · [every predicate's reference](../api/runtime.md#geometry--state-from-geometry) ·
[the live example](../../examples/landing) that runs case 1 and 2.

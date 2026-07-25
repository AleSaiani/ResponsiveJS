---
layout: home
title: 'Design as functions, not frames'
titleTemplate: 'ResponsiveJS'
---

<div class="band hero">
<div class="pitch">

# Your layout is a function.<br />Treat it like one.

You design at three widths. Users arrive at a thousand. r$ lets you **declare** what happens
in between — and then **measures** whether the browser agreed.

```bash
npm i @responsivejs/runtime      # author it
npx @responsivejs/cli analyze .  # verify it
```

<div class="actions">
    <a class="btn primary" href="/docs/getting-started">Get started</a>
    <a class="btn" href="/demos">Play with it →</a>
</div>

</div>

<div class="visual">

<PlanePlot />

</div>
</div>

<div class="band">

## What you stop doing

<div class="three">
<div class="swap">

**Before** — a number you now own forever

```css
@media (max-width: 843px) {
    .nav { display: none; }
    .burger { display: block; }
}
```

**After** — the browser decides, by measurement

```ts
r$.geometry('.nav', {
    wrapped: r$.whenWraps,
});
```

<p class="why">Add a link, translate to German, change the font: still correct. There is no
number left to maintain.</p>

</div>
<div class="swap">

**Before** — three steps, two visible jumps

```css
.card { padding: 12px }

@media (width >= 768px) {
    .card { padding: 24px }
}
@media (width >= 1024px) {
    .card { padding: 36px }
}
```

**After** — one declaration, no jumps

```ts
r$('.card', {
    padding: r$.fluid(12, 36),
});
```

<p class="why">Linear values compile to a static <code>clamp()</code>: this ships as CSS and
costs <strong>zero JavaScript</strong> at runtime.</p>

</div>
<div class="swap">

**Before** — "looks fine on my screen"

```txt
a screenshot,
reviewed by a human,
at whatever width
their laptop happens to be
```

**After** — a verdict your CI can fail on

```bash
rjs verify home.contract.json https://…
```

<p class="why">Overflow, touch targets, contrast against the background actually painted,
continuity of the curve — at every width, exit-code gated.</p>

</div>
</div>
</div>

<div class="band alt">

## It reads the page back to you

<div class="verdict">
<div>

```
r$ ✗ fail — 2 errors, 1 warning (410 checks)

  noOverflow (1 across 1 element)
    .card[0] @320px — right=496 > viewport=320
      ↳ style at src/cards.ts:12   fluid(240 → 480)

  touchTarget (1 across 1 element)
    .cta[0] @320,375px — 40x22px < 24x24px
      fix: .cta { min-height: 24px }   (exact)
```

</div>
<div class="verdict-note">

Every finding carries **where it was measured**, **by how much**, and — when a runtime
construct owns that element — **which construct, and at which line**. The fix goes to the
cause instead of fighting the cascade.

Fixes are labelled: `exact` ones apply verbatim, `heuristic` ones are a direction, and
`runtime-patch` means *edit the declaration, not the CSS*.

<a class="btn" href="/docs/guides/agents">Built for agents, too →</a>

</div>
</div>
</div>

<div class="band">

## This reacts to the panel, not to your window

<div class="beside">
<div>

<TableToCards />

</div>
<div class="beside-note">

Drag it. Five columns stay a table while they fit and become cards when they don't — and the
switch is a **measurement**, so it survives a longer client name, a wider font, another column
next quarter.

```ts
r$.geometry('.probe', {
    crowded: r$.whenOverflows('x'),
});
```

```css
.wrap[data-crowded] tr {
    display: grid;
    grid-template-areas: 'code total' 'client client' 'date status';
}
```

The subtlety worth stealing: the predicate measures a **probe** that keeps the table's natural
width, never the table it restyles. Measure what you change and it oscillates forever.

<a class="btn" href="/demos">Six more live demos →</a>

</div>
</div>

</div>

<div class="band alt">

## One declaration, whichever framework you're in

<FrameworkDemo />

</div>

<style scoped>
/* one clamp instead of a ladder: the bands keep widening to 4K */
.band { max-width: clamp(60rem, 82vw, 132rem); margin: 0 auto; padding: 2.75rem clamp(1.5rem, 2vw, 3rem); }
.band.alt { background: var(--vp-c-bg-alt); max-width: none; }
.band.alt > * { max-width: clamp(60rem, 82vw, 132rem); margin-inline: auto; }
.band h2 { font-size: clamp(1.4rem, 2.6vw, 2rem); border: 0; margin: 0 0 1.75rem; padding: 0; }

.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 3rem; align-items: center; padding: 2.5rem 1.5rem 1rem; }
@media (max-width: 900px) { .hero { grid-template-columns: minmax(0, 1fr); gap: 2rem; } }
.pitch h1 { font-size: clamp(2rem, 4.4vw, 3.1rem); line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 1rem; }
.pitch > p { font-size: clamp(1rem, 1.5vw, 1.15rem); opacity: .85; max-width: 34rem; }
.actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1.25rem; }
.btn { display: inline-block; padding: .55rem 1.15rem; border-radius: 999px; border: 1px solid var(--vp-c-divider); text-decoration: none; font-weight: 600; }
.btn.primary { background: var(--vp-c-brand-1); color: #fff; border-color: transparent; }

.three { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(19rem, 100%), 1fr)); gap: 2rem; }
.swap p { margin: .35rem 0; }
.why { font-size: .92rem; color: var(--vp-c-text-2); }

.beside { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 2.5rem; align-items: start; }
@media (max-width: 900px) { .beside { grid-template-columns: minmax(0, 1fr); gap: 1rem; } }
.beside-note p { color: var(--vp-c-text-2); }
.beside-note .btn { margin-top: .5rem; }

.verdict { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 2.5rem; align-items: start; }
@media (max-width: 900px) { .verdict { grid-template-columns: minmax(0, 1fr); gap: 1.25rem; } }
.verdict-note p { color: var(--vp-c-text-2); }

.more { margin-top: 1.5rem; }
</style>

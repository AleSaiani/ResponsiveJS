---
layout: home
title: 'Design as functions, not frames'
titleTemplate: 'ResponsiveJS'
---

<div class="hero-plain">

# Your layout is a function.<br />Treat it like one.

Between the three widths you designed for, nobody knows what happens. r$ makes the
in-between **declared** and the result **measured** — for developers and for agents.

<div class="hero-actions">
    <a class="btn primary" href="/docs/getting-started">Get started</a>
    <a class="btn" href="/demos">See it move →</a>
</div>

```bash
npx @responsivejs/cli analyze https://your-site.com -w 320,768,1280
```

</div>

<ResizeMe />

<div class="two-planes">

## Two halves of one model

**Author** what CSS cannot express — then **verify** the rendered result by measurement.
Same lineage (`r$`), same model: `value = f(width)`.

<div class="planes">
<div class="plane">

### Author

```ts
import { r$ } from '@responsivejs/runtime';

r$.tokens({ '--space-m': r$.fluid(16, 24) });   // → clamp(), zero JS
r$.geometry('.nav', { wrapped: r$.whenWraps }); // → data-wrapped, measured
```

A linear value compiles to a static `clamp()` — the browser does the work. JavaScript drives
only what CSS genuinely cannot: curves, colors, **state derived from geometry**, and
relations between elements that container queries cannot reach.

</div>
<div class="plane">

### Verify

```bash
rjs analyze https://your-site.com     # exit 0 pass · 1 violations
rjs audit   https://your-site.com     # a report you can hand to someone
```

Measure the page at every width and judge it: overflow, touch targets, contrast against
*effective* backgrounds, continuity of the measured curve. Machine-readable, exit-code gated,
and every fix declares whether it can be applied verbatim.

</div>
</div>
</div>

<div class="closing">

## The loop closes

Constructs publish what they control, so a violation names **the construct that owns the
element and where it was declared** — an agent patches the cause, not the symptom.

```
noOverflow @320px .card[0] — right=496 > viewport=320
  ↳ style at src/cards.ts:12   fluid(240 → 480)
```

<a class="btn" href="/docs/guides/agents">How agents drive r$ →</a>

</div>

<style scoped>
.hero-plain { max-width: 46rem; margin: 3rem auto 0; padding: 0 1.5rem; }
.hero-plain h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 1rem; }
.hero-plain > p { font-size: clamp(1rem, 2.2vw, 1.25rem); opacity: .85; }
.hero-actions { display: flex; gap: .75rem; flex-wrap: wrap; margin: 1.5rem 0; }
.btn { display: inline-block; padding: .55rem 1.1rem; border-radius: 999px; border: 1px solid var(--vp-c-divider); text-decoration: none; font-weight: 600; }
.btn.primary { background: var(--vp-c-brand-1); color: var(--vp-c-white); border-color: transparent; }
.two-planes, .closing { max-width: 62rem; margin: 4rem auto; padding: 0 1.5rem; }
.planes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr)); gap: 2rem; }
.plane h3 { margin-top: 0; }
.closing pre { background: var(--vp-c-bg-alt); }
</style>

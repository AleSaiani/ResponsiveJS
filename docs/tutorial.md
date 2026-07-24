# Tutorial — from empty page to validated, fluid landing

Build a real page with every core construct, one step at a time. Each step: what you're about
to gain, the code, what actually happened, and a checkpoint you can see. At the end you'll
have written the [landing example](../examples/landing) yourself — *and* pinned it with a
contract so it can never silently regress.

Time: ~30 minutes. Prereqs: Node ≥ 20.19, any bundler (we use vite).

```bash
npm create vite@latest fluid-landing -- --template vanilla-ts
cd fluid-landing && npm i @responsivejs/runtime
```

The page we'll build: a header with logo + nav + (hidden) burger button, a hero, a row of
three cards, a sidebar. Plain HTML — grab the markup from the
[example](../examples/landing/index.html) or write your own with the same class names.

---

## Step 1 — Kill your breakpoints for sizes: fluid tokens

**What you gain:** spacing and type that scale smoothly with the viewport — no `@media`
ladder, no magic numbers, zero runtime JavaScript for the linear cases.

```typescript
// main.ts
import { r$ } from '@responsivejs/runtime';

r$.tokens({
    '--space-s': r$.fluid(8, 12),
    '--space-m': r$.fluid(16, 24),
    '--space-l': r$.fluid(32, 56),
    '--font-body': r$.fluid(15, 18),
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }),
});
```

```css
body    { font-size: var(--font-body); }
.hero h1 { font-size: var(--font-hero); }
.card   { padding: var(--space-m); }
main    { gap: var(--space-l); }
```

**What happened:** every *linear* token compiled to a static `clamp()` on `:root` — open
devtools, look at `<head>`: there's a `<style data-responsivejs>` with
`--space-m: clamp(16px, calc(14.4px + 0.5vw), 24px)`. The browser does all the work. Only
`--font-hero` is JS-maintained, because CSS can't express an exponential curve — that's the
CSS-first contract: **JS only where CSS can't**.

**Checkpoint:** resize the window. Type and spacing flow. There is not a single breakpoint in
what you wrote.

---

## Step 2 — Breakpoints your compiler checks

**What you gain:** where you DO want discrete switches (layout changes regime), the names are
typed — a typo is a compile error, not a production bug.

```typescript
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

r$('.cards', {
    gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)'),
});
```

**What happened:** `as const` lets TypeScript learn your names — try `bp.below('moble', …)`
and watch it fail at compile time. The switch itself emitted a static `@media` block (check
the injected stylesheet again). And `r$.breakpoints` also configured the global domain, so
your Step-1 tokens now span 320→1280.

**Checkpoint:** the cards go 3-up above 768px, stack below it — via CSS the browser runs.

---

## Step 3 — The burger that can't go stale

**What you gain:** the burger appears exactly when the links stop fitting — add a link,
rename one, translate to German: still correct. This is the construct CSS doesn't have.

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```

```css
.site-nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .menu-button { display: block; }
```

**What happened:** `whenWraps` *measures* — "does any child start below the first row?" —
and `geometry()` keeps the answer on the DOM as `data-wrapped`, re-measuring on element and
viewport resize. Your CSS styles the fact. Watch it live: keep devtools on the `<nav>` and
drag the window; the attribute appears at exactly the width where the sixth link would fall
to a second row.

**The one rule** (memorize this one): never `display: none` what a predicate measures —
zeroed child rects would flip the state back and it would oscillate. Collapse *keeping
layout*, as above.

**Checkpoint:** narrow → burger. Wide → links. No number anywhere.

---

## Step 4 — Header effects only while actually pinned

**What you gain:** the sticky-header shadow that CSS can't do (there's no `:stuck` selector)
without the IntersectionObserver-sentinel hack.

```typescript
r$.geometry('.site-header', { stuck: r$.whenStuck() });
```

```css
.site-header { position: sticky; top: 0; }
.site-header[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / 0.12); }
```

**Checkpoint:** scroll down → shadow. Back to top → gone.

---

## Step 5 — Relations CSS can't declare

**What you gain:** cross-element dependencies — the class of layout problems you currently
solve with resize listeners and manual measurement (or don't solve at all).

```typescript
// Equal heading heights across the three cards (different parents — grid can't reach):
r$.sync('.card h3', 'height');

// The tagline's type follows the SIDEBAR's width (container queries only see ancestors):
r$('.hero .tagline', {
    fontSize: r$.fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
});
```

**What happened:** `sync` measures natural heights and applies the max, re-syncing on resize.
`fromElement` swaps the fluid value's *domain*: instead of the viewport, it reads the
sidebar's width signal (one shared ResizeObserver under the hood).

**Checkpoint:** give one card a longer title — all three headings match. Resize so the
sidebar changes width — the tagline follows *it*, not the window.

---

## Step 6 — Point the oracle at it

**What you gain:** measured proof, not visual gut-check. r$'s other half re-measures your
page at many widths and judges it — overflow, touch targets, contrast, continuity.

```bash
npx @responsivejs/cli analyze http://localhost:5173 -w 320,768,1280
```

Exit `0` = pass, `1` = violations, each with the exact element, width, measured numbers, and
— where honest — a machine-applicable fix. And because your page runs the runtime, the report
carries **provenance**: each violation on an element a construct controls names that
construct and its call site. `-f json` gives the whole thing machine-readable.

**Checkpoint:** break something on purpose — set `.card { width: 480px }` — and re-run:
`noOverflow @320px .card[0] — right=496 > viewport=320`, with the owning construct if the
runtime styles it.

---

## Step 7 — Pin it: the contract

**What you gain:** the layout's rules as reviewable JSON that travels with the repo — CI
regression without screenshots, and executable instructions for AI agents.

```jsonc
// landing.contract.json
{
    "name": "landing", "version": 1,
    "viewport": { "widths": [320, 768, 1280] },
    "rules": [
        { "assert": "noOverflow", "description": "nothing bleeds out of the viewport" },
        { "assert": "minSize", "args": { "selector": ".cta", "min": { "height": 44 } },
          "description": "the CTA stays comfortably tappable" }
    ],
    "baselines": [{ "selector": ".hero h1", "prop": "fontSize" }]
}
```

```bash
rjs record landing.contract.json http://localhost:5173   # pins today's hero curve
rjs verify landing.contract.json http://localhost:5173   # 0 = holds; drift exits 1
```

**What happened:** `record` measured the hero's real `fontSize = f(width)` curve and wrote it
into the contract; `verify` re-measures and compares within tolerance. Commit the contract;
wire `rjs verify` into CI; your fluid hero can never silently regress again.

---

## What you built

A page with **zero hand-written breakpoints for sizes**, a nav that adapts by *measurement*,
relations CSS can't express — and a machine-checkable spec proving all of it at every width.
Roughly 25 lines of r$.

Where next: the [pattern catalog](guides/case-studies.md) covers every construct with the
real-world cases this tutorial didn't need · [the runtime guide](guides/runtime.md) explains
the machinery · [the design guide](guides/validation.md) goes deep on the oracle ·
[testing](guides/testing.md) shows how to verify your own usage.

# Example — fluid landing page

A small but real page that uses every M-class construct of `@responsivejs/runtime`. Run it:

```bash
pnpm install
pnpm --filter rjs-example-landing dev     # vite dev server
```

Resize the window and watch: the nav collapses **when it wraps** (not at a magic width), the
header casts a shadow only **while stuck**, spacing and type flow as `clamp()` custom
properties, card headings stay equal-height, and the tagline's size follows the **sidebar's**
width.

Each construct below replaces a specific hack you have probably written.

## 1. The wrap-driven burger — `whenWraps`

**The hack:** a hand-tuned breakpoint (`@media (max-width: 843px)`) that silently rots when a
nav item is added, renamed, or translated into a longer language.

**The construct:** the state is derived from geometry itself —

```ts
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```
```css
.site-nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .menu-button { display: block; }
```

JS detects, CSS styles. There is no width to maintain: adding a seventh link just works.

**The one rule**: never `display: none` what you measure. A `display: none` nav has children
with zero rects, so the predicate flips back and the state oscillates. Collapse while
*keeping layout* instead — `visibility: hidden; height: 0; overflow: hidden` — and the
measurement stays true while the nav is collapsed.

## 2. Shadow only while pinned — `whenStuck`

**The hack:** an IntersectionObserver watching an invisible 1px sentinel above the header.

**The construct:**

```ts
r$.geometry('.site-header', { stuck: r$.whenStuck() });
```
```css
.site-header[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / 0.12); }
```

## 3. The design scale as fluid tokens — `r$.tokens`

**The hack:** clamp() formulas copy-pasted per property, or a Sass function nobody can inspect
in devtools.

**The construct:** one write point, consumed as `var()` everywhere —

```ts
r$.tokens({
    '--space-m': r$.fluid(16, 24),          // → static clamp() on :root, ZERO runtime JS
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }), // JS-driven (CSS can't curve)
});
```

Linear tokens cost nothing at runtime; only the exponential hero size is maintained by JS.
`handle.toDTCG()` exports the whole scale as Design Tokens JSON for your design tooling.

## 4. Equal card headings — `sync`

**The hack:** subgrid (when the layout allows it), or a resize listener measuring and patching
heights with its own stale-value bugs.

**The construct:** `r$.sync('.card h3', 'height')` — max natural height wins, re-measured on
resize, constraint lifted on dispose.

## 5. Type driven by another element — `fromElement`

**The hack:** not feasible in CSS — container queries only look at *ancestors*.

**The construct:** any element's width can be the domain —

```ts
r$('.hero .tagline', {
    fontSize: r$.fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
});
```

## 6. Breakpoint names the compiler checks — `r$.breakpoints`

**The hack:** `'mobile'` strings that throw at runtime when someone types `'moble'`.

**The construct:**

```ts
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);
bp.below('tablet', '1fr', 'repeat(3, 1fr)');   // typo = compile error
```

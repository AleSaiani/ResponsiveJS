# Demos

Every panel below is real: the code shown is the code running, and the values answer to the
**panel's** width, not your browser window. Drag the handle (or focus it and press ←/→).

That last point is the interesting one — these constructs are container-aware, so the same
component behaves correctly in a sidebar, in a modal, and on a phone.

## The menu that has no breakpoint

The problem: you pick `@media (max-width: 843px)` today, someone adds a link tomorrow, and it
rots. The predicate measures whether the links still fit — so the answer stays right when the
content, the font or the language changes.

<ResizeMe />

```ts
r$.geometry('.nav', { wrapped: r$.whenWraps });
```

```css
.nav[data-wrapped]         { visibility: hidden; height: 0; overflow: hidden; }
.nav[data-wrapped] ~ .burger { display: block; }
```

**JS detects, CSS styles.** The runtime never applies the visual change: it maintains a fact
on the DOM and your stylesheet decides what that fact means. (The one rule: never
`display: none` what a predicate measures — collapse *keeping layout*, as above, or the
measurement oscillates.)

## Values that scale instead of stepping

The problem: a spacing ladder with four breakpoints has three visible jumps. A fluid value has
none — and when it is linear, it costs **zero JavaScript**: it compiles to a `clamp()` and the
browser does the work.

<Demo kind="tokens" />

```ts
const panel = { container: true, from: 240, to: 820 };   // ← the panel's range

r$(card, {
    fontSize:     r$.fluid(15, 26, panel),
    padding:      r$.fluid(10, 30, panel),
    borderRadius: r$.fluid(4, 20,  panel),
    boxShadow:    r$.fluid('0 1px 2px rgba(0,0,0,.3)', '0 16px 44px rgba(0,0,0,.16)', panel),
    backgroundColor: r$.fluid('#f4f7ff', '#7aa2ff', panel),
});
```

Colours interpolate in **OKLab**, so a ramp never passes through the muddy grey that plain sRGB
mixing produces. Shadows interpolate structurally — numbers *and* the colour inside them.

::: tip A container fluid must declare its range
`from`/`to` are not decoration above — they are required. A `{ container: true }` value with no
range would interpolate over the **viewport** breakpoints, so a 240–820px panel would walk
barely a fifth of the curve and look broken. Rather than let that happen quietly, r$ refuses to
build the value and prints the line to write. Your container is not the viewport: say how wide
it gets.
:::

## "Read more" only when something was cut

The problem: character-count heuristics break with a different font, width, or language.
Measure the clipping instead.

<Demo kind="truncate" />

```ts
r$.geometry('.excerpt', { truncated: r$.whenTruncated() });
```
```css
.excerpt[data-truncated] + .more { display: inline-block; }
```

## Equal heights across separate containers

The problem: three cards in three containers; grid can't align their inner headings, so the
bodies start at different heights. Measure the tallest, apply it, re-measure on resize.

<Demo kind="sync" />

```ts
r$.sync('.cardlet h4', 'height');
```

## A layout invariant, enforced

The problem: "the sidebar should never take more than 40% or less than 25%" is a rule nobody
checks. `ratio` makes it *hold* — the layout flows freely inside the bounds and is pinned at
them. The same rule, written as a contract, is what CI verifies.

<Demo kind="ratio" />

```ts
r$.ratio('.side', '.main', { min: 0.25, max: 0.4 });
```

## Effects only while actually pinned

The problem: CSS has no `:stuck` selector, so the usual answer is an IntersectionObserver
sentinel element. The predicate just measures.

<Demo kind="stuck" />

```ts
r$.geometry('.head', { stuck: r$.whenStuck() });
```
```css
.head[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / .18); }
```

## Then verify it

Authoring is one half. The other half measures the rendered page at every width and judges it —
overflow, touch targets, contrast against *effective* backgrounds, continuity of the curve:

```bash
npx @responsivejs/cli analyze https://your-site.com -w 320,768,1280
npx @responsivejs/cli audit   https://your-site.com   # a report you can hand to someone
```

This site is measured the same way in CI, against
[its own contract](https://github.com/AleSaiani/ResponsiveJS/blob/main/site/site.contract.json).

→ [Get started](/docs/getting-started) · [the tutorial](/docs/tutorial) ·
[the pattern catalog](/docs/guides/case-studies)

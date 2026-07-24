# Case studies — real cases, end to end

Three complete walkthroughs. Each one shows the *whole* mechanism: the HTML you start from,
what the predicate actually measures, what changes in the DOM (before/after), the CSS that
reacts, and how to verify it. Nothing is assumed — if the [cookbook](runtime-cookbook.md)
recipes feel too compressed, this is the page that unpacks them.

---

## Case 1 — The burger menu (`whenWraps`)

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

## Case 2 — Header effects only while pinned (`whenStuck`)

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

## Case 3 — "Read more" only when truncated (`whenTruncated`)

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

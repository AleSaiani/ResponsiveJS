# Troubleshooting — by symptom

Start from what you are seeing, not from what you think is broken. Every entry names the cause
and the fix; most of these were bugs we shipped ourselves first.

## Authoring

### The value never changes — "the library does nothing"

Almost always a **container-bound value whose range is the viewport's**. `{ container: true }`
changes what is measured, not the range it is measured over, so a card living between 240px and
820px inside a `[320, 1440]` project walked a fifth of its curve. As of `1.0.0-alpha.0` this
is refused at construction:

```
r$: fluid() is bound to its container but never says how wide that container gets,
    so it would interpolate over the viewport breakpoints instead.
    Declare the range: { container: true, from: <narrowest px>, to: <widest px> }
```

Fix: `r$.fluid(15, 26, { container: true, from: 240, to: 820 })`.

If the value is *not* container-bound and still looks frozen, check that the viewport is inside
`[from, to]` — outside the domain a fluid value is clamped, which is correct and looks static.

### An attribute toggles forever, the layout flickers

You are **measuring the element you restyle**. The predicate sets `data-x`, your CSS changes
that element's size, the measurement flips back, forever. Two honest ways out:

- **Collapse keeping layout**: `visibility: hidden; height: 0; overflow: hidden` — never
  `display: none` on what a predicate measures.
- **Measure a probe**: keep a hidden element with the natural dimensions, never restyled, and
  measure that. The table-to-cards demo on the site does exactly this.

Corollary that bites in components: styling the measured element's *children* counts too.
Making pills `flex: 1 1 100%` when their row wraps means they will wrap forever and never come
back — a latch, not an oscillation, and harder to spot. Style something the measurement does
not depend on (`:has()` is useful here).

### A predicate is never true

- `whenWraps` needs **at least two children**; with one it is always `false` by definition.
- `whenTruncated` needs an axis that is actually clipped — `overflow: hidden` or `clip` plus
  content that exceeds it. Without the clipping there is nothing to detect.
- Anything on a `display: none` element measures a zero box and never fires.
- `whenStuck` needs `position: sticky` and a `top`/`bottom` offset to be pinned against.

### Styles vanish after a re-render

The construct was bound to elements that no longer exist. In a component, group the handles and
dispose them with the component:

```typescript
const s = r$.scope();
s.add(r$('.card', { padding: r$.fluid(12, 28) }));
onUnmount(() => s.dispose());
```

For a selector that must keep matching elements as they come and go, use `r$.observe(selector,
map)` — it injects the static half once and manages the JS half per element.

### Server-rendered values are wrong until hydration

The CSS-first half is fully server-renderable — `r$.static(selector, map)` gives you the
stylesheet. The JS half resolves at `config.ssrWidth` until the first client effect, so if a
value matters above the fold, keep it linear so it compiles to `clamp()` and never needs JS.

## The CLI

### "no driver available"

```bash
npx @responsivejs/cli doctor
```

One line per check — Node version, Playwright and its Chromium, agent-browser on `PATH` — with
the exact install command for anything missing, and which driver `auto` will pick. Exit `0`
means at least one driver is usable.

### It passed, but the count says 794/799

Those five are **warnings, not failures**. `pass` means zero *errors*; warnings are things
worth a look that do not break the build (content that overflows inside a scroll container, for
instance). Use `--strict` to fail on them too.

### The contract fails after a design change you meant to make

That is the baseline doing its job: a curve moved. If the change is intended, re-pin it and
commit the diff —

```bash
npx @responsivejs/cli record site.contract.json https://your-site.com
```

— so the new curve is reviewed rather than silently accepted. Do not delete the baseline.

### A rule reports nothing at all

Check the selector matches: a contract whose sweep found no elements would "pass" while
measuring nothing, so r$ fails loudly instead (`a run that performed zero checks`). In
component-scoped stylesheets — CSS modules, Tailwind hashes — prefer stable hooks
(`data-testid`, roles, landmarks) over generated class names.

### The page clearly scrolls sideways but nothing is reported

Fixed in `1.0.0-alpha.0`: the check now compares the document's own horizontal reach against
the viewport, which catches content overflowing *inside* a box whose rect looks fine. If you
are on an earlier build, upgrade.

## Verification results you disagree with

### A contrast violation on something invisible

Elements that are present but not visible in the resting state — `sr-only` clips, `opacity: 0`,
1×1 absolutes — are excluded from contrast and touch-target checks. If you see one reported,
the element is probably visible in a way you did not intend; check it in the browser first.

### A touch-target violation on a link inside a paragraph

WCAG 2.5.8 exempts links flowing inline in prose, and so do we. If one is still reported, the
link is not inline in text — it is a block-level element that happens to be short.

### A contrast pass you do not believe

Contrast is composited against the background **actually painted** behind the element, walking
up through semi-transparent layers. That is deliberately stricter than comparing against the
declared `background-color`, and it is where naive checks report a pass they should not.

## Tests

### Geometry assertions fail in unit tests

happy-dom and jsdom have no layout: every rect is zero, so `whenWraps` and friends cannot work
there. Unit-test the declarations (what the style map contains, what the stylesheet emits) and
put anything that needs real layout in a browser test. See the
[testing guide](guides/testing.md).

---

Still stuck? Open an issue with the output of `npx @responsivejs/cli doctor` and, if it is a
measurement you disagree with, the JSON report (`-f json`) — it carries the measured numbers,
so the disagreement is about facts rather than impressions.

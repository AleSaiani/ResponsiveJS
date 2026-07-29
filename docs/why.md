# Why r$ — and when not to

The honest version, because you are going to ask anyway.

## "I can write `clamp()` myself"

You can, and for a heading or two you should. r$ compiles a linear `fluid()` to exactly the
`clamp()` you would have written — same Utopia formula, no runtime cost. The reason to declare
it instead of typing it:

- **It answers to a container, not only the viewport.** `{ container: true, from, to }` emits
  `cqi` and the same card is correct in a sidebar, a modal and a phone.
- **It is one declaration, not a scale copied into thirty files.** `r$.tokens` puts the whole
  system in one place and everything downstream reads `var()`.
- **It is machine-readable.** The declaration publishes what it promises, so the other half of
  r$ can check the browser kept that promise, and a report can name *which line* owns a
  violating element. A hand-written `clamp()` tells no-one anything.

If none of those apply to you, write `clamp()`. We would.

## "CSS has container queries now"

It does, and r$ emits `cqi` because of it — container queries made the CSS-first half better,
not redundant. What they still cannot answer:

- *Do these links fit on one row?* — that depends on the children, not on the container.
- *Was this text actually clipped?* — that depends on the rendered glyphs.
- *Is this sticky header currently pinned?* — there is no `:stuck`.
- *Is element A's width inside 25–40% of element B's, where B is not an ancestor?*

Those are measurements, and measurements are what the JS half exists for. Everything else
stays in CSS on purpose.

## "We already have visual regression testing"

Percy, Chromatic and friends answer a different question: *did this change?* They diff pixels
against an approved baseline, and a human decides. That is valuable and orthogonal.

r$ answers *is this wrong?* — with rules that hold at any width, on a page nobody has ever
approved: nothing overflows, targets clear 24px, contrast clears AA against the background
actually painted, a curve never reverses. No baseline to approve, no human in the loop, and a
new page is covered the day it is written. Where a visual diff says "37 screenshots changed",
r$ says "`.cta` is 40×22 at 320px, the WCAG floor is 24×24, here is the fix".

Use both. They fail on different days.

## "axe already checks accessibility"

axe is excellent and r$ runs it for you when it is installed — `analyze` merges its findings.
What r$ adds is the **width sweep and the geometry**: axe checks the DOM as rendered *right
now*, at whatever width the browser happens to be. Touch targets and contrast are properties
of a rendered layout, and layouts change with width. A button that clears 24px on your laptop
can be 40×22 at 320px, and that is exactly the width nobody tested.

r$ also composites contrast against the background *actually painted* behind an element —
semi-transparent chips over a gradient included — which is where naive checks report a pass
they should not.

## "It is another dependency"

The authoring half is optional: you can adopt r$ **without installing anything**, by pointing
the CLI at a URL and committing the contract it generates. That path adds a devDependency to
CI and nothing to your bundle.

If you do author with it: the runtime is ~15.5 kB gzipped as a standalone bundle, and the
common case — linear fluid values — compiles to CSS and ships **zero JavaScript**. What stays
in JS is only what CSS cannot express.

## When not to use it

- **A one-page site you will not touch again.** The gate has no regressions to catch.
- **You have no CI.** Half the value is an exit code nobody will run.
- **A native app, or anything not rendered by a browser.** The oracle measures a real DOM.
- **You need pixel-perfect visual approval.** That is a visual diff tool's job, not ours.

## Where it earns its place

A design system or component library, where a layout regression is invisible until a customer
finds it. A team with CI discipline and no time for manual width-by-width review. And any
codebase where part of the CSS is written by an agent — an agent cannot look at a screenshot
and tell that it is crooked, but it can read an exit code and a measured number.

→ Convinced enough to try? [Measure a page you already have](getting-started.md) — no install,
about a minute.

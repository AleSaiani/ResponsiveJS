---
name: responsive-authoring
description: Express responsive behavior with ResponsiveJS (r$) instead of media queries — fluid values, geometry predicates, container-bound components. Use when writing or refactoring responsive CSS/JS, when a breakpoint number is being chosen, or when a layout must react to content it cannot know in advance.
---

# Authoring with r$

The model is one sentence: **a responsive value is a function of width**, and a layout decision
should come from a *measurement*, not from a number someone guessed.

Two rules decide almost every case:

1. **If CSS can express it, emit CSS.** A linear fluid value compiles to a static `clamp()` and
   ships with zero runtime JavaScript. Only reach for the JS half when the answer depends on
   something CSS cannot see (whether content wraps, whether text was truncated, whether a
   sticky element is currently pinned, how two separate subtrees compare).
2. **JS states a fact; CSS decides what it means.** Predicates write a data attribute
   (`data-wrapped`), never a style. Your stylesheet owns the appearance.

## Choosing the construct

| The intent | Write |
| --- | --- |
| A value scales smoothly between two widths | `r$.fluid(min, max)` |
| …and should follow the element's container | `r$.fluid(min, max, { container: true, from, to })` |
| A per-breakpoint ladder you actually want | `r$.fluid([a, b, c])` |
| Collapse when children stop fitting on one row | `r$.geometry(el, { wrapped: r$.whenWraps })` |
| Content exceeds its box on an axis | `r$.whenOverflows('x' \| 'y' \| 'both')` |
| Text was really clipped (not "probably too long") | `r$.whenTruncated()` |
| A `position: sticky` element is currently pinned | `r$.whenStuck()` |
| Two elements would touch | `r$.whenCollides(other)` |
| Equal heights across separate containers | `r$.sync(selector, 'height')` |
| A proportion that must hold between two elements | `r$.ratio(a, b, { min, max })` |
| A whole scale, once, for everything downstream | `r$.tokens({ … })` |

Anything not in the table can be a custom predicate — `{ name, measure(el) }` is the whole
interface.

## The three traps

**Never measure what you restyle.** If a predicate measures an element and the resulting CSS
changes that element's size, the measurement flips back and the layout oscillates forever.
Measure a *probe* that keeps the natural dimensions and is never restyled, or collapse in a way
that preserves layout (`visibility: hidden; height: 0`, never `display: none`).

**A container fluid still needs its range.** `{ container: true }` changes *what is measured*,
not the domain: without `from`/`to` the value interpolates over the project's viewport
breakpoints, so a card that lives between 240px and 820px walks a fifth of its own curve and
looks broken.

```ts
const panel = { container: true, from: 240, to: 820 };
r$('.card', { fontSize: r$.fluid(15, 26, panel), padding: r$.fluid(10, 30, panel) });
```

**Every construct owns something and must be released.** Handles return `dispose()`, which
restores pre-existing inline values and attributes and drops the injected stylesheet. In a
component, group them: `const s = r$.scope(); s.add(…); onUnmount(() => s.dispose())`.

## Framework hosts

`@responsivejs/react` (`useResponsive`, `useGeometry`), `@responsivejs/vue` (composables plus a
`v-responsive` directive) and `@responsivejs/angular` (`injectResponsive` and `create*` twins)
only handle the lifecycle. The declaration is identical in all of them, and values
(`r$.fluid`, `r$.whenWraps`) are imported from `@responsivejs/runtime` directly — the adapters
never wrap them.

## Before you finish

A responsive change is not done until it has been measured at more than one width. Hand off to
the `responsive-verification` skill, or minimally:

```bash
npx @responsivejs/cli analyze <url> -w 320,768,1280,1920
```

Full reference: https://responsivejs.com/llms.txt

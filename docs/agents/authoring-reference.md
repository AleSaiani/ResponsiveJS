# Agent reference — authoring with @responsivejs/runtime

Compact rules + exact signatures for writing runtime code. Human-oriented docs:
[runtime cookbook](../guides/runtime-cookbook.md) · [runtime API](../api/runtime.md).

## Invariants — always hold these

1. **CSS-first**: prefer constructs that compile to static CSS (linear `fluid`, `breakpoint.*`,
   `tokens`). JS drives only what CSS cannot (curves, geometry, cross-element, logic).
2. **Never `display: none` an element a geometry predicate measures** — zeroed child rects flip
   the predicate and the state oscillates. Collapse keeping layout:
   `visibility: hidden; height: 0; overflow: hidden`.
3. **JS detects, CSS styles**: predicates set data-attributes; put the styling in the
   stylesheet (`.nav[data-wrapped] { … }`), never in JS.
4. **Keep handles, dispose on unmount**: every construct returns a handle;
   `handle.dispose()` removes everything it did (effects, observers, CSS, attributes).
5. **Prefer `tokens()` over per-element styles** for design-scale values: one write point on
   `:root`, consumed as `var()`.
6. SSR: all constructs are inert without `window`; ship `responsive.static()` / `tokens().css`.

## Signatures

```typescript
// Apply styles (CSS-first split on selector targets)
responsive(target, map): ResponsiveHandle          // target: selector | Element | Element[]
responsive.dynamic(target, map)                    // force JS path
responsive.static(selector, map): string           // CSS only; throws if JS needed
responsive.flush()                                 // drain pending writes (tests)

// Values
fluid(min, max, unit? | { curve?, unit?, container?, from?, to?, domain? })
fluid([8, 16, 24, 32], opts?)                      // per-breakpoint segments
fluid('#f00', '#00f')                              // OKLab color mix (JS)
when(pred, a, b?) · whenInRange(min, max, v, else?)
breakpoint.below(ref, a, b?) · .above · .between(lo, hi, a, b?) · .match({name: value})

// Typed breakpoints (returns API typed on YOUR names; typo = compile error)
const bp = defineBreakpoints({ mobile: 320, tablet: 768 } as const);
bp.below('tablet', a, b?) · bp.above · bp.between · bp.match({...}) · bp.width(name)
bp.matches(name): { signal, dispose } · bp.names

// Tokens (fluid custom properties on :root)
const t = responsive.tokens({ '--space-m': fluid(16, 24) });
t.css            // static stylesheet (SSR)
t.dynamic        // names that stay JS-driven
t.toDTCG()       // Design-Tokens JSON, curves sampled
t.dispose()

// Geometry predicates → data-attributes
geometry(target, { stateName: predicate }, { prefix? }): GeometryHandle
whenWraps() · whenOverflows('x'|'y'|'both'?) · whenTruncated() · whenStuck()
linesOf()  /* number → data-lines="3" */ · whenCollides(otherSelectorOrElement)
predicate.measure(el)                              // pure one-shot, no reactivity
handle.measure() · handle.pause() · handle.resume() · handle.dispose()

// Cross-element
fromElement(target)                                 // fluid domain: follows THAT element's width
sync(target, 'height'|'width'): { measure, dispose }   // equalize across containers
ratio(a, b, { min?, max? }): { measure, dispose }      // enforce width ratio on a

// Reactivity (TC39-shaped, zero-dep)
state(v) · computed(fn) · effect(fn): dispose · subscribe(sig, cb) · batch(fn) · untrack(fn)
viewportWidth() · containerWidth(el) · elementSize(el) · mediaQuery(q) · scrollTick()
```

## Choosing the construct

| Need | Use | NOT |
| --- | --- | --- |
| Value scales with viewport | `fluid(min, max)` in `tokens()` | resize listeners |
| Value scales with own container | `fluid(…, { container: true })` | ancestor queries in JS |
| Value follows ANOTHER element | `fluid(…, { domain: fromElement(sel) })` | polling rects |
| Nav collapses when it stops fitting | `geometry + whenWraps` | a magic `@media` px |
| Style while sticky is pinned | `geometry + whenStuck` | IO sentinel hack |
| "Show more" when clamped | `geometry + whenTruncated` | char-count heuristics |
| Equal heights, different parents | `sync(sel, 'height')` | manual measure loops |
| Sidebar/main ratio guarantee | `ratio(a, b, bounds)` | hoping the CSS holds |
| Named responsive switches | `defineBreakpoints(...as const)` + `bp.*` | string names |

## Minimal correct pattern

```typescript
import { responsive, fluid, geometry, whenWraps, defineBreakpoints } from '@responsivejs/runtime';

const bp = defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);
const tokens = responsive.tokens({ '--space-m': fluid(16, 24), '--font-hero': fluid(28, 56) });
const nav = geometry('.site-nav', { wrapped: whenWraps });
const grid = responsive('.cards', { gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)') });

// on unmount:
for (const h of [tokens, nav, grid]) h.dispose();
```

Validate what you authored: `rjs analyze <url>` — see the
[validation reference](validation-reference.md).

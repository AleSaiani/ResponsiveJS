# Concepts — the model in practice

One idea holds the whole lineage together: **the screen is a parametric Cartesian plane**, and
every layout property is a **function of width** — viewport or container.

```
value = f(width)
```

Everything else is one of three uses of that function:

| Use          | Package                | You provide            | You get                        |
| ------------ | ---------------------- | ---------------------- | ------------------------------ |
| **Author**   | `@responsivejs/runtime`| control points + curve | a reactive value / static CSS  |
| **Measure**  | `@responsivejs/design` | a real page            | curves, violations, scores     |
| **Contract** | `@responsivejs/contract`| expectations          | a verifiable, serializable spec|

## The Curve

`Curve = Map<width, value>` — the shared currency. The **analysis half**
(`@responsivejs/core/curve`) asks questions about measured curves: `isMonotonicUp`, `maxJump`,
`discontinuities`, `valueRange`. The **authoring half** (`@responsivejs/core/interpolate`) goes
the other way: control points + interpolation mode → a callable `f(width)`; `sample(f)` turns it
back into a Curve, closing the loop.

```typescript
import { linear, sample } from '@responsivejs/core/interpolate';
import { isMonotonicUp } from '@responsivejs/core/curve';

const f = linear(16, 32, { min: 320, max: 1920 });
isMonotonicUp(sample(f)); // true — author, sample, verify
```

## The Snapshot model

Measurement produces one shape everywhere, regardless of driver:

- **`ElementSnapshot`** — an element at one width: full `Rect` (with derived `right/bottom/
  center/area`), numeric `styles` (font, paddings, margins, radii, z-index…), string `computed`
  (display, colors, overflow…).
- **`ViewportSnapshot`** — all matched elements + parent/child relations at one width.
- **`SnapshotStore`** — snapshots across all measured widths. Query it with `StoreQuery`
  (`at(width)`, `curve(selector, prop)`).

The store is the seam of the whole system: constraints, scores, `analyze()`, and
`verifyContract()` all consume a `SnapshotStore` and don't care where it came from.

## MeasurementSource — drivers are plugins

A driver only needs to set a viewport, measure, and (optionally) evaluate a JS string:

```
browser-native  (zero-driver: the collector runs in-page)
Playwright      (CI — PlaywrightSource)
CDP             (any {send} client — CdpSource; agent-browser, chrome-remote-interface)
```

One in-page collector (`collectPage`) is injected everywhere via `Function.prototype.toString()`,
so all drivers measure identically. The `evaluate` seam is also how axe is injected — a11y works
on every driver, not just Playwright.

## The oracle

`analyze()` merges four judgments into one machine-readable `UnifiedReport`:

1. **Geometry/responsive constraints** — ~27 checks (`noOverflow`, `monotonic`, `touchTarget`…),
   each with a structured `fix` where honest.
2. **Deterministic WCAG contrast** — computed from measured colors (axe's `color-contrast` is
   deliberately disabled: it false-positives on gradients/translucency).
3. **axe** — the rest of WCAG A/AA, when `axe-core` is installed.
4. **Aesthetic score** — 17 metrics (Ngo/Teo/Byrne 2003 + Birkhoff 1933): balance, symmetry,
   rhythm, density, unity…

Severity semantics: `pass` fails only on `error`; `clean` demands zero violations of any kind.

## CSS-first (the authoring rule)

Where CSS can express the function, the runtime **emits CSS and gets out of the way**:

| Value                              | Output                                        |
| ---------------------------------- | --------------------------------------------- |
| `fluid(16, 32)` (linear)           | `clamp(16px, calc(12.8px + 1vw), 32px)`       |
| `fluid([8, 16, 24])`               | per-segment clamps in `@media` blocks         |
| `breakpoint.below/above/match`     | `@media (min-width: …)` blocks                |
| `fluid(16, 32, { container: true, from: 240, to: 820 })` | `clamp(…, … cqi, …)`                        |
| non-linear, colors, strings, lambdas | JavaScript (signals + one rAF write/frame)  |

JavaScript is the fallback, never the default.

## Contracts

A contract freezes intent into data: rules (constraint + args + width range + severity +
authored description), score thresholds, and recorded baselines (`curve` per selector/prop with
tolerance). The registry of 27 constraints is the single source of truth for the TS types, the
validator, the published JSON Schema, and the dispatch onto the engine — a sync test keeps it
honest. Design-system profiles (`material-design-3`, `apple-hig`, …) are rule generators: a
profile embedded in a contract expands to `ds.*` rules at verify time.

## Reactivity (runtime internals)

A minimal internal signal engine, shaped on TC39 Signals (`{get}` / `{get,set}`): pull-based lazy
computeds, equality-gated writes, effects deduped per microtask, and **disposal that removes
every graph edge** — no listener outlives its consumer. One resize listener, one shared
ResizeObserver, refcounted matchMedia — the width hubs are singletons, everything downstream is
derived.

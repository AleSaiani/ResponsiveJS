# API — @responsivejs/core

Pure math, zero dependencies, browser-safe. Every module is a subpath export
(`@responsivejs/core/rect`, …); the root re-exports the data-model types flat and the math
modules as namespaces (`import { rect, curve } from '@responsivejs/core'`).

## `/rect` — geometry

```typescript
interface Rect { x; y; width; height; right; bottom; centerX; centerY; area }
```

| Function | Meaning |
| --- | --- |
| `rect(x, y, w, h): Rect` | Build a Rect with derived fields. |
| `fromDOMRect({x,y,width,height}): Rect` | From a DOMRect-like. |
| `contains(parent, child, tolerance=1)` | Child inside parent. |
| `overlaps(a, b)` / `overlapsVertically(a, b)` | Intersection tests. |
| `distance(a, b)` | Center-to-center distance. |
| `horizontalGap(a, b)` / `verticalGap(a, b)` | Edge-to-edge gaps. |
| `sameHeight(a, b, tol=2)` / `sameWidth(a, b, tol=2)` | Dimension equality. |
| `alignedLeft(a, b, tol=1)` / `alignedTop(a, b, tol=1)` | Edge alignment. |
| `inViewport(r, vw, vh?)` | Fully inside the viewport. |
| `widthRatio(a, b)` | `a.width / b.width`. |

## `/curve` — analysis of measured curves

`Curve = Map<number, number>` (width → value).

| Function | Meaning |
| --- | --- |
| `entries(curve)` | Sorted `[width, value][]`. |
| `isMonotonicUp(curve, tol=0.5)` / `isMonotonicDown` | Never moves against the direction. |
| `maxJump(curve)` | Largest step between adjacent widths. |
| `isContinuous(curve, maxAllowed)` | No jump exceeds the bound. |
| `discontinuities(curve, threshold)` | Every jump above the threshold. |
| `valueRange(curve)` | `{ min, max, range }`. |
| `ratio(a, b)` / `ratioInRange(a, b, min, max)` | Pointwise ratio of two curves. |

## `/interpolate` — authoring (the inverse of `/curve`)

```typescript
type WidthFn = (width: number) => number;
interface Domain { min: number; max: number }        // values clamp outside it
type Bezier = [x1, y1, x2, y2];
type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
```

| Function | Meaning |
| --- | --- |
| `linear(min, max, domain): WidthFn` | Straight interpolation. |
| `exponential(min, max, domain, base=4)` | Slow start, fast finish — normalized easing on t (zero-safe endpoints). |
| `logarithmic(min, max, domain, base=4)` | Fast start, slow finish — exact inverse of `exponential`. |
| `eased(min, max, easing, domain)` | Named CSS easing or custom bezier. |
| `cubicBezier(bezier): (t) => number` | Solve a CSS cubic-bezier (Newton + bisection, ~1e-6). |
| `stepped(values, breakpoints)` | Discrete switch, right-open intervals. |
| `piecewise(points, easing?)` | Multi-segment through `[width, value]` control points. |
| `sample(f, widths=DEFAULT_WIDTHS): Curve` | Bridge back to the analysis half. |
| `inverse(f, value, domain): number \| undefined` | Which width produces the value (monotone f only). |
| `progress(width, domain)` | Clamped 0..1 position in the domain. |
| `EASINGS` | The CSS-spec control points per easing name. |

## `/color` — parsing, WCAG, OKLab

| Function | Meaning |
| --- | --- |
| `parseColor(css): RGBA` | hex (3/6/8), `rgb()`/`rgba()` (comma + modern), `hsl()`, `oklch()`, `transparent`. Fallback: opaque black. |
| `relativeLuminance(rgba)` | WCAG 2.1 relative luminance. |
| `contrastRatio(fg, bg): number` | 1–21, alpha-blended. |
| `meetsAA(ratio, largeText=false)` / `meetsAAA` | 4.5/3 and 7/4.5 thresholds. |
| `rgbaToOklab(rgba): OKLab` / `oklabToRgba(oklab): RGBA` | Björn Ottosson's matrices; out-of-gamut clamped per channel. |
| `mixOklab(a, b, t): RGBA` | Perceptual mix (what the runtime uses for color fluid). |
| `formatRgb(rgba): string` | Modern `rgb(r g b / a)` emission. |

## `/typography` — modular scales

| Export | Meaning |
| --- | --- |
| `SCALES` | Named ratios: `minorSecond` 1.067 … `goldenRatio` 1.618. |
| `detectScale(sizes)` | Best-fit `{ base, ratio, name }` for measured font sizes. |
| `fitsScale(sizes, tolerance=0.05)` | Do the sizes fit any known scale? |
| `usesTokens(values, tokens, tolerance=1)` | Are values drawn from a token set? `{ valid, outliers }`. |

## `/aesthetics` — the 17-metric score

`score(input, weights?)` accepts `ScoreInput` (`{ rects, viewport, colors?, fontSizes? }`) and
returns an `AestheticScore` with 15 weighted metrics (`balance`, `equilibrium`, `symmetry`,
`proportion`, `rhythm`, `density`, `regularity`, `simplicity`, `unity`, `homogeneity`,
`sequence`, `cohesion`, `economy`, `colorHarmony`, `typographyHarmony`), plus `birkhoff` and the
weighted `overall` — all 0..1. Each metric is also exported as a standalone function. Grounded in
Ngo, Teo & Byrne (2003), *Modelling interface aesthetics*, and Birkhoff (1933), *Aesthetic Measure*.

## `/types` — the data model

`ElementSnapshot` (selector, index, `Rect`, numeric `styles`, string `computed`) ·
`ViewportSnapshot` (one width) · `SnapshotStore` (all widths) · `Violation` (rule, element,
width, detail, expected/actual, severity, suggestion, `fix`) · `FixSuggestion`
(`{ selector, property, value, reason }`) · `Report` · `SweepOptions` · `InteractionSnapshot` ·
`DEFAULT_WIDTHS` = `[320, 375, 390, 768, 1024, 1280, 1440, 1920, 2560]`.

## `/snapshot` — querying stores

```typescript
const q = new StoreQuery(store);
q.at(1280).rect('h1');                  // Rect | undefined
q.at(1280).style('h1', 'fontSize');     // number | undefined
q.at(1280).elements('.card');           // ElementSnapshot[]
q.curve('h1', 'fontSize');              // Curve across widths (styles or x/y/width/height)
q.rectCurve('h1', 'right');             // Curve over any Rect field
q.computedCurve('h1', 'color');         // Map<width, string>
```

`WidthQuery` (returned by `at()`): `element`, `elements`, `rect`, `rects`, `style`, `children`,
`childRelation`, `computedProp`, `allRects`.

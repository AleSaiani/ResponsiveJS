# @responsivejs/core

> The shared math of [`r$`](https://github.com/AleSaiani/ResponsiveJS): everything is a function of
> width — `value = f(width)`.

Pure, zero-dependency, browser-safe. This package holds the mathematical layer the whole `r$`
lineage builds on: geometry, curves, statistics, color, typography, aesthetics, and the snapshot
data model.

```bash
npm install @responsivejs/core
```

## Modules

| Subpath                          | Contents                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `@responsivejs/core/rect`        | `Rect` + geometry: `contains`, `overlaps`, `sameHeight`, `inViewport`, gaps…      |
| `@responsivejs/core/curve`       | `Curve = Map<width, value>`: `isMonotonicUp/Down`, `maxJump`, `discontinuities`…  |
| `@responsivejs/core/stats`       | `mean`, `stddev`, `cv`, `isUniform`, `gaps`…                                      |
| `@responsivejs/core/color`       | WCAG: `contrastRatio`, `meetsAA`, `meetsAAA`, color parsing.                      |
| `@responsivejs/core/typography`  | Modular scales: `detectScale`, `fitsScale`, `usesTokens`.                         |
| `@responsivejs/core/aesthetics`  | The 17-metric aesthetic score (Ngo/Birkhoff): `balance`, `symmetry`, `rhythm`…    |
| `@responsivejs/core/types`       | The data model: `ElementSnapshot`, `SnapshotStore`, `Violation`, `Report`…        |
| `@responsivejs/core/snapshot`    | `StoreQuery`/`WidthQuery` — query and curve builders over snapshots.              |

Everything is also re-exported from the package root (`import { rect, curve } from '@responsivejs/core'`).

## Example

```typescript
import { rect, contains } from '@responsivejs/core/rect';
import { isMonotonicUp } from '@responsivejs/core/curve';
import { contrastRatio, meetsAA } from '@responsivejs/core/color';

contains(rect(0, 0, 1280, 800), rect(20, 20, 300, 100)); // → true
isMonotonicUp(new Map([[320, 16], [768, 18], [1280, 24]])); // → true
meetsAA(contrastRatio('#333', '#fff'), 16, 400); // → true
```

Licensed under [MPL-2.0](LICENSE).

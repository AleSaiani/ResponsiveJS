# API — @responsivejs/design

The validation oracle. Peers (both optional): `@playwright/test` (only the driver needs it),
`axe-core` (only a11y needs it). The `/browser` subpath is driver-free by construction.

## `r$(page)` — the Playwright validator

```typescript
const r = r$(page);                       // ResponsiveValidator
await r.sweep({ url, selectors, widths | from/to/step, height?, scroll?, scrollSteps? });
```

| Member | Meaning |
| --- | --- |
| `r.at(width)` | `WidthQuery` at a measured width (`rect`, `style`, `elements`…). |
| `r.curve(sel, prop)` / `r.rectCurve(sel, prop)` | Property curve across widths. |
| `r.assert` | The `Asserter` (chainable constraints, below). |
| `r.score(parentSelector?)` | `ScoreResult` — 17-metric aesthetics, whole page or subtree. |
| `r.report()` | Constraint `Report`. |
| `r.analyze(opts?)` | The full oracle → `UnifiedReport` (reuses the sweep). |
| `r.log('console' \| 'json' \| 'compact')` | Print the report. |
| `r.resweep({ widths?, selectors? })` | Incremental re-measure, merged. |
| `r.validateDesignSystem(ds, selectors?)` | Apply a DS profile's constraints. |
| `r.measureInteraction(sel)` | Normal/hover/focus snapshots. |
| `r.widths` / `r.raw` | Measured widths / the `SnapshotStore`. |
| `ResponsiveValidator.live(page, { selectors })` | A `LiveValidator` (below). |

## The `Asserter` — 27 chainable constraints

Every check runs at **all** measured widths; violations carry structured `fix` suggestions where
honest. `new Asserter(store)` works on any store (no Playwright).

`noOverflow()` · `contains(parent, child)` · `sameHeight(a, b, tol?)` · `sameLine(a, b)` ·
`minSize(sel, { width?, height? })` · `gapUniform(sel, threshold?)` ·
`monotonic(sel, prop, dir?)` · `continuous(sel, prop, maxJump)` · `proportion(a, b, { min, max })`
· `childrenContained(sel, tol?)` · `childrenEqualWidth(sel, tol?)` · `noZeroHeight(sel)` ·
`touchTarget(sel, min?)` (default 24 = WCAG 2.5.8 AA floor; platform guidance 44–48;
interactive = DOM semantics — native controls/roles/tabindex — or cursor:pointer; inline
targets in prose exempt; unrendered skipped) · `textReadable(sel)` · `contrastRatio(sel, 'AA' | 'AAA')` ·
`borderRadiusValid(sel)` · `zStackOrder(selectors)` · `typographyScale(sel)` ·
`spacingTokens(sel, tokens)` · `aspectRatio(sel, ratio, tol?)` · `focusVisible(sel)` ·
`noHiddenOverflow(sel)` · `alignedToGrid(sel, gridSize)` · `breakpointSafe(breakpoints)` ·
`interactiveSpacing(sel, minGap?)` · `visible(sel)` · `hidden(sel)` — then `report()` / `reset()`.

## `analyze()` — the unified oracle

```typescript
analyze(opts: AnalyzeOptions): Promise<UnifiedReport>
analyzeStore(store, opts?): UnifiedReport          // sync, pure — also on /browser
```

`AnalyzeOptions`: `source` (a `MeasurementSource`) and/or `store` (pre-measured); sweep params
(`url`, `selectors`, `widths`/`from`/`to`/`step`, `height`, `scroll`); `constraints` (config
object or `(assert) => void` escape hatch); `designSystem`; `score` (`{ subtree? } | false`);
`a11y` (`A11yOptions | false`).

Default constraint set (low false-positive): `noOverflow` + `contrastRatio AA` + `touchTarget`
on every analyzed selector. `ConstraintsConfig` toggles each and adds `textReadable`,
`focusVisible`, or anything via `custom(assert)`.

**`UnifiedReport`** extends `Report` with: `clean` (zero violations of any kind — `pass` fails
only on `error` severity), `scores`, `fixes` (`FixSuggestion[]` — only `kind: 'exact'`
entries, deduped by selector+property across widths: the apply-verbatim agent surface),
`widths`, `url`, `sources` (`{ measurement, a11y: 'axe' | 'skipped' | 'unavailable' }`),
`summary` (`errors/warnings/info`, `byRule`, `byWidth`), `durationMs`.

**a11y degradation**: omitted + axe installed → runs; omitted + missing → `'unavailable'`
(silent); explicitly configured + missing → **throws**; no evaluate seam or `a11y: false` →
`'skipped'`. Axe rules are namespaced `axe:<id>`; impact maps critical/serious → error,
moderate → warning, minor → info. `color-contrast` is always disabled (delegated to the
deterministic constraint). `A11yOptions`: `wcagTags`, `disableRules`, `widths: number[] | 'all'`
(default `[min, max]`), `include`, `exclude`.

`mergeReports(base, ...extra)` folds additional plain `Report`s (e.g. a theme token gate) into
one unified report.

## `MeasurementSource` — drivers

```typescript
interface MeasurementSource {
    kind: string;
    open?(url): Promise<void>;
    setViewport(width, height): Promise<void>;
    measure(selectors): Promise<ViewportSnapshot>;
    evaluate?<T>(expression: string): Promise<T>;   // string-only (CDP-compatible)
    close?(): Promise<void>;
}
```

- **`PlaywrightSource(page, { settleMs? })`** — the CI driver.
- **`CdpSource(client, { height?, settleMs?, loadTimeoutMs? })`** — takes any structural
  `{ send(method, params) }` (chrome-remote-interface, Playwright `CDPSession`, agent-browser).
  Measures by injecting the collector via `Runtime.evaluate` (`returnByValue` + `awaitPromise`).
- **`EvalSource(evalFn, { setViewport?, open?, settleMs?, widthTolerance? })`** — the
  lowest-friction adapter: wraps a bare `(expression: string) => Promise<unknown>` primitive
  (agent-browser, extensions, bookmarklet hosts). `setViewport`/`open` are optional callbacks;
  without a viewport setter the source verifies the live width instead of lying about it —
  `currentWidth()` gives you the natural sweep width. String results from text transports are
  JSON-parsed in `measure()`.
- **`sweepSource(source, opts)` / `resweepSource(source, store, opts)`** — the driver-neutral
  sweep loop (scroll support requires the `evaluate` seam). `SourceSweepOptions` makes `url`
  optional: omit it for pre-navigated/attached sources.

## `/browser` — zero-driver

`collectViewport(selectors, { root?, width?, height? })` · `collectStore(...)` ·
`scoreDOM(selectors)` · `analyzeDOM(selectors?, opts?)` (one-call oracle over the live DOM at
the current viewport — defaults to `LANDMARK_SELECTORS`) · `analyzeStore` · `collectPage` /
`buildCollectExpression(args)` (the self-contained in-page collector and its injectable
expression) · `fromWire`/`toWire` · `storeToJSON`/`storeFromJSON` (JSON transport of stores —
Maps don't survive serialization).

**The overlay**: `mountOverlay({ selectors?, touchMin? })` appends an `<rjs-overlay>` badge
(shadow DOM, style-isolated) that shows live E/W counts, expands to the grouped findings,
outlines the offending element on hover, and re-measures on resize. `defineOverlay()`
registers the element without mounting. Both are lazy — safe to import in Node/SSR.

**The IIFE bundle**: `@responsivejs/design/browser-global` is this whole subpath bundled as
a single ~52 kB script exposing `window.rjs` — droppable into any page via `<script>`,
`page.addScriptTag`, or the `rjs snippet` bookmarklet. No module system needed.

## `LiveValidator` — realtime observers

`attach(page, selectors)` · `snapshot(): SnapshotStore` · `resizeTo(width)` ·
`scoreAt(width?)` · `check(): Report` · `detach()`. For continuous scoring while a page changes
(theme builders, devtools). It runs the **same in-page collector** as every other path, so its
measurements are identical — DOM-semantic interactivity, effective backgrounds, overflow
containment and the provenance manifest all included.

## Reporters

`formatConsole` · `formatJSON` (serializes score maps correctly) · `formatCompact` (adds
`E/W/I` counts for unified reports) · `formatSARIF(unified, { toolVersion? })` — SARIF 2.1.0
for code-scanning CI · `formatContractConsole` / `formatContractCompact` /
`formatContractSARIF` (contract rule ids become SARIF rule ids; the authored `description`
rides as each rule's `shortDescription` — see [contract](contract.md)) · `toSerializable` ·
`renderAuditHTML(pages: PageAudit[], { title? })` — one self-contained HTML document per
audit run: grouped violations, fixes, embedded per-width screenshots with violation
rectangles overlaid from the measured rects; 2+ pages lead with a comparison table.

## Design systems

Bundled profiles (`@responsivejs/design/design-systems/*.json`): `apple-hig`, `fluent-ui-2`,
`material-design-3`. `applyDesignSystem(asserter, ds, selectors?)` applies a
profile's constraints; `designSystemRules(ds, selectors?)` returns the same checks as contract
rules (the two are parity-tested).

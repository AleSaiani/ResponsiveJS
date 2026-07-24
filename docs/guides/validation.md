# Validating with r$ — the design guide

This is the guide to `@responsivejs/design`: what the validation side of r$ is for, how
measuring works, and worked examples that grow from five lines to contracts in CI. The
[API reference](../api/design.md) has every exact signature. Authoring is the other half:
[the runtime guide](runtime.md).

```bash
npm i -D @responsivejs/design @playwright/test   # Playwright is the default driver
```

## The mental model

The runtime *writes* `value = f(width)`; the design package *reads it back and judges it*.
Three stages, always the same:

1. **Measure** — open the page at several widths and snapshot every element you care about:
   rectangles, computed styles, parent/child relations. This produces a `SnapshotStore` — the
   sampled version of the parametric plane.
2. **Model** — the store makes `f(width)` tangible: for any element and property you can ask
   for its **curve**, the measured function across widths.
3. **Judge** — constraints are equations that must hold at every width (`child.right ≤
   parent.right`, `dFontSize/dWidth ≥ 0`); the score grades composition; a11y checks run on
   the same measurements. The verdict is machine-readable — humans read the console form,
   CI reads the exit code, agents read the JSON.

Nothing downstream of measurement touches the browser again: judging a cached store is pure
math, deterministic, and free to re-run.

## Your first validation

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('the layout holds', async ({ page }) => {
    const r = r$(page);

    await r.sweep({
        url: 'http://localhost:3000',
        widths: [320, 768, 1280],
        selectors: ['main', 'h1', '.card', '.btn'],
    });

    r.assert.noOverflow().minSize('.btn', { height: 44 });

    expect(r.report().pass).toBe(true);
});
```

What each line really does:

- **`r$(page)`** wraps a Playwright page in a validator. Nothing happens yet.
- **`sweep()`** is the measurement pass: for each width it resizes the viewport, waits for
  layout to settle, and runs r$'s in-page collector over your selectors. Choose widths like
  test cases — the extremes plus wherever your layout changes regime. Choose selectors for
  the elements with *responsibilities* (the nav that must not overflow, the CTA that must be
  tappable) rather than sweeping `*`.
- **`r.assert`** is a chainable **Asserter**. Each call checks one equation at every measured
  width and records violations instead of throwing — you always get the full picture, not the
  first failure.
- **`r.report()`** returns `{ pass, total, passed, failed, violations }`. `failed` counts
  failed *checks* — one check can carry several violations (minSize failing width AND
  height), so `failed ≤ violations.length` and `passed` is never negative. Each violation
  says *what* broke, *where* (`.btn[0]`), *at which width*, and *by how much*
  (`expected`/`actual`).

### Picking constraints

There are 27 (all in the [agents reference](../agents/validation-reference.md), each a method
on `r.assert`). They fall into families — pick by what the element is responsible for:

```typescript
r.assert
    .noOverflow()                                  // geometry: nothing bleeds out
    .contains('.card', '.card img')                // geometry: children stay inside
    .monotonic('h1', 'fontSize', 'up')             // continuity: text never shrinks as width grows
    .continuous('.sidebar', 'width', 200)          // continuity: no sudden jumps between widths
    .touchTarget('.toolbar button')                // a11y: tappable (24px WCAG floor; pass 44 for platform)
    .contrastRatio('p', 'AA')                      // a11y: measured effective backgrounds
    .proportion('.sidebar', '.main', { min: 0.2, max: 0.33 }); // relations: the ratio holds
```

The continuity family is the distinctive one: it checks the *function*, not a screenshot. A
font that drops from 32px to 18px between 767 and 768px passes every per-width check and
fails `monotonic` — which is exactly the class of bug that slips through visual review.

## The full oracle: `analyze()`

Assertions check what you thought of. `analyze()` runs everything at once — the default
constraint set, the aesthetic score, and axe (when installed):

```typescript
const report = await r.analyze();   // reuses the sweep you already did
```

The `UnifiedReport` adds structure worth knowing:

```jsonc
{
    "pass": false,       // no ERROR-level violations — your CI gate
    "clean": false,      // no violations at all — your polish gate
    "summary": { "errors": 2, "warnings": 3, "info": 0, "byRule": {…}, "byWidth": {…} },
    "violations": [ /* every one, with severity */ ],
    "fixes": [ { "selector": ".cta", "property": "min-height", "value": "44px", "reason": "…" } ],
    "scores": { "average": { "overall": 0.62, /* +17 metrics */ } },
    "sources": { "measurement": "playwright", "a11y": "axe" }
}
```

Two gates on purpose: **`pass`** ignores warnings (loop on it — fix errors first), **`clean`**
is zero-anything (chase it when polishing). `fixes` is the flattened apply-first list — every
violation that has an honest mechanical fix carries one; the rest give you
`detail` + `expected/actual` to reason from.

`sources.a11y` tells you whether axe actually ran (`'axe'`), was skipped, or was unavailable —
the report never silently pretends.

## The aesthetic score (experimental)

Seventeen measured metrics with academic lineage (Ngo/Birkhoff — balance, equilibrium,
symmetry, proportion, density, rhythm…), each 0..1, averaged into `overall`. It is
deterministic but **experimental**: elements matched by several selectors are currently
counted once per selector, nested areas sum into density/weight, and the weights are not yet
calibrated against human judgment — treat it as a relative signal subordinate to the
verifiable constraints, never as a gate on its own. How to use it without over-trusting it:

- **Read metrics, not the total.** Each low metric maps to a concrete adjustment: low
  `balance` → visual weight is lopsided; low `proportion` → sizes don't relate harmonically;
  low `density` → cramped or sparse.
- **Compare, don't idolize.** The score shines as a *relative* signal: this variant vs that
  one, this week vs last week (`score: [{ min: 0.6 }]` in a contract pins the floor).
- **Scope it.** On long document pages visual mass concentrates at the top and `equilibrium`
  tanks — score a section (`r.score('.hero')`), not the page.

## Curves: the model made queryable

```typescript
r.at(768).rect('.sidebar');            // one width, one element
r.curve('h1', 'fontSize');             // Map<width, px> — f(width), measured
r.rectCurve('.sidebar', 'width');
```

Curves are what continuity constraints and **baselines** are built on — and your debugging
X-ray: print one and you *see* the function your CSS actually produced.

## Contracts: the spec that travels

Assertions live in test code. A **contract** is the same expectations as reviewable JSON —
versionable, diffable, executable by anyone (CI, the CLI, an agent):

```typescript
import { contract } from '@responsivejs/contract';
import { verifyContract, recordBaseline } from '@responsivejs/design';

const home = contract('home')
    .viewport({ widths: [320, 768, 1280] })
    .select('sidebar', '.app-sidebar')
    .assert('noOverflow', undefined, { id: 'no-bleed', description: 'nothing bleeds out' })
    .below(768).assert('hidden', { selector: '$sidebar' })
    .from(768).assert('visible', { selector: '$sidebar' })
    .baseline('h1', 'fontSize')
    .build();                            // → plain JSON (schema-validated round-trip)

const report = await verifyContract(home, page);   // sweep derived FROM the contract
```

Three things contracts add over inline asserts:

- **Intent.** Every rule carries a `description` — when it fails, the report tells you *why
  the rule exists*, not just that it broke. (This is also what makes contracts executable
  instructions for agents.)
- **Baselines.** `recordBaseline` measures today's curves and pins them into the contract;
  later runs fail if the geometry drifts beyond tolerance. Record → commit → verify: visual
  regression without screenshots.
- **Design-system presets.** `"designSystem": { "profile": "material-design-3" }` expands
  into that system's *measurable* rules — touch minimums, contrast, spacing tokens, radius
  sanity, control heights (also `apple-hig`, `fluent-ui-2`, or your own config). These are
  **validation presets**, not full conformance: they don't yet check type scales, color
  palettes, elevation or per-component specs.

When you outgrow the builder, write the JSON directly — the published
[schema](../../packages/contract/schema/design-contract.v1.json) validates it, and unknown
names fail at load with did-you-mean suggestions.

## Drivers: the seam under everything

`sweep` needs three capabilities: set a viewport, measure, (optionally) evaluate JS. That's
the whole `MeasurementSource` interface — and everything above it is driver-neutral:

- **`PlaywrightSource`** — the default, what `r$(page)` uses. For CI.
- **`CdpSource`** — any structural `{ send(method, params) }` client (CDPSession,
  chrome-remote-interface, agent-browser's CDP bridge). No dependency.
- **`EvalSource`** — the lowest bar: if your environment can eval a JS string in the page,
  it can drive r$. Without a viewport-setter it *verifies* the live width rather than lying
  (measurements are never fiction); wrap `chunkedEval` when the transport caps argument
  length.

You care about this when validating where Playwright can't go: a logged-in session in a real
browser, an embedded webview, an agent's browser tool. Same collector, same math — identical
measurements everywhere.

### agent-browser: audits with nothing installed in the project

[Vercel's agent-browser](https://github.com/vercel-labs/agent-browser) deserves its own note,
because it changes *when* you can reach for r$. It's a standalone browser CLI (`npm i -g
agent-browser`) — so the audit needs **no Playwright, no npm install, no config in the target
project**. That unlocks workflows Playwright-in-the-repo can't do:

- **Audit a page you don't have the repo for** — production, a legacy property, a CMS page
  marketing just shipped: `rjs analyze https://example.com -d agent-browser`.
- **Check the competition** — measure any live site's responsive behavior the same way you
  measure yours (mind their terms of service).
- **Try r$ before adopting it** — one global install, one command, a full report; nothing to
  undo if you walk away.
- **A shared browser session** — agent-browser keeps a persistent session (`--session`), so
  repeated audits reuse the same browser instead of cold-starting one per run.

Playwright stays the CI driver (deterministic, versioned with the repo); agent-browser is the
zero-footprint field tool. `-d auto` picks whichever is available.

For no driver at all, the `/browser` subpath runs inside any live DOM:
`scoreDOM(['main', '.card'])`, `analyzeStore(collectStore([...]))` — usable from a devtools
console or injected by tooling.

## CI and the CLI

The `rjs` CLI is this same engine with exit codes: `rjs analyze <url>` (0 pass / 1
violations), `rjs verify <contract> <url>`, `rjs record`. Use the library in Playwright tests
where you already have fixtures; use the CLI where you want zero project setup or a quick
audit of any URL. `-f sarif` feeds code-scanning UIs; `-f json` feeds anything else.

The flags that matter day to day: `-s "main,.card"` (scope selectors — see below), `-w
320,768,1280`, `--strict` (fail on warnings too), `--touch-min 44` (platform touch rule
instead of the WCAG 24px floor), `--scroll` (below-the-fold content), `-d agent-browser`
(audit any live URL with nothing installed in the project).

## Cutting false positives

A report that is mostly noise teaches people to ignore it. Four levers, in order of impact:

- **Scope your selectors.** Audit `main, nav, .content, .cta` — the elements with
  responsibilities — not the whole DOM. This is the single biggest signal/noise lever on
  real-world pages.
- Contrast is computed from **measured effective backgrounds** (transparent ancestors
  resolved to the color actually painted), so what it flags is what users see.
- Touch targets default to WCAG 2.5.8's 24px floor and **exempt inline prose links**; raise
  to platform guidance (`44`/`48`) per rule, per run, or via a design-system profile.
- Gate on `pass` (errors only) in loops and CI; chase `clean` (zero anything) when polishing.

## Determinism, cost, trust

Same store in → same report out: scores and contrast are computed from measured values (axe's
color sampler is deliberately disabled in favor of the deterministic constraint; contrast uses
*effective* backgrounds — transparent ancestors resolved to what users actually see).
Sweeping costs one page-load plus one relayout per width; everything after is pure math, so
re-judging a cached store — or a store shipped as JSON via `storeToJSON` — is free.

## Where next

- [CI guide](ci.md) — wiring reports into pipelines, SARIF, baselines strategy.
- [Agents reference](../agents/validation-reference.md) — exact JSON shapes and the fix loop.
- [design API](../api/design.md) · [contract API](../api/contract.md).

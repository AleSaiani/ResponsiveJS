# Agent reference — validation I/O

Exact shapes and decision rules for driving r$ programmatically. Human-oriented docs:
[design guide](../guides/validation.md).

## Commands

```
rjs analyze <url>  [-d auto|playwright|agent-browser] [-w 320,768,1280] [-s "main,.card"]
                   [-f console|json|sarif] [-o file] [--no-a11y] [--strict] [--scroll]
                   [--touch-min 24] [--height 900]
rjs verify  <contract.json> <url>  [same driver/format/out flags]
rjs record  <contract.json> <url>  [-o other.json]
rjs init    <url>  [-o contract.json]   # generate a contract FROM the page's constructs
rjs doctor                         # environment readiness: exit 0 = a driver is usable
```

Exit codes — gate on these: `0` pass · `1` violations · `2` usage/run error (bad args, missing
driver, invalid contract). `--strict` makes analyze exit 1 on warnings/info too.

## UnifiedReport (analyze -f json)

```jsonc
{
    "pass": false,          // no ERROR-severity violations (loop gate)
    "clean": false,         // no violations at all (polish gate)
    "total": 46, "passed": 39, "failed": 7,   // failed counts CHECKS (can be < violations.length;
                                              // one check may carry several violations). Never negative.
    "widths": [320, 1280],
    "sources": { "measurement": "playwright|agent-browser|eval|cdp|store", "a11y": "axe|skipped|unavailable" },
    "summary": { "errors": 7, "warnings": 0, "info": 0, "byRule": {"noOverflow": 1}, "byWidth": {"320": 3} },
    "violations": [ /* Violation[] — see below */ ],
    "fixes": [ /* Fix[] — ONLY kind:'exact' entries, deduped by (selector, property)
                  across widths. Safe to apply verbatim, no parsing needed. */ ],
    "scores": { "average": { "overall": 0.57, /* +17 metrics 0..1 */ }, "perWidth": {} },
    "manifest": [ /* ProvenanceEntry[] — present when the page runs @responsivejs/runtime:
                     {id, construct, target, behavior[], source?, config?} — what controls the
                     page. config is the SERIALIZED declaration (e.g. {fontSize: {value:'fluid',
                     min:16, max:32, curve:'exponential'}}) — everything needed to regenerate
                     the construct call. */ ],
    "durationMs": 4200
}
```

### Violation

```jsonc
{
    "rule": "noOverflow",          // or "axe:<id>", "score.<metric>", "baseline"
    "element": ".card[0]",         // selector[index]
    "width": 320,                  // px where it was measured
    "detail": "right=496 > viewport=320",
    "severity": "error|warning|info",   // MISSING severity counts as error
    "expected": 320, "actual": 496,     // when numeric
    "fix": { "selector": ".card", "property": "max-width", "value": "100%", "reason": "…",
             "kind": "exact" },     // exact = apply `selector { property: value }` verbatim;
                                    // heuristic = direction only (value may be a placeholder);
                                    // runtime-patch = see below
    "owner": {                     // PROVENANCE: the runtime construct that owns this element
        "construct": "style",      // style | geometry | tokens | sync | ratio | breakpoints
        "behavior": ["width: fluid"],
        "source": "src/cards.ts:12",  // best-effort call site
        "via": ".site-nav"            // only when the construct owns an ANCESTOR: the manifest
                                      // target that matched (element ".site-nav a[3]" is owned
                                      // through its ".site-nav" construct)
    },
    "owners": [ /* present when SEVERAL constructs own the element — same shape,
                   most specific first; `owner` is always owners[0] */ ]
}
```

### The runtime-patch fix

When the owning construct controls the very property a fix would patch, the fix arrives as
`kind: "runtime-patch"` instead — a CSS patch there would be overwritten by the runtime:

```jsonc
{
    "kind": "runtime-patch",
    "selector": ".hero", "property": "font-size", "value": "14px",
    "construct": "style",
    "source": "src/hero.ts:3",
    "change": {
        "property": "fontSize",
        "current": { "value": "fluid", "min": 10, "max": 28 },  // the declaration as written
        "suggested": "14px"                                     // CSS value that satisfies the constraint
    },
    "reason": "'font-size' is controlled by the style construct at src/hero.ts:3 — …"
}
```

Mechanical recipe: open `source`, find the construct call, recompute its parameters so the
declaration satisfies `suggested` (here: raise the fluid `min` from 10 to 14). Never patch the
CSS for these.

### Agent loop

1. `rjs analyze <url> -f json` (or `verify` against a contract).
2. Apply every `fixes[]` entry verbatim as `selector { property: value }` — the list carries
   only `kind: "exact"` fixes, already deduped. No value parsing, no judgment needed.
3. For `fix.kind: "runtime-patch"`: edit the construct declaration at `fix.source` using
   `fix.change` (current config + the CSS value that would satisfy the constraint). Never
   patch the CSS for these — the runtime would overwrite it.
4. For everything else — violations with `fix.kind: "heuristic"` (a direction, not a patch)
   or no `fix` at all: reason from `detail` + `expected/actual` (+ the
   rule's `ruleDescription` in contract mode — it states WHY the rule exists).
   **If the violation has an `owner`, patch the CONSTRUCT, not the CSS** — same logic as
   runtime-patch, without the precomputed change.
5. Re-run. Stop at exit 0. Never claim success without the exit code.
6. Contract mode, after an APPROVED visual change: `rjs record` re-pins baselines.
7. On a page with constructs but NO contract yet: `rjs init <url> -o app.contract.json`
   generates one FROM the manifest (fluid → monotonic+continuous+baseline, ratio →
   proportion, breakpoints → viewport widths; stderr lists what could not be expressed),
   then `rjs record` pins the curves.

## ContractReport (verify -f json)

```jsonc
{
    "contract": { "name": "home", "version": 1 },
    "pass": true, "total": 6, "passed": 6, "failed": 0,
    "rules": [ { "ruleId": "no-bleed", "assert": "noOverflow", "pass": true, "checks": 3,
                 "skipped": false, "violations": [] } ],
    "violations": [ /* Violation + ruleId + ruleDescription */ ],
    "score": [ /* {metric, min, actual, pass, width?} */ ],
    "baselines": [ /* {selector, prop, pass, unrecorded?, deviations[]} */ ]
}
```

## Contract skeleton

```jsonc
{
    "name": "home", "version": 1,
    "viewport": { "widths": [320, 768, 1280] },          // or {from,to,step}
    "selectors": { "sidebar": ".app-sidebar" },          // $sidebar aliases in args
    "designSystem": { "profile": "material-design-3" },  // apple-hig | fluent-ui-2 | inline config
    "rules": [
        { "assert": "noOverflow", "description": "why this matters", "severity": "error",
          "when": { "max": 767 }, "id": "stable-id" }
    ],
    "score": [{ "min": 0.6 }],
    "baselines": [{ "selector": "h1", "prop": "fontSize", "tolerance": { "px": 2 } }]
}
```

JSON Schema (validate before use):
[`design-contract.v1.json`](../../packages/contract/schema/design-contract.v1.json).
Unknown assert names / args fail at load with did-you-mean suggestions.

Guarantees: selector-less (global) rules like `noOverflow` sweep a landmark default set —
a contract of only global rules still measures real elements. A run that performed ZERO
checks never passes: it fails with a `contract.noChecks` error violation. Treat that as
"my targets don't exist on this page", not as success.

## The 27 constraints

| assert | args | meaning |
| --- | --- | --- |
| `noOverflow` | — | No element exceeds the viewport width at any measured width. Naked overflow = error; inside a scrollable/clipping ancestor = warning (detail says which). |
| `contains` | parent:selector, child:selector | Child rects stay inside the parent rect. |
| `sameHeight` | a:selector, b:selector, tolerance?:number | Two elements keep equal heights. |
| `sameLine` | a:selector, b:selector | Two elements share the same visual row. |
| `minSize` | selector, min:{width?,height?} | Elements meet minimum dimensions. |
| `gapUniform` | selector, threshold?:number | Spacing between children is uniform. |
| `monotonic` | selector, prop:enum, direction?:enum | A property never moves against the direction as width grows. |
| `continuous` | selector, prop:enum, maxJump:number | No sudden jumps in a property across widths. |
| `proportion` | a, b, bounds:{min,max} | Width ratio a/b stays within bounds. |
| `childrenContained` | selector, tolerance?:number | Direct children stay inside their container. |
| `childrenEqualWidth` | selector, tolerance?:number | Direct children keep equal widths. |
| `noZeroHeight` | selector | Elements never collapse to zero height while having width. |
| `touchTarget` | selector, min?:number | Touch targets ≥ min at mobile widths (default 24, WCAG 2.5.8 AA). Interactive = DOM semantics (native controls, roles, tabindex, not disabled) or cursor:pointer; inline prose links exempt; unrendered (0×0) skipped. |
| `textReadable` | selector | Font size and line-height stay readable. |
| `contrastRatio` | selector, level?:'AA'\|'AAA' | WCAG contrast, measured effective backgrounds. |
| `borderRadiusValid` | selector | Border radii stay consistent with element size. |
| `zStackOrder` | selectors:selector[] | z-index ordering matches the given selector order. |
| `typographyScale` | selector | Font sizes fit a modular scale. |
| `spacingTokens` | selector, tokens:number[] | Spacing values come from the token set. |
| `aspectRatio` | selector, ratio:number, tolerance?:number | Elements keep the given aspect ratio. |
| `focusVisible` | selector | Focusable elements have a visible focus affordance. |
| `noHiddenOverflow` | selector | Content is not silently clipped by overflow:hidden. |
| `alignedToGrid` | selector, gridSize:number | Element positions align to a px grid. |
| `breakpointSafe` | breakpoints:number[] | Layout holds just below and above each breakpoint (bp±1 sampled automatically). |
| `interactiveSpacing` | selector, minGap?:number | Interactive elements keep a minimum gap. |
| `visible` | selector | Present and rendered (display/visibility/area). |
| `hidden` | selector | Absent or not rendered. |

## Library-level (custom loops)

```typescript
import { EvalSource, chunkedEval, analyze, verifyContract, contractSweepPlan } from '@responsivejs/design';
```

- `EvalSource(evalFn, { setViewport?, open? })` — any string-eval primitive becomes a driver;
  wrap `chunkedEval(evalFn)` when the transport caps argument length (Windows ~32K).
- Without `setViewport` the source REFUSES widths that don't match the live viewport
  (`currentWidth()` gives the honest one). Measurements never lie.
- `analyze({ source, url?, selectors, widths, a11y?, constraints? })` → UnifiedReport.
- `contractSweepPlan(contract)` → `{selectors, widths, height?}` to sweep any source, then
  `verifyContract(contract, store)`.
- Determinism: same store in → same report out. Scores and contrast are computed from measured
  values, never sampled.

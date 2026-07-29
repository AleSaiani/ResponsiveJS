# API — @responsivejs/contract

The design-contract DSL: the **spec** lives here (types, registry, builder, loader, JSON
Schema); **execution** (`verifyContract`, `recordBaseline`) lives in `@responsivejs/design` and
is re-exported from it.

## The format (version 1)

```jsonc
{
    "version": 1,
    "name": "home",
    "viewport": { "widths": [320, 768, 1280], "height": 900 },     // or from/to/step
    "selectors": { "sidebar": ".app-sidebar" },                     // "$sidebar" aliases
    "designSystem": { "profile": "material-design-3" },             // or inline config
    "rules": [
        {
            "id": "sidebar-mobile",              // stable id (derived if omitted)
            "assert": "hidden",                  // one of the 27 registry constraints
            "args": { "selector": "$sidebar" },  // named args, validated per constraint
            "when": { "max": 767 },              // inclusive width range
            "severity": "error",                 // override (error | warning | info)
            "description": "sidebar collapses on mobile"   // authored intent, shown to agents
        }
    ],
    "score": [{ "min": 0.6, "metrics": { "balance": 0.5 }, "scope": "main", "when": { "min": 768 } }],
    "baselines": [{ "selector": "$sidebar", "prop": "width", "tolerance": { "px": 4 } }]
}
```

JSON Schema: [`schema/design-contract.v1.json`](../../packages/contract/schema/design-contract.v1.json)
— generated from the registry, drift-tested. Versioning: additive optional fields don't bump
`version`; changed semantics do. Unknown fields and newer versions are rejected with an upgrade
hint.

## Component contracts

A contract sweeps either the **viewport** or a **container**:

```jsonc
{
    "name": "card", "version": 1,
    "container": { "harness": ".story-harness", "widths": [240, 360, 480] },
    "rules": [{ "assert": "noOverflow", "description": "the card never bleeds out of its container" }]
}
```

In container mode the harness element is resized instead of the window, and everything is
measured **inside it, relative to it** — so `noOverflow` compares against the component's
width, not the page's. Container queries respond, because the harness is given
`container-type: inline-size`. `contractSweepPlan()` reports `harness`, and `rjs verify`
switches to a `HarnessSource` automatically: one component, one contract, verifiable in CI
without a page around it.

## The registry

`CONSTRAINT_REGISTRY` — 27 entries, one per Asserter constraint (see
[design](design.md#the-asserter--27-chainable-constraints)), each declaring named params, types,
and the positional mapping. It is the single source of truth for the TS types
(`ConstraintName`), the runtime validator, the generated schema, and design's dispatch — a sync
test against the real `Asserter` class prevents drift. Also: `CONSTRAINT_NAMES`,
`isConstraintName`.

## Builder

```typescript
contract(name?)                       // → ContractBuilder
    .viewport({ widths: [...] })
    .select('alias', '.selector')     // registers "$alias"
    .use('material-design-3', selectors?)     // embed a DS profile (or inline config)
    .at('*' | { min?, max? })         // scope subsequent asserts (describe-block style)
    .below(768) / .upTo(1024) / .from(768) / .between(a, b)
    .assert(name, args?, { id?, severity?, description? })
    .score({ min?, metrics?, scope?, when? })
    .baseline(selector, prop, tolerance?)
    .build()                          // validated DesignContract (throws ContractValidationError)
    .toJSON()
```

Round-trip guarantee: `parseContract(builder.toJSON())` is the identity.

## Loader

- `parseContract(json | object): DesignContract` — throws `ContractValidationError` with all
  issues formatted.
- `validateContract(input)` — `{ contract, issues: [] }` or `{ contract: null, issues }`;
  each `ContractIssue` is `{ path, message, suggestion? }` with did-you-mean suggestions for
  misspelled constraints, args, and fields.
- `resolveAliases(contract)` — expand `"$alias"` strings (whole-string matches only).

Zero dependencies — the validator is hand-rolled from the registry, not ajv.

## Execution (from `@responsivejs/design`)

```typescript
verifyContract(contract, store): ContractReport               // sync, driver-free
verifyContract(contract, page, { height? }): Promise<...>     // sweeps first
recordBaseline(contract, store): DesignContract               // fills baselines[].curve
contractFromManifest(manifest, { name? }): { contract, skipped }  // constructs → contract
```

`contractFromManifest` is the pure half of `rjs init`: a provenance manifest in, a
loader-valid contract out (fluid → `monotonic` + `continuous` + baseline, ratio →
`proportion`, breakpoints → `viewport.widths`, plus the `noOverflow` default). `skipped`
lists every construct/prop that could not become a rule — report it, never swallow it.

Semantics:

- **Scoping** — each rule runs on a sub-store filtered to its `when` range; an empty range makes
  the rule `skipped: true` (reported, never failing).
- **Attribution** — one `Asserter` per rule: every violation carries `ruleId` and
  `ruleDescription`; `severity` overrides apply per rule.
- **Scores** — thresholds check the average, or every in-range width when `when` is set;
  failures surface both as `ScoreCheckResult` and as synthetic `score.<metric>` violations.
- **Baselines** — recorded curves compared at their exact widths against `{ px?, percent? }`
  tolerance (default 2px); unrecorded baselines report `unrecorded` without failing.
- **Page overload** — selectors and widths are derived from the contract itself (union of all
  selector args + DS selectors + score scopes + baseline selectors; `bp±1` added for
  `breakpointSafe` rules).
- **`pass`** — no `error`-severity violations (warnings/info don't fail).

`ContractReport`: `{ contract, pass, total, passed, failed, rules: RuleResult[], violations:
ContractViolation[], score?, baselines? }` — the flat `violations` list is the single agent
surface.

## The agent loop

1. `verifyContract` → report.
2. For each violation: `ruleId` → look up the rule → read `description` (intent) and the
   violation's `fix` (`{ selector, property, value, reason, kind }` — `kind: 'exact'` is
   apply-verbatim; `'heuristic'` is a direction that needs judgment).
3. Patch, re-verify. `recordBaseline` after an approved visual change re-pins the curves.

## Also exported

| | |
| --- | --- |
| `buildJsonSchema()` | the JSON Schema generated from the registry — the same file committed under `schema/`, so tooling can regenerate instead of vendoring |
| `inRange(width, when)` / `describeRange(when)` | the `when: { min, max }` scoping logic and its human-readable form, for tools that report which rules applied where |

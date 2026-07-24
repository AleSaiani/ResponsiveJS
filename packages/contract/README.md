# @responsivejs/contract

> The design-contract DSL of [`r$`](https://github.com/AleSaiani/ResponsiveJS): declare what a
> responsive layout must guarantee — then verify it in CI, record baselines, and hand the same
> contract to AI agents.

```bash
npm install --save-dev @responsivejs/contract
```

This package is the **spec**: types, the 27-constraint registry, the fluent builder, a
zero-dependency validator with did-you-mean errors, and the published
[JSON Schema](schema/design-contract.v1.json). Execution (`verifyContract`) lives in
`@responsivejs/design`.

## A contract

```json
{
    "version": 1,
    "name": "home",
    "viewport": { "widths": [320, 768, 1280] },
    "selectors": { "sidebar": ".app-sidebar" },
    "designSystem": { "profile": "material-design-3" },
    "rules": [
        { "id": "no-bleed", "assert": "noOverflow", "description": "nothing may bleed out of the viewport" },
        { "id": "sidebar-mobile", "assert": "hidden", "args": { "selector": "$sidebar" }, "when": { "max": 767 } },
        { "id": "sidebar-desktop", "assert": "visible", "args": { "selector": "$sidebar" }, "when": { "min": 768 } }
    ],
    "score": [{ "min": 0.6 }],
    "baselines": [{ "selector": "$sidebar", "prop": "width", "tolerance": { "px": 4 } }]
}
```

Or the builder, which validates on `build()` and round-trips through JSON:

```typescript
import { contract } from '@responsivejs/contract';

const home = contract('home')
    .viewport({ widths: [320, 768, 1280] })
    .select('sidebar', '.app-sidebar')
    .assert('noOverflow', undefined, { id: 'no-bleed' })
    .below(768)
    .assert('hidden', { selector: '$sidebar' }, { id: 'sidebar-mobile' })
    .from(768)
    .assert('visible', { selector: '$sidebar' }, { id: 'sidebar-desktop' })
    .build();
```

## Verify in CI (5 lines)

```typescript
import { test, expect } from '@playwright/test';
import { verifyContract, formatContractConsole } from '@responsivejs/design';
import home from './contracts/home.contract.json' with { type: 'json' };

test('home keeps its design contract', async ({ page }) => {
    await page.goto('/');
    const report = await verifyContract(home, page); // sweep derived from the contract itself
    expect(report.pass, formatContractConsole(report)).toBe(true);
});
```

The contract is self-contained: selectors and widths for the sweep come from the contract
(including `bp±1` samples for `breakpointSafe` rules).

## The agent loop

Every violation carries its `ruleId` → the agent looks the rule up in the contract, reads the
authored `description` (the intent) and the violation's `fix` suggestion, patches, re-verifies.
`recordBaseline(contract, store)` fills `baselines[].curve` from real measurements — record once,
assert forever.

## Versioning

`version: 1` + published schema (`$id` on raw.githubusercontent.com). Additive optional fields
don't bump the version; changed semantics do. The loader rejects unknown fields and newer
versions with an upgrade hint.

Deferred by design (v1): YAML, a11y/axe block, container scope, baseline interpolation,
contract composition/`extends`, DTCG export.

## Documentation

Full API reference: [docs/api/contract.md](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/api/contract.md) · guide: [CI regression](https://github.com/AleSaiani/ResponsiveJS/blob/master/docs/guides/ci.md)

Licensed under [MPL-2.0](LICENSE).

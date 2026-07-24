# Guide — responsive regression in CI

Three escalating setups, all built on Playwright.

## 1. Assertions in a test

The quickest start: sweep and assert inline.

```typescript
import { test, expect } from '@playwright/test';
import { r$ } from '@responsivejs/design';

test('pricing page layout', async ({ page }) => {
    const r = r$(page);
    await r.sweep({
        url: '/pricing',
        widths: [320, 768, 1280, 1920],
        selectors: ['h1', '.plan-card', '.cta'],
    });

    r.assert
        .noOverflow()
        .childrenEqualWidth('.plan-grid')
        .minSize('.cta', { height: 44 })
        .breakpointSafe([768, 1280]);

    expect(r.report().pass, r.log('console') && '').toBe(true);
});
```

Tip: `breakpointSafe` re-measures at `bp±1` — add those widths (or use a contract, which does it
for you).

## 2. The full oracle

One call adds the aesthetic score and a11y (when `axe-core` is installed):

```typescript
const report = await r.analyze();          // reuses the sweep
expect(report.pass).toBe(true);            // fails only on error severity
console.log(formatCompact(report));        // r$ PASS E0/W2/I1 (312 checks, 4 widths)
```

Publish machine-readable results to code-scanning ecosystems:

```typescript
import { writeFileSync } from 'node:fs';
import { formatSARIF } from '@responsivejs/design';

writeFileSync('responsive.sarif', formatSARIF(report, { toolVersion: '1.0.0' }));
```

```yaml
# .github/workflows/ci.yml — surfaces violations in the Security tab / PR annotations
- uses: github/codeql-action/upload-sarif@v3
  with: { sarif_file: responsive.sarif }
```

## 3. Contracts (the durable setup)

Freeze expectations in a versioned JSON file next to the code:

```typescript
// tests/contracts/build-home-contract.ts — run once, commit the output
import { writeFileSync } from 'node:fs';
import { contract } from '@responsivejs/contract';

const home = contract('home')
    .viewport({ widths: [320, 768, 1280] })
    .select('nav', '.main-nav')
    .assert('noOverflow', undefined, { id: 'no-bleed' })
    .below(768).assert('hidden', { selector: '$nav' }, { id: 'nav-mobile', description: 'nav collapses to burger' })
    .from(768).assert('visible', { selector: '$nav' }, { id: 'nav-desktop' })
    .score({ min: 0.55 })
    .baseline('$nav', 'width', { px: 4 })
    .build();

writeFileSync('tests/contracts/home.contract.json', JSON.stringify(home, null, 2));
```

The CI test is five lines, forever:

```typescript
import home from './contracts/home.contract.json' with { type: 'json' };
import { verifyContract, formatContractConsole } from '@responsivejs/design';

test('home keeps its design contract', async ({ page }) => {
    await page.goto('/');
    const report = await verifyContract(home, page);
    expect(report.pass, formatContractConsole(report)).toBe(true);
});
```

### Recording baselines

Baselines turn "it looked right when we shipped it" into data:

```typescript
// After an approved visual change — re-pin and commit:
const r = r$(page);
await r.sweep({ url: '/', widths: [320, 768, 1280], selectors: ['.main-nav'] });
const repinned = recordBaseline(home, r.raw);
writeFileSync('tests/contracts/home.contract.json', JSON.stringify(repinned, null, 2));
```

From then on, `verifyContract` fails when the measured curve drifts beyond tolerance — geometric
visual regression without screenshots.

### Editor support

Add the schema for autocomplete and inline validation of contract files:

```json
{ "$schema": "https://raw.githubusercontent.com/AleSaiani/ResponsiveJS/main/packages/contract/schema/design-contract.v1.json" }
```

## Browser installation in CI

```yaml
- run: pnpm exec playwright install --with-deps chromium
```

Unit-level checks (`analyzeStore`, `verifyContract(contract, store)`, all constraint logic) run
in plain Node — no browser needed. Keep the browser job separate from your test matrix.

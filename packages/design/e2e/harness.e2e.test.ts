/**
 * E2E: component validation. The whole oracle — sweep, constraints, curves,
 * contract — run against a COMPONENT by resizing its wrapper instead of the
 * window. No navigation, no viewport emulation, no debugger: just an eval
 * seam, which is why this also works from a devtools panel.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { HarnessSource } from '../src/source/harness.js';
import { sweepSource } from '../src/source/sweep.js';
import { analyzeStore } from '../src/analyze/core.js';
import { verifyContract, contractSweepPlan } from '../src/contract/verify.js';
import { StoreQuery } from '@responsivejs/core/snapshot';

// A card that reflows: the row wraps under 300px, and the title is fluid on
// the CONTAINER (cqi), not the viewport.
const STORY = `data:text/html,${encodeURIComponent(`
<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 40px; }
  .harness { margin-left: 120px; }
  .card { container-type: inline-size; background: #fff; }
  .card h3 { font-size: clamp(14px, 6cqi, 28px); margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .row > * { flex: 1 1 140px; }
  .cta { min-height: 44px; min-width: 44px; }
</style></head><body>
  <div class="harness">
    <div class="card">
      <h3>Component title</h3>
      <div class="row"><button class="cta">One</button><button class="cta">Two</button></div>
    </div>
  </div>
</body></html>`)}`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(STORY);
});

afterAll(async () => {
    await browser?.close();
});

const evalFn = (expression: string): Promise<unknown> => page.evaluate(expression);

describe('HarnessSource — the component is the viewport', () => {
    it('sweeps the harness width and measures relative to it', async () => {
        const source = new HarnessSource(evalFn, { harness: '.harness' });
        const store = await sweepSource(source, { selectors: ['.card', '.card h3', '.cta'], widths: [240, 480] });

        expect(store.widths).toEqual([240, 480]);

        // Relative coordinates: the harness sits 120px into the page, but the
        // card starts at x≈0 in component space. Without this every child
        // would be reported as overflowing.
        const card = store.snapshots.get(240)!.elements.get('.card')![0];
        expect(card.rect.x).toBeLessThan(1);
        expect(card.rect.width).toBeLessThanOrEqual(240);

        // …and the constraint that would have fired on absolute coordinates
        // reports a clean component.
        const report = analyzeStore(store, { score: false, constraints: { contrast: false } });
        expect(report.violations.filter((v) => v.rule === 'noOverflow')).toHaveLength(0);

        await source.close();
    }, 60_000);

    it('container queries respond to the harness: f(containerWidth) is measurable', async () => {
        const source = new HarnessSource(evalFn, { harness: '.harness' });
        const store = await sweepSource(source, { selectors: ['.card h3'], widths: [200, 400] });
        const curve = new StoreQuery(store).curve('.card h3', 'fontSize');

        // 6cqi of the card: it grows with the CONTAINER, while the window
        // never moved.
        expect(curve.get(400)!).toBeGreaterThan(curve.get(200)!);
        await source.close();
    }, 60_000);

    it('a component contract verifies through the same plan', async () => {
        const contract = {
            name: 'card',
            version: 1 as const,
            container: { harness: '.harness', widths: [240, 480] },
            rules: [
                { assert: 'noOverflow' as const, args: {}, description: 'the card never bleeds out of its container' },
                { assert: 'touchTarget' as const, args: { selector: '.cta', min: 44 }, description: 'CTAs stay tappable' },
                { assert: 'monotonic' as const, args: { selector: '.card h3', prop: 'fontSize' as const, direction: 'up' as const } },
            ],
        };

        const plan = contractSweepPlan(contract);
        expect(plan.harness).toBe('.harness'); // the plan knows it is a component
        expect(plan.widths).toEqual([240, 480]);

        const source = new HarnessSource(evalFn, { harness: plan.harness! });
        const store = await sweepSource(source, { selectors: plan.selectors, widths: plan.widths });
        const report = verifyContract(contract, store);

        expect(report.pass).toBe(true);
        expect(report.total).toBeGreaterThan(0);
        await source.close();
    }, 60_000);
});

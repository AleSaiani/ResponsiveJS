/**
 * E2E: a container-bound value must keep answering to the container.
 *
 * happy-dom cannot do this — no layout, no ResizeObserver deliveries — so the
 * only honest place to assert it is a real browser. The regression this guards
 * against: the value updated once at mount and then lagged one resize behind.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';

const BUNDLE = join(import.meta.dirname, '..', 'dist', 'global.js');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  #panel { width: 300px; }
  #card { background: #eee; }
</style></head><body>
<div id="panel"><div id="card">card</div></div>
</body></html>`;

let browser: Browser;
let page: Page;

/** Resize the panel and give the browser a couple of frames to deliver. */
async function setPanel(width: number): Promise<string> {
    return page.evaluate(async (w) => {
        document.getElementById('panel')!.style.width = `${w}px`;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 60));
        return document.getElementById('card')!.style.fontSize;
    }, width);
}

beforeAll(async () => {
    if (!existsSync(BUNDLE)) throw new Error(`container e2e: bundle missing at ${BUNDLE} — run pnpm build first`);
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    await page.setContent(PAGE);
    await page.addScriptTag({ path: BUNDLE });
}, 120_000);

afterAll(async () => {
    await browser?.close();
});

describe('container-bound values', () => {
    it('follow the container across repeated resizes, without lagging behind', async () => {
        // a non-linear curve stays in the JS half, which is the path under test
        await page.evaluate(`r$('#card', {
            fontSize: r$.fluid(10, 30, { container: true, from: 200, to: 600, curve: 'ease-in-out' }),
        })`);

        const at300 = await setPanel(300);
        const at600 = await setPanel(600);
        const at200 = await setPanel(200);
        const back = await setPanel(600);

        expect(parseFloat(at300)).toBeGreaterThan(10);
        expect(parseFloat(at300)).toBeLessThan(30);
        // each measurement must reflect the width it was taken at — not the one before
        expect(parseFloat(at600)).toBeCloseTo(30, 0);
        expect(parseFloat(at200)).toBeCloseTo(10, 0);
        expect(parseFloat(back)).toBeCloseTo(30, 0);
    });
});

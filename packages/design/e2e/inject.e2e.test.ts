/**
 * E2E: the injectable surface (M4) — the IIFE bundle dropped into a page r$
 * has never seen. A deliberately broken synthetic page: fixed-width div
 * overflowing a narrow viewport, a sub-24px button. The bundle must find
 * both, and the <rjs-overlay> badge must show them.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';

const BUNDLE = join(import.meta.dirname, '..', 'dist', 'browser-global.js');

const BAD_PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<main>
  <div id="wide" style="width:900px;height:80px;background:#eee">too wide</div>
  <button id="tiny" style="width:16px;height:16px;padding:0;border:0">x</button>
</main>
</body></html>`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
    if (!existsSync(BUNDLE)) {
        throw new Error(`inject e2e: bundle missing at ${BUNDLE} — run pnpm build first`);
    }
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 700 } });
    await page.setContent(BAD_PAGE);
    await page.addScriptTag({ path: BUNDLE });
}, 120_000);

afterAll(async () => {
    await browser?.close();
});

describe('the IIFE bundle on a hostile page', () => {
    it('exposes the browser core as window.rjs', async () => {
        const keys = await page.evaluate(`Object.keys(rjs).sort()`);
        expect(keys).toContain('analyzeDOM');
        expect(keys).toContain('scoreDOM');
        expect(keys).toContain('mountOverlay');
        expect(keys).toContain('collectStore');
    });

    it('analyzeDOM finds the overflow and the tiny button at the live viewport', async () => {
        const result = await page.evaluate(`(() => {
            const r = rjs.analyzeDOM(['main', 'div', 'button'], { score: false });
            return { pass: r.pass, width: r.widths[0], rules: r.violations.map(v => v.rule).sort() };
        })()`);
        expect(result).toMatchObject({ pass: false, width: 400 });
        expect(result.rules).toContain('noOverflow');
        expect(result.rules).toContain('touchTarget');
    });

    it('the overlay badge mounts in shadow DOM and shows the counts', async () => {
        await page.evaluate(`rjs.mountOverlay({ selectors: ['main', 'div', 'button'] })`);
        const badge = await page.evaluate(
            `document.querySelector('rjs-overlay').shadowRoot.querySelector('.badge').textContent`,
        );
        expect(badge).toMatch(/^r\$ \d+E \d+W$/);
        expect(badge).not.toBe('r$ 0E 0W'); // the page IS broken

        // panel opens and lists the offender
        await page.evaluate(`document.querySelector('rjs-overlay').shadowRoot.querySelector('.badge').click()`);
        const panel = await page.evaluate(
            `document.querySelector('rjs-overlay').shadowRoot.querySelector('.panel').textContent`,
        );
        expect(panel).toContain('noOverflow');
        expect(panel).toContain('measured live at 400px');
    });

    it('the overlay re-measures on resize', async () => {
        await page.setViewportSize({ width: 1200, height: 700 });
        await page.waitForTimeout(450); // debounce is 300ms
        const badge = await page.evaluate(
            `document.querySelector('rjs-overlay').shadowRoot.querySelector('.badge').textContent`,
        );
        // at 1200px the 900px div fits; touchTarget only fires <= 768px
        expect(badge).toBe('r$ 0E 0W');
    });
});

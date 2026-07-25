/**
 * E2E: the no-build surface. A plain HTML page, a <script> tag, no bundler,
 * no module system — window.r$ must be the same callable namespace, and the
 * CSS-first split must still happen (a linear fluid becomes a clamp()).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';

const BUNDLE = join(import.meta.dirname, '..', 'dist', 'global.js');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<nav class="site-nav"><a href="#">one</a><a href="#">two</a></nav>
<h1 class="hero">Title</h1>
</body></html>`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
    if (!existsSync(BUNDLE)) throw new Error(`global e2e: bundle missing at ${BUNDLE} — run pnpm build first`);
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 700 } });
    await page.setContent(PAGE);
    await page.addScriptTag({ path: BUNDLE });
}, 120_000);

afterAll(async () => {
    await browser?.close();
});

describe('the runtime as a plain <script>', () => {
    it('exposes a callable window.r$ (and the responsive alias)', async () => {
        expect(await page.evaluate('typeof r$')).toBe('function');
        expect(await page.evaluate('typeof r$.fluid')).toBe('function');
        expect(await page.evaluate('window.responsive === window.r$')).toBe(true);
    });

    it('still compiles the CSS-first half — no bundler needed', async () => {
        const sheet = await page.evaluate(`(() => {
            r$('.hero', { fontSize: r$.fluid(16, 32) });
            return document.querySelector('style[data-responsivejs]').textContent;
        })()`);
        expect(sheet).toContain('clamp(16px');
    });

    it('geometry works against the real DOM', async () => {
        const wrapped = await page.evaluate(`(() => {
            r$.geometry('.site-nav', { wrapped: r$.whenWraps });
            return document.querySelector('.site-nav').hasAttribute('data-wrapped');
        })()`);
        expect(typeof wrapped).toBe('boolean'); // measured, not guessed
    });

    it('renderStatic() returns what a server would inline', async () => {
        const css = await page.evaluate(`(() => { r$.tokens({'--space-m': r$.fluid(16, 24)}); return r$.renderStatic(); })()`);
        expect(css).toContain('--space-m');
        expect(css).toContain('clamp(');
    });
});

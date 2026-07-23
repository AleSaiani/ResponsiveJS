/**
 * E2E: the two genuinely browser-dependent seams — axe injection through
 * MeasurementSource.evaluate, and the CDP adapter against a real page.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { analyze } from '../src/analyze/index.js';
import { PlaywrightSource } from '../src/source/playwright.js';
import { CdpSource } from '../src/source/cdp.js';
import { sweepSource } from '../src/source/sweep.js';

const FIXTURE = `data:text/html,${encodeURIComponent(`
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>fixture</title></head>
<body>
    <main>
        <h1 style="font-size: clamp(20px, 4vw, 40px)">Title</h1>
        <button style="width: 120px; height: 48px; color: #000; background: #fff">Go</button>
        <div class="card" style="width: 60%; height: 120px; background: #eee"></div>
        <div style="height: 2400px"></div>
        <footer class="deep" style="height: 40px">bottom</footer>
    </main>
</body>
</html>`)}`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto(FIXTURE);
});

afterAll(async () => {
    await browser.close();
});

describe('analyze e2e (chromium)', () => {
    it('runs the full oracle with axe through the eval seam', async () => {
        const report = await analyze({
            source: new PlaywrightSource(page),
            selectors: ['h1', 'button', '.card'],
            widths: [320, 1280],
        });
        expect(report.sources.a11y).toBe('axe');
        expect(report.widths).toEqual([320, 1280]);
        expect(report.scores?.average.overall).toBeGreaterThan(0);
        expect(report.total).toBeGreaterThan(0);
        // The fixture has a real a11y issue axe should catch (content outside landmarks is fine,
        // html has lang and title) — we only assert axe RAN and produced a coherent summary.
        expect(report.summary.errors + report.summary.warnings + report.summary.info).toBe(report.violations.length);
    }, 90_000);

    it('a11y: false skips axe deterministically', async () => {
        const report = await analyze({
            source: new PlaywrightSource(page),
            selectors: ['h1'],
            widths: [800],
            a11y: false,
            score: false,
        });
        expect(report.sources.a11y).toBe('skipped');
    });

    it('CdpSource produces the same store shape as PlaywrightSource', async () => {
        const cdpSession = await page.context().newCDPSession(page);
        const viaCdp = await sweepSource(new CdpSource(cdpSession, { settleMs: 20 }), {
            url: '',
            selectors: ['h1', 'button'],
            widths: [640],
        });
        const viaPw = await sweepSource(new PlaywrightSource(page, { settleMs: 20 }), {
            url: '',
            selectors: ['h1', 'button'],
            widths: [640],
        });

        const c = viaCdp.snapshots.get(640)!;
        const p = viaPw.snapshots.get(640)!;
        expect(c.width).toBe(p.width);
        expect([...c.elements.keys()].sort()).toEqual([...p.elements.keys()].sort());
        const cRect = c.elements.get('button')![0].rect;
        const pRect = p.elements.get('button')![0].rect;
        expect(Math.abs(cRect.width - pRect.width)).toBeLessThan(2);
        expect(c.elements.get('button')![0].styles.fontSize).toBe(p.elements.get('button')![0].styles.fontSize);
    });

    it('scroll sweeping reaches below-the-fold elements', async () => {
        const store = await sweepSource(new PlaywrightSource(page, { settleMs: 20 }), {
            url: '',
            selectors: ['.deep'],
            widths: [800],
            height: 600,
            scroll: true,
            scrollSteps: 5,
        });
        const deep = store.snapshots.get(800)!.elements.get('.deep');
        expect(deep).toBeDefined();
        expect(deep!.length).toBeGreaterThan(0);
    });
});

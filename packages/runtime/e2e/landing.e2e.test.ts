/**
 * E2E: the runtime constructs in a REAL browser (happy-dom does no layout —
 * geometry predicates can only be trusted here). The fixture is the landing
 * example, so the tutorial and the test can never drift apart.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { buildLandingFixture, type LandingFixture } from './fixture.js';

let fixture: LandingFixture;
let browser: Browser;
let page: Page;

beforeAll(async () => {
    fixture = await buildLandingFixture();
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto(fixture.url);
}, 120_000);

afterAll(async () => {
    await browser.close();
    await fixture.close();
});

describe('runtime constructs in chromium', () => {
    it('wide viewport: tokens on :root, three columns, no burger', async () => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForFunction(() => !document.querySelector('.site-nav')!.hasAttribute('data-wrapped'));

        const state = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            return {
                spaceM: root.getPropertyValue('--space-m').trim(),
                fontHero: root.getPropertyValue('--font-hero').trim(),
                heroApplied: getComputedStyle(document.querySelector('.hero h1')!).fontSize,
                columns: getComputedStyle(document.querySelector('.cards')!).gridTemplateColumns.split(' ').length,
                burgerVisible: getComputedStyle(document.querySelector('.menu-button')!).display !== 'none',
            };
        });
        expect(state.spaceM).toMatch(/^clamp\(16px,/); // static token, zero JS
        expect(state.fontHero).toBe('64px'); // exponential token at domain max
        expect(state.heroApplied).toBe('64px');
        expect(state.columns).toBe(3);
        expect(state.burgerVisible).toBe(false);
    });

    it('sync() equalizes card heading heights', async () => {
        const heights = await page.evaluate(() =>
            [...document.querySelectorAll('.card h3')].map((h) => Math.round(h.getBoundingClientRect().height)),
        );
        expect(heights.length).toBe(3);
        expect(new Set(heights).size).toBe(1);
    });

    it('fromElement: the tagline size lives in the sidebar-driven domain', async () => {
        const size = await page.evaluate(() =>
            parseFloat(getComputedStyle(document.querySelector('.hero .tagline')!).fontSize),
        );
        expect(size).toBeGreaterThanOrEqual(14);
        expect(size).toBeLessThanOrEqual(18);
    });

    it('narrow viewport: whenWraps sets the burger — and the state is STABLE', async () => {
        await page.setViewportSize({ width: 400, height: 800 });
        await page.waitForFunction(() => document.querySelector('.site-nav')!.hasAttribute('data-wrapped'));

        // Regression for the oscillation gotcha: the collapsed nav keeps
        // layout, so re-measures across several frames must NOT flip back.
        const stable = await page.evaluate(
            () =>
                new Promise<boolean>((resolve) => {
                    let frames = 0;
                    const check = () => {
                        if (!document.querySelector('.site-nav')!.hasAttribute('data-wrapped')) return resolve(false);
                        if (++frames >= 5) return resolve(true);
                        requestAnimationFrame(check);
                    };
                    requestAnimationFrame(check);
                }),
        );
        expect(stable).toBe(true);

        const state = await page.evaluate(() => ({
            burgerVisible: getComputedStyle(document.querySelector('.menu-button')!).display !== 'none',
            navCollapsed: getComputedStyle(document.querySelector('.site-nav')!).visibility === 'hidden',
            fontHero: getComputedStyle(document.documentElement).getPropertyValue('--font-hero').trim(),
            columns: getComputedStyle(document.querySelector('.cards')!).gridTemplateColumns.split(' ').length,
        }));
        expect(state.burgerVisible).toBe(true);
        expect(state.navCollapsed).toBe(true);
        expect(parseFloat(state.fontHero)).toBeLessThan(40); // exponential token reacted
        expect(state.columns).toBe(1); // bp.below('tablet')
    });

    it('round-trip: widening un-wraps and restores the nav', async () => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForFunction(() => !document.querySelector('.site-nav')!.hasAttribute('data-wrapped'));
        const state = await page.evaluate(() => ({
            navVisible: getComputedStyle(document.querySelector('.site-nav')!).visibility === 'visible',
            burgerVisible: getComputedStyle(document.querySelector('.menu-button')!).display !== 'none',
        }));
        expect(state.navVisible).toBe(true);
        expect(state.burgerVisible).toBe(false);
    });

    it('whenStuck: shadow only while the header is pinned', async () => {
        // Narrow viewport → the single-column page is tall enough to scroll.
        await page.setViewportSize({ width: 400, height: 700 });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(() => document.querySelector('.site-header')!.hasAttribute('data-stuck'));
        const shadow = await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')!).boxShadow);
        expect(shadow).not.toBe('none');

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => !document.querySelector('.site-header')!.hasAttribute('data-stuck'));
    });
});

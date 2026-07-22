// Browser core (Playwright-free) — proves `@responsivejs/design/browser`
// imports in a plain node env (no Playwright, no DOM) and the scoring core runs.
// The DOM collector itself is a 1:1 lift of core/measurer's in-page body and is
// exercised by the integration (Playwright) suite + the theme builder.

import { describe, it, expect } from 'vitest';
import { computeScore, scoreDOM, collectViewport, collectStore } from '../src/browser/index.js';

const mk = (x: number, y: number, w: number, h: number) => ({
    x, y, width: w, height: h,
    right: x + w, bottom: y + h,
    centerX: x + w / 2, centerY: y + h / 2,
    area: w * h,
});

describe('r$ browser core — Playwright-free', () => {
    it('the entry loads in node and exposes the DOM API as functions', () => {
        // No Playwright pulled: if it were, this module graph would need the driver.
        expect(typeof scoreDOM).toBe('function');
        expect(typeof collectViewport).toBe('function');
        expect(typeof collectStore).toBe('function');
    });

    it('computeScore runs on synthetic measurement data (0..1 metrics)', () => {
        const rects = [mk(0, 0, 200, 40), mk(0, 56, 200, 40), mk(0, 112, 200, 40)];
        const s = computeScore({
            rects,
            viewport: { width: 1280, height: 800 },
            colors: ['rgb(20,20,20)', 'rgb(240,240,240)'],
            fontSizes: [16, 16, 16],
        });
        expect(s.overall).toBeGreaterThanOrEqual(0);
        expect(s.overall).toBeLessThanOrEqual(1);
        expect(typeof s.balance).toBe('number');
        expect(typeof s.colorHarmony).toBe('number');
    });
});

import { describe, it, expect } from 'vitest';
import { parseColor, relativeLuminance, contrastRatio, meetsAA, meetsAAA } from '../src/color.js';

describe('parseColor', () => {
    it('parses rgb()', () => {
        const c = parseColor('rgb(255, 0, 0)');
        expect(c.r).toBeCloseTo(1);
        expect(c.g).toBeCloseTo(0);
        expect(c.b).toBeCloseTo(0);
        expect(c.a).toBe(1);
    });

    it('parses rgba()', () => {
        const c = parseColor('rgba(0, 128, 255, 0.5)');
        expect(c.r).toBeCloseTo(0);
        expect(c.g).toBeCloseTo(0.502, 2);
        expect(c.b).toBeCloseTo(1);
        expect(c.a).toBe(0.5);
    });

    it('parses modern rgb() space syntax', () => {
        const c = parseColor('rgb(255 128 0)');
        expect(c.r).toBeCloseTo(1);
        expect(c.g).toBeCloseTo(0.502, 2);
        expect(c.b).toBeCloseTo(0);
    });

    it('parses modern rgb() with alpha', () => {
        const c = parseColor('rgb(255 128 0 / 0.8)');
        expect(c.a).toBeCloseTo(0.8);
    });

    it('parses #hex (3 chars)', () => {
        const c = parseColor('#f00');
        expect(c.r).toBeCloseTo(1);
        expect(c.g).toBeCloseTo(0);
        expect(c.b).toBeCloseTo(0);
    });

    it('parses #hex (6 chars)', () => {
        const c = parseColor('#00ff00');
        expect(c.r).toBeCloseTo(0);
        expect(c.g).toBeCloseTo(1);
        expect(c.b).toBeCloseTo(0);
    });

    it('parses #hex (8 chars with alpha)', () => {
        const c = parseColor('#ff000080');
        expect(c.r).toBeCloseTo(1);
        expect(c.a).toBeCloseTo(0.502, 2);
    });

    it('returns transparent for "transparent"', () => {
        const c = parseColor('transparent');
        expect(c.a).toBe(0);
    });

    // HSL tests
    it('parses hsl() comma syntax', () => {
        const c = parseColor('hsl(0, 100%, 50%)'); // pure red
        expect(c.r).toBeCloseTo(1, 1);
        expect(c.g).toBeCloseTo(0, 1);
        expect(c.b).toBeCloseTo(0, 1);
    });

    it('parses hsl() modern space syntax', () => {
        const c = parseColor('hsl(120 100% 50%)'); // pure green
        expect(c.g).toBeCloseTo(1, 1);
        expect(c.r).toBeCloseTo(0, 1);
    });

    it('parses hsla() with alpha', () => {
        const c = parseColor('hsla(240, 100%, 50%, 0.5)'); // blue at 50%
        expect(c.b).toBeCloseTo(1, 1);
        expect(c.a).toBeCloseTo(0.5);
    });

    it('parses hsl with / alpha', () => {
        const c = parseColor('hsl(60 100% 50% / 0.8)'); // yellow
        expect(c.r).toBeCloseTo(1, 1);
        expect(c.g).toBeCloseTo(1, 1);
        expect(c.a).toBeCloseTo(0.8);
    });

    // OKLCH tests
    it('parses oklch() — white', () => {
        const c = parseColor('oklch(1 0 0)');
        expect(c.r).toBeCloseTo(1, 1);
        expect(c.g).toBeCloseTo(1, 1);
        expect(c.b).toBeCloseTo(1, 1);
    });

    it('parses oklch() — black', () => {
        const c = parseColor('oklch(0 0 0)');
        expect(c.r).toBeCloseTo(0, 1);
        expect(c.g).toBeCloseTo(0, 1);
        expect(c.b).toBeCloseTo(0, 1);
    });

    it('parses oklch() — roughly blue', () => {
        const c = parseColor('oklch(0.45 0.31 264)');
        // Should be a saturated blue
        expect(c.b).toBeGreaterThan(c.r);
        expect(c.b).toBeGreaterThan(c.g);
    });

    it('parses oklch() with alpha', () => {
        const c = parseColor('oklch(0.5 0.2 250 / 0.7)');
        expect(c.a).toBeCloseTo(0.7);
    });

    it('returns opaque black for fully unknown format', () => {
        const c = parseColor('some-unknown-thing');
        expect(c.r).toBe(0);
        expect(c.a).toBe(1);
    });
});

describe('relativeLuminance', () => {
    it('white has luminance ~1', () => {
        expect(relativeLuminance({ r: 1, g: 1, b: 1, a: 1 })).toBeCloseTo(1, 1);
    });

    it('black has luminance ~0', () => {
        expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBeCloseTo(0, 1);
    });

    it('mid-gray has intermediate luminance', () => {
        const lum = relativeLuminance({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
        expect(lum).toBeGreaterThan(0.1);
        expect(lum).toBeLessThan(0.5);
    });
});

describe('contrastRatio', () => {
    it('black on white is ~21:1', () => {
        const ratio = contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
        expect(ratio).toBeCloseTo(21, 0);
    });

    it('white on white is 1:1', () => {
        const ratio = contrastRatio('rgb(255, 255, 255)', 'rgb(255, 255, 255)');
        expect(ratio).toBeCloseTo(1, 0);
    });

    it('gray on white has intermediate ratio', () => {
        const ratio = contrastRatio('rgb(128, 128, 128)', 'rgb(255, 255, 255)');
        expect(ratio).toBeGreaterThan(3);
        expect(ratio).toBeLessThan(5);
    });
});

describe('WCAG levels', () => {
    it('AA normal text requires 4.5:1', () => {
        expect(meetsAA(4.5)).toBe(true);
        expect(meetsAA(4.4)).toBe(false);
    });

    it('AA large text requires 3:1', () => {
        expect(meetsAA(3, true)).toBe(true);
        expect(meetsAA(2.9, true)).toBe(false);
    });

    it('AAA normal text requires 7:1', () => {
        expect(meetsAAA(7)).toBe(true);
        expect(meetsAAA(6.9)).toBe(false);
    });

    it('AAA large text requires 4.5:1', () => {
        expect(meetsAAA(4.5, true)).toBe(true);
        expect(meetsAAA(4.4, true)).toBe(false);
    });
});

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

describe('OKLab', () => {
    it('round-trips sRGB → OKLab → sRGB within 1/255', async () => {
        const { rgbaToOklab, oklabToRgba, parseColor } = await import('../src/color.js');
        for (const css of ['#ff0000', '#00ff00', '#0000ff', '#808080', '#123456', '#ffffff', '#000000']) {
            const original = parseColor(css);
            const back = oklabToRgba(rgbaToOklab(original));
            expect(Math.abs(back.r - original.r)).toBeLessThan(1 / 255);
            expect(Math.abs(back.g - original.g)).toBeLessThan(1 / 255);
            expect(Math.abs(back.b - original.b)).toBeLessThan(1 / 255);
        }
    });

    it('preserves alpha through the round-trip', async () => {
        const { rgbaToOklab, oklabToRgba } = await import('../src/color.js');
        const c = { r: 0.5, g: 0.2, b: 0.8, a: 0.35 };
        expect(oklabToRgba(rgbaToOklab(c)).a).toBeCloseTo(0.35, 10);
    });

    it('mixOklab is exact at the endpoints', async () => {
        const { mixOklab, parseColor } = await import('../src/color.js');
        const red = parseColor('#ff0000');
        const blue = parseColor('#0000ff');
        const at0 = mixOklab(red, blue, 0);
        const at1 = mixOklab(red, blue, 1);
        expect(Math.abs(at0.r - 1)).toBeLessThan(1 / 255);
        expect(Math.abs(at1.b - 1)).toBeLessThan(1 / 255);
    });

    it('mixOklab midpoint of red/blue keeps perceptual lightness (not muddy)', async () => {
        const { mixOklab, rgbaToOklab, parseColor } = await import('../src/color.js');
        const red = parseColor('#ff0000');
        const blue = parseColor('#0000ff');
        const mid = mixOklab(red, blue, 0.5);
        const midL = rgbaToOklab(mid).L;
        const redL = rgbaToOklab(red).L;
        const blueL = rgbaToOklab(blue).L;
        // OKLab lerp keeps L at the average of the endpoints; sRGB lerp would sink well below it.
        expect(midL).toBeCloseTo((redL + blueL) / 2, 1);
        const srgbMid = { r: 0.5, g: 0, b: 0.5, a: 1 };
        expect(midL).toBeGreaterThanOrEqual(rgbaToOklab(srgbMid).L - 0.01);
    });

    it('mixOklab interpolates alpha linearly', async () => {
        const { mixOklab } = await import('../src/color.js');
        const a = { r: 1, g: 0, b: 0, a: 0 };
        const b = { r: 1, g: 0, b: 0, a: 1 };
        expect(mixOklab(a, b, 0.25).a).toBeCloseTo(0.25, 10);
    });

    it('formatRgb emits modern syntax', async () => {
        const { formatRgb } = await import('../src/color.js');
        expect(formatRgb({ r: 1, g: 0, b: 0, a: 1 })).toBe('rgb(255 0 0)');
        expect(formatRgb({ r: 0, g: 0.5, b: 1, a: 0.5 })).toBe('rgb(0 128 255 / 0.5)');
    });

    it('formatRgb clamps out-of-range channels', async () => {
        const { formatRgb } = await import('../src/color.js');
        expect(formatRgb({ r: 1.2, g: -0.1, b: 0, a: 1 })).toBe('rgb(255 0 0)');
    });

    it('oklch() parsing still works after the refactor', async () => {
        const { parseColor } = await import('../src/color.js');
        const white = parseColor('oklch(1 0 0)');
        expect(white.r).toBeCloseTo(1, 2);
        expect(white.g).toBeCloseTo(1, 2);
        expect(white.b).toBeCloseTo(1, 2);
    });
});

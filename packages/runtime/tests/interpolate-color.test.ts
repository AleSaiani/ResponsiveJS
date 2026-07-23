import { describe, it, expect, afterEach } from 'vitest';
import { fluid } from '../src/value.js';
import { looksLikeColor, mixColors } from '../src/interpolate-color.js';
import { __resetConfig } from '../src/config.js';

afterEach(__resetConfig);

describe('looksLikeColor', () => {
    it('accepts hex, rgb, hsl, oklch, transparent', () => {
        for (const c of ['#f00', '#ff0000', '#ff000080', 'rgb(255,0,0)', 'rgba(0,0,0,0.5)', 'hsl(0, 100%, 50%)', 'oklch(0.6 0.2 30)', 'transparent']) {
            expect(looksLikeColor(c), c).toBe(true);
        }
    });

    it('rejects non-color strings', () => {
        for (const s of ['scale(0.8)', '0 2px 4px rgba(0,0,0,0.1)', '100%', 'red-ish', 'calc(1px + 2vw)']) {
            expect(looksLikeColor(s), s).toBe(false);
        }
    });
});

describe('color fluid', () => {
    it('routes color endpoints to the color track', () => {
        const v = fluid('#ff0000', '#0000ff');
        expect(v.kind).toBe('color');
    });

    it('is exact at the endpoints', () => {
        const v = fluid('#ff0000', '#0000ff');
        expect(v.resolve(320)).toBe('rgb(255 0 0)');
        expect(v.resolve(1920)).toBe('rgb(0 0 255)');
    });

    it('midpoint is perceptual (not the muddy sRGB average)', () => {
        const v = fluid('#ff0000', '#0000ff');
        const mid = v.resolve(1120) as string;
        const [r, , b] = mid.match(/\d+/g)!.map(Number);
        // OKLab midpoint of pure red/blue keeps both channels above the naive sRGB 128 lerp
        expect(r).toBeGreaterThan(128);
        expect(b).toBeGreaterThan(128);
    });

    it('interpolates alpha', () => {
        const v = fluid('rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)');
        expect(v.resolve(1120)).toMatch(/\/ 0\.5\)$/);
    });

    it('supports hsl endpoints', () => {
        const v = fluid('hsl(0, 100%, 50%)', 'hsl(240, 100%, 50%)');
        expect(v.resolve(320)).toBe('rgb(255 0 0)');
    });

    it('never emits static CSS', () => {
        const v = fluid('#000', '#fff');
        expect(
            v.toStatic({ selector: '.x', property: 'color', domain: { min: 0, max: 100 }, breakpoints: [], container: false, unit: '' }),
        ).toBeNull();
    });

    it('mixColors utility works standalone', () => {
        expect(mixColors('#000000', '#ffffff', 0)).toBe('rgb(0 0 0)');
        expect(mixColors('#000000', '#ffffff', 1)).toBe('rgb(255 255 255)');
    });

    it('applies easing curves to the color ramp', () => {
        const lin = fluid('#000000', '#ffffff');
        const easedIn = fluid('#000000', '#ffffff', { curve: 'ease-in' });
        const linMid = (lin.resolve(1120) as string).match(/\d+/g)!.map(Number)[0];
        const easedMid = (easedIn.resolve(1120) as string).match(/\d+/g)!.map(Number)[0];
        expect(easedMid).toBeLessThan(linMid); // ease-in lags at the midpoint
    });
});

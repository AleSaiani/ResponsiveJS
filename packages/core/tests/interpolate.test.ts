import { describe, it, expect } from 'vitest';
import {
    EASINGS,
    progress,
    cubicBezier,
    linear,
    exponential,
    logarithmic,
    eased,
    stepped,
    piecewise,
    sample,
    inverse,
    type Domain,
} from '../src/interpolate.js';
import { isMonotonicUp, isMonotonicDown } from '../src/curve.js';

const DOMAIN: Domain = { min: 320, max: 1920 };

describe('progress', () => {
    it('is 0 at domain.min and 1 at domain.max', () => {
        expect(progress(320, DOMAIN)).toBe(0);
        expect(progress(1920, DOMAIN)).toBe(1);
    });

    it('is 0.5 at the midpoint', () => {
        expect(progress(1120, DOMAIN)).toBeCloseTo(0.5, 10);
    });

    it('clamps outside the domain', () => {
        expect(progress(100, DOMAIN)).toBe(0);
        expect(progress(4000, DOMAIN)).toBe(1);
    });

    it('handles a degenerate domain (min === max)', () => {
        const d: Domain = { min: 768, max: 768 };
        expect(progress(767, d)).toBe(0);
        expect(progress(768, d)).toBe(1);
        expect(progress(769, d)).toBe(1);
    });
});

describe('cubicBezier', () => {
    it('linear control points give identity', () => {
        const f = cubicBezier(EASINGS.linear);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            expect(f(t)).toBeCloseTo(t, 5);
        }
    });

    it('ease-in-out is symmetric around 0.5', () => {
        const f = cubicBezier(EASINGS['ease-in-out']);
        expect(f(0.5)).toBeCloseTo(0.5, 4);
        expect(f(0.2) + f(0.8)).toBeCloseTo(1, 4);
    });

    it('ease-in starts slow, ease-out starts fast', () => {
        expect(cubicBezier(EASINGS['ease-in'])(0.25)).toBeLessThan(0.25);
        expect(cubicBezier(EASINGS['ease-out'])(0.25)).toBeGreaterThan(0.25);
    });

    it('clamps t outside 0..1', () => {
        const f = cubicBezier(EASINGS.ease);
        expect(f(-1)).toBe(0);
        expect(f(2)).toBe(1);
    });

    it('extreme control points do not produce NaN', () => {
        const f = cubicBezier([1, 0, 0, 1]);
        for (const t of [0, 0.1, 0.5, 0.9, 1]) {
            expect(Number.isNaN(f(t))).toBe(false);
        }
    });
});

describe('linear', () => {
    const f = linear(16, 32, DOMAIN);

    it('hits the endpoints exactly', () => {
        expect(f(320)).toBe(16);
        expect(f(1920)).toBe(32);
    });

    it('is exact at the midpoint', () => {
        expect(f(1120)).toBeCloseTo(24, 10);
    });

    it('clamps outside the domain', () => {
        expect(f(0)).toBe(16);
        expect(f(5000)).toBe(32);
    });

    it('supports descending ranges (min > max)', () => {
        const g = linear(32, 16, DOMAIN);
        expect(g(320)).toBe(32);
        expect(g(1920)).toBe(16);
        expect(isMonotonicDown(sample(g))).toBe(true);
    });

    it('samples to a monotonic curve', () => {
        expect(isMonotonicUp(sample(f))).toBe(true);
    });
});

describe('exponential / logarithmic', () => {
    const expo = exponential(16, 64, DOMAIN);
    const log = logarithmic(16, 64, DOMAIN);

    it('hit the endpoints exactly', () => {
        expect(expo(320)).toBeCloseTo(16, 10);
        expect(expo(1920)).toBeCloseTo(64, 10);
        expect(log(320)).toBeCloseTo(16, 10);
        expect(log(1920)).toBeCloseTo(64, 10);
    });

    it('exponential lags linear, logarithmic leads it', () => {
        const lin = linear(16, 64, DOMAIN);
        expect(expo(1120)).toBeLessThan(lin(1120));
        expect(log(1120)).toBeGreaterThan(lin(1120));
    });

    it('are monotonic', () => {
        expect(isMonotonicUp(sample(expo))).toBe(true);
        expect(isMonotonicUp(sample(log))).toBe(true);
    });

    it('log(expo(t)) is the identity (same base)', () => {
        // Composition in t-space: log easing applied to expo easing output.
        const base = 4;
        const expoT = (t: number) => (Math.pow(base, t) - 1) / (base - 1);
        const logT = (t: number) => Math.log(1 + t * (base - 1)) / Math.log(base);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            expect(logT(expoT(t))).toBeCloseTo(t, 10);
        }
    });

    it('handle zero endpoints (no geometric blow-up)', () => {
        const g = exponential(0, 100, DOMAIN);
        expect(g(320)).toBe(0);
        expect(g(1920)).toBeCloseTo(100, 10);
    });

    it('reject invalid bases', () => {
        expect(() => exponential(0, 1, DOMAIN, 1)).toThrow();
        expect(() => logarithmic(0, 1, DOMAIN, -2)).toThrow();
    });
});

describe('eased', () => {
    it('hits the endpoints exactly for every named easing', () => {
        for (const name of Object.keys(EASINGS) as (keyof typeof EASINGS)[]) {
            const f = eased(10, 20, name, DOMAIN);
            expect(f(320)).toBeCloseTo(10, 6);
            expect(f(1920)).toBeCloseTo(20, 6);
        }
    });

    it('accepts a custom bezier', () => {
        const f = eased(0, 1, [0.4, 0, 0.2, 1], DOMAIN);
        expect(f(1120)).toBeGreaterThan(0);
        expect(f(1120)).toBeLessThan(1);
    });

    it('is monotonic for monotone easings', () => {
        expect(isMonotonicUp(sample(eased(10, 20, 'ease-in-out', DOMAIN)))).toBe(true);
    });

    it('names the valid easings when given one that does not exist', () => {
        // a misspelling used to fail deep in the maths with "not iterable"
        expect(() => eased(10, 20, 'easeInOut' as never, DOMAIN)).toThrow(/invalid easing/);
        expect(() => eased(10, 20, 'easeInOut' as never, DOMAIN)).toThrow(/'ease-in-out'/);
    });
});

describe('stepped', () => {
    const f = stepped([1, 2, 3], [320, 768, 1280]);

    it('applies value[i] on right-open intervals', () => {
        expect(f(320)).toBe(1);
        expect(f(767)).toBe(1);
        expect(f(768)).toBe(2);
        expect(f(1279)).toBe(2);
        expect(f(1280)).toBe(3);
    });

    it('clamps below the first breakpoint', () => {
        expect(f(100)).toBe(1);
    });

    it('clamps above the last breakpoint', () => {
        expect(f(5000)).toBe(3);
    });

    it('throws on mismatched lengths', () => {
        expect(() => stepped([1, 2], [320])).toThrow(/counts must match/);
    });

    it('throws on empty values', () => {
        expect(() => stepped([], [])).toThrow();
    });
});

describe('piecewise', () => {
    const f = piecewise([
        [320, 8],
        [768, 16],
        [1280, 24],
        [1920, 32],
    ]);

    it('hits every control point exactly', () => {
        expect(f(320)).toBe(8);
        expect(f(768)).toBe(16);
        expect(f(1280)).toBe(24);
        expect(f(1920)).toBe(32);
    });

    it('interpolates linearly inside segments', () => {
        expect(f(544)).toBeCloseTo(12, 10); // midpoint of first segment
    });

    it('clamps outside the control points', () => {
        expect(f(100)).toBe(8);
        expect(f(4000)).toBe(32);
    });

    it('sorts unsorted input points', () => {
        const g = piecewise([
            [1920, 32],
            [320, 8],
        ]);
        expect(g(320)).toBe(8);
        expect(g(1920)).toBe(32);
    });

    it('applies easing per segment', () => {
        const g = piecewise(
            [
                [320, 0],
                [1920, 100],
            ],
            'ease-in',
        );
        expect(g(1120)).toBeLessThan(50); // ease-in lags linear at the midpoint
    });

    it('throws on empty points', () => {
        expect(() => piecewise([])).toThrow();
    });
});

describe('sample', () => {
    it('samples at DEFAULT_WIDTHS by default', () => {
        const c = sample(linear(0, 100, DOMAIN));
        expect(c.size).toBeGreaterThanOrEqual(9);
        expect(c.get(320)).toBe(0);
    });

    it('samples at explicit widths', () => {
        const c = sample(linear(0, 100, DOMAIN), [320, 1920]);
        expect([...c.keys()]).toEqual([320, 1920]);
        expect(c.get(1920)).toBe(100);
    });
});

describe('inverse', () => {
    it('round-trips linear functions', () => {
        const f = linear(16, 32, DOMAIN);
        const w = inverse(f, f(1000), DOMAIN);
        expect(w).toBeDefined();
        expect(w!).toBeCloseTo(1000, 3);
    });

    it('round-trips exponential functions', () => {
        const f = exponential(16, 64, DOMAIN);
        const w = inverse(f, f(900), DOMAIN);
        expect(w).toBeDefined();
        expect(w!).toBeCloseTo(900, 3);
    });

    it('works on descending functions', () => {
        const f = linear(32, 16, DOMAIN);
        const w = inverse(f, 24, DOMAIN);
        expect(w).toBeDefined();
        expect(f(w!)).toBeCloseTo(24, 5);
    });

    it('returns undefined for out-of-range values', () => {
        expect(inverse(linear(16, 32, DOMAIN), 100, DOMAIN)).toBeUndefined();
    });

    it('returns undefined for non-monotone functions', () => {
        const parabola = (w: number) => Math.pow(w - 1120, 2);
        expect(inverse(parabola, 1000, DOMAIN)).toBeUndefined();
    });
});

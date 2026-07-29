import { describe, it, expect, afterEach } from 'vitest';
import { fluid, custom, combine, isResponsiveValue, fluidClamp, type StaticContext } from '../src/value.js';
import { linear, exponential, easeInOut, cubic } from '../src/curves.js';
import { scale, rotate, translate } from '../src/transforms.js';
import { configure, __resetConfig } from '../src/config.js';
import { defineBreakpoints } from '../src/breakpoints.js';

afterEach(__resetConfig);

const CTX: StaticContext = {
    selector: '.el',
    property: 'font-size',
    domain: { min: 320, max: 1920 },
    breakpoints: [320, 768, 1024, 1440, 1920],
    container: false,
    unit: 'px',
};

describe('fluid(number, number)', () => {
    it('resolves linearly across the configured domain', () => {
        const v = fluid(16, 32);
        expect(v.resolve(320)).toBe(16);
        expect(v.resolve(1920)).toBe(32);
        expect(v.resolve(1120)).toBeCloseTo(24, 10);
    });

    it('is branded as a ResponsiveValue', () => {
        expect(isResponsiveValue(fluid(0, 1))).toBe(true);
        expect(isResponsiveValue({ resolve: () => 0 })).toBe(false);
        expect(isResponsiveValue(42)).toBe(false);
    });

    it('supports a domain override via from/to', () => {
        const v = fluid(0, 100, { from: 400, to: 800 });
        expect(v.resolve(400)).toBe(0);
        expect(v.resolve(800)).toBe(100);
        expect(v.resolve(600)).toBeCloseTo(50, 10);
    });

    it('reacts to reconfigured breakpoints (lazy domain)', () => {
        const v = fluid(0, 100);
        configure({ breakpoints: [0, 1000] });
        expect(v.resolve(500)).toBeCloseTo(50, 10);
    });

    it('emits a Utopia clamp() for the linear curve', () => {
        const v = fluid(16, 32);
        const emission = v.toStatic(CTX);
        expect(emission?.declaration).toBe('clamp(16px, calc(12.8px + 1vw), 32px)');
    });

    it('reorders clamp bounds for descending ranges', () => {
        const v = fluid(32, 16);
        const emission = v.toStatic(CTX);
        expect(emission?.declaration).toMatch(/^clamp\(16px, .* 32px\)$/);
    });

    it('emits cqi for container-bound values', () => {
        const v = fluid(16, 32, { container: true, from: 240, to: 820 });
        expect(v.toStatic(CTX)?.declaration).toContain('cqi');
        expect(v.container).toBe(true);
    });

    it('refuses a container-bound value with no range, and says what to write', () => {
        // the silent version of this bug reads as "the library does nothing":
        // the value would walk the viewport's domain, not the container's
        expect(() => fluid(16, 32, { container: true })).toThrow(/how wide that container gets/);
        expect(() => fluid(16, 32, { container: true })).toThrow(/from: <narrowest px>/);
        expect(() => fluid([8, 16, 24], { container: true })).toThrow(/fluid\(\[…\]\)/);
        // an element-driven domain is a range too — that one is allowed
        expect(() => fluid(16, 32, { container: true, from: 240, to: 820 })).not.toThrow();
    });

    it('non-linear curves refuse static emission', () => {
        expect(fluid(16, 32, { curve: 'ease-in' }).toStatic(CTX)).toBeNull();
        expect(exponential(16, 32).toStatic(CTX)).toBeNull();
    });

    it('curves sugar matches fluid with the same curve', () => {
        expect(linear(10, 20).resolve(1120)).toBe(fluid(10, 20).resolve(1120));
        expect(easeInOut(10, 20).resolve(1120)).toBe(fluid(10, 20, { curve: 'ease-in-out' }).resolve(1120));
        expect(cubic(10, 20, [0.4, 0, 0.2, 1]).resolve(700)).toBe(
            fluid(10, 20, { curve: [0.4, 0, 0.2, 1] }).resolve(700),
        );
    });

    it('rejects mixed-type endpoints', () => {
        expect(() => fluid('16px' as never, 32 as never)).toThrow(/numbers or both strings/);
    });
});

describe('fluid(array)', () => {
    it('maps values onto the configured breakpoints', () => {
        const v = fluid([8, 16, 24, 32, 40]); // 5 values over 5 default breakpoints
        expect(v.resolve(320)).toBe(8);
        expect(v.resolve(768)).toBe(16);
        expect(v.resolve(1920)).toBe(40);
        expect(v.resolve(544)).toBeCloseTo(12, 5); // between 320 and 768
    });

    it('works with fewer values than breakpoints', () => {
        defineBreakpoints({ a: 100, b: 200, c: 300 });
        const v = fluid([1, 2]);
        expect(v.resolve(100)).toBe(1);
        expect(v.resolve(200)).toBe(2);
        expect(v.resolve(300)).toBe(2); // clamped past the last point
    });

    it('emits per-segment clamps in media blocks', () => {
        defineBreakpoints({ a: 400, b: 800, c: 1200 });
        const v = fluid([10, 20, 30]);
        const emission = v.toStatic({ ...CTX, domain: { min: 400, max: 1200 }, breakpoints: [400, 800, 1200] });
        expect(emission).not.toBeNull();
        expect(emission!.declaration).toContain('clamp(10px');
        expect(emission!.mediaBlocks).toHaveLength(1);
        expect(emission!.mediaBlocks![0].min).toBe(800);
        expect(emission!.mediaBlocks![0].declaration).toContain('clamp(20px');
    });

    it('rejects empty and non-numeric arrays', () => {
        expect(() => fluid([])).toThrow();
        expect(() => fluid(['a'] as never)).toThrow(/numbers only/);
    });
});

describe('custom and combine', () => {
    it('custom wraps a width function and stays dynamic', () => {
        const v = custom((w) => w / 100);
        expect(v.resolve(500)).toBe(5);
        expect(v.toStatic(CTX)).toBeNull();
    });

    it('combine space-joins parts', () => {
        const v = combine([scale(fluid(0.8, 1.2)), rotate(fluid(0, 45)), 'translateZ(0)']);
        const at320 = v.resolve(320) as string;
        expect(at320).toBe('scale(0.8) rotate(0deg) translateZ(0)');
        const at1920 = v.resolve(1920) as string;
        expect(at1920).toBe('scale(1.2) rotate(45deg) translateZ(0)');
    });

    it('translate applies px defaults', () => {
        const v = translate(fluid(0, 100), 10);
        expect(v.resolve(1920)).toBe('translate(100px, 10px)');
    });
});

describe('fluidClamp formula', () => {
    it('produces the documented Utopia numbers', () => {
        // slope = (64-16)/(1920-320) = 0.03; intercept = 16 - 0.03*320 = 6.4
        expect(fluidClamp(16, 64, { min: 320, max: 1920 }, 'px', false)).toBe(
            'clamp(16px, calc(6.4px + 3vw), 64px)',
        );
    });

    it('normalizes negative zero', () => {
        expect(fluidClamp(0, 16, { min: 0, max: 1600 }, 'px', false)).toBe(
            'clamp(0px, calc(0px + 1vw), 16px)',
        );
    });
});

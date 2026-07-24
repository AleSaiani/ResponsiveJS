// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { defineBreakpoints } from '../src/breakpoints.js';
import { __resetConfig, bpWidth } from '../src/config.js';
import { __resetViewportHub } from '../src/viewport.js';
import { installMatchMediaStub } from './helpers.js';

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

describe('defineBreakpoints — typed API', () => {
    it('configures the runtime and returns names in ascending width order', () => {
        const bp = defineBreakpoints({ desktop: 1024, mobile: 320, tablet: 768 } as const);
        expect(bp.names).toEqual(['mobile', 'tablet', 'desktop']);
        expect(bp.width('tablet')).toBe(768);
        expect(bpWidth('tablet')).toBe(768); // side effect: names resolve globally too
    });

    it('below/above/between resolve like the string-based breakpoint API', () => {
        const bp = defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1024 } as const);
        const stack = bp.below('tablet', 'column', 'row');
        expect(stack.resolve(320)).toBe('column');
        expect(stack.resolve(900)).toBe('row');

        const wide = bp.above('desktop', 24, 12);
        expect(wide.resolve(1200)).toBe(24);
        expect(wide.resolve(800)).toBe(12);

        const mid = bp.between('tablet', 'desktop', 'mid', 'other');
        expect(mid.resolve(800)).toBe('mid');
        expect(mid.resolve(320)).toBe('other');
    });

    it('match picks the largest matching named breakpoint', () => {
        const bp = defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1024 } as const);
        const size = bp.match({ mobile: 14, desktop: 18 });
        expect(size.resolve(400)).toBe(14);
        expect(size.resolve(1400)).toBe(18);
    });

    it('matches() is a reactive media-query signal with dispose', () => {
        const mm = installMatchMediaStub(1200);
        const bp = defineBreakpoints({ tablet: 768 } as const);
        const { signal, dispose } = bp.matches('tablet');
        expect(signal.get()).toBe(true);
        mm.setWidth(500);
        expect(signal.get()).toBe(false);
        dispose();
        mm.uninstall();
    });

    it('typos on breakpoint names fail at compile time', () => {
        const bp = defineBreakpoints({ mobile: 320, tablet: 768 } as const);
        // @ts-expect-error 'mobil' is not a defined breakpoint name
        expect(() => bp.width('mobil')).toBeDefined();
        // @ts-expect-error unknown name in below()
        bp.below('phablet', 1);
    });
});

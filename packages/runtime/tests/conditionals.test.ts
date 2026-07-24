import { describe, it, expect, afterEach } from 'vitest';
import { when, whenInRange, breakpoint } from '../src/conditionals.js';
import { fluid, type StaticContext } from '../src/value.js';
import { __resetConfig } from '../src/config.js';
import { defineBreakpoints } from '../src/breakpoints.js';
import { emitCSS } from '../src/static.js';

describe('finding — breakpoint.below without fallback never leaks globally', () => {
    it('emits ONLY a max-width block, no unguarded declaration', () => {
        const { css, dynamicRest } = emitCSS('.x', { display: breakpoint.below(768, 'block') });
        expect(Object.keys(dynamicRest)).toHaveLength(0);
        expect(css).toContain('@media (max-width: 767px)');
        expect(css).toContain('display: block;');
        // the base (unguarded) rule must not carry the declaration
        const baseRule = css.split('@media')[0];
        expect(baseRule).not.toContain('display: block');
    });

    it('with a fallback the mobile-first split is unchanged', () => {
        const { css } = emitCSS('.x', { display: breakpoint.below(768, 'none', 'flex') });
        expect(css).toContain('display: none;');
        expect(css).toContain('@media (min-width: 768px)');
        expect(css).toContain('display: flex;');
    });
});

afterEach(__resetConfig);

const CTX: StaticContext = {
    selector: '.el',
    property: 'padding',
    domain: { min: 320, max: 1920 },
    breakpoints: [320, 768, 1024, 1440, 1920],
    container: false,
    unit: 'px',
};

describe('when', () => {
    it('binary form picks by predicate', () => {
        const v = when((w) => w > 768, 'block', 'none');
        expect(v.resolve(1024)).toBe('block');
        expect(v.resolve(320)).toBe('none');
    });

    it('cases form: first match wins', () => {
        const v = when([
            [(w) => w < 480, 8],
            [(w) => w < 1024, 16],
            [(w) => w >= 1024, 32],
        ]);
        expect(v.resolve(400)).toBe(8);
        expect(v.resolve(800)).toBe(16);
        expect(v.resolve(1400)).toBe(32);
    });

    it('nested ResponsiveValue branches resolve at the same width', () => {
        const v = when((w) => w > 768, fluid(240, 320), 0);
        expect(v.resolve(320)).toBe(0);
        expect(v.resolve(1920)).toBe(320);
    });

    it('is never static (arbitrary lambdas)', () => {
        expect(when(() => true, 1, 2).toStatic(CTX)).toBeNull();
    });
});

describe('whenInRange', () => {
    it('applies inside the range, falls back outside', () => {
        const v = whenInRange(768, 1024, 'tablet', 'other');
        expect(v.resolve(800)).toBe('tablet');
        expect(v.resolve(1025)).toBe('other');
        expect(v.resolve(767)).toBe('other');
    });

    it('emits min+max media blocks for primitive branches', () => {
        const v = whenInRange(768, 1024, 16, 4);
        const emission = v.toStatic(CTX);
        expect(emission?.declaration).toBe('4px');
        expect(emission?.mediaBlocks).toEqual([{ min: 768, max: 1024, declaration: '16px' }]);
    });

    it('stays dynamic when a branch is a ResponsiveValue', () => {
        expect(whenInRange(0, 100, fluid(1, 2)).toStatic(CTX)).toBeNull();
    });
});

describe('breakpoint.below / above / between', () => {
    it('below switches at the threshold (numeric)', () => {
        const v = breakpoint.below(768, 'none', 'flex');
        expect(v.resolve(767)).toBe('none');
        expect(v.resolve(768)).toBe('flex');
    });

    it('resolves named breakpoints through config', () => {
        defineBreakpoints({ mobile: 320, tablet: 768 });
        const v = breakpoint.below('tablet', 'column', 'row');
        expect(v.resolve(500)).toBe('column');
        expect(v.resolve(900)).toBe('row');
    });

    it('unknown names throw with the known list', () => {
        defineBreakpoints({ mobile: 320 });
        const v = breakpoint.below('desktop', 1, 2);
        expect(() => v.resolve(100)).toThrow(/Known: mobile/);
    });

    it('below emits mobile-first static CSS', () => {
        const v = breakpoint.below(768, 'none', 'flex');
        const emission = v.toStatic({ ...CTX, property: 'display', unit: '' });
        expect(emission?.declaration).toBe('none');
        expect(emission?.mediaBlocks).toEqual([{ min: 768, declaration: 'flex' }]);
    });

    it('above emits the inverse blocks', () => {
        const v = breakpoint.above(1024, 'row', 'column');
        const emission = v.toStatic({ ...CTX, property: 'flex-direction', unit: '' });
        expect(emission?.declaration).toBe('column');
        expect(emission?.mediaBlocks).toEqual([{ min: 1024, declaration: 'row' }]);
    });

    it('between applies inside [lo, hi)', () => {
        const v = breakpoint.between(768, 1024, 'md', 'other');
        expect(v.resolve(768)).toBe('md');
        expect(v.resolve(1023)).toBe('md');
        expect(v.resolve(1024)).toBe('other');
    });

    it('nested fluid branches force dynamic', () => {
        const v = breakpoint.below(768, '100%', fluid(240, 320));
        expect(v.toStatic({ ...CTX, property: 'width', unit: '' })).toBeNull();
        expect(v.resolve(1920)).toBe(320);
    });
});

describe('breakpoint.match', () => {
    it('largest matching breakpoint wins', () => {
        defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1024, wide: 1440 });
        const v = breakpoint.match({ mobile: 14, tablet: 16, desktop: 18, wide: 20 });
        expect(v.resolve(320)).toBe(14);
        expect(v.resolve(1000)).toBe(16);
        expect(v.resolve(1024)).toBe(18);
        expect(v.resolve(2000)).toBe(20);
    });

    it('falls back to the smallest below its width', () => {
        defineBreakpoints({ tablet: 768, desktop: 1024 });
        const v = breakpoint.match({ tablet: 1, desktop: 2 });
        expect(v.resolve(100)).toBe(1);
    });

    it('emits base + min-width blocks', () => {
        defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1024 });
        const v = breakpoint.match({ mobile: 14, tablet: 16, desktop: 18 });
        const emission = v.toStatic(CTX);
        expect(emission?.declaration).toBe('14px');
        expect(emission?.mediaBlocks).toEqual([
            { min: 768, declaration: '16px' },
            { min: 1024, declaration: '18px' },
        ]);
    });

    it('rejects an empty map', () => {
        expect(() => breakpoint.match({})).toThrow();
    });
});

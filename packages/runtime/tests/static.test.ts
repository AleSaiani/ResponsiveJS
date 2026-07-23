import { describe, it, expect, afterEach } from 'vitest';
import { emitCSS, toKebab, declarationValue, UNITLESS } from '../src/static.js';
import { fluid, custom } from '../src/value.js';
import { breakpoint, when, whenInRange } from '../src/conditionals.js';
import { configure, defineBreakpoints, __resetConfig } from '../src/config.js';

afterEach(__resetConfig);

describe('toKebab / declarationValue', () => {
    it('converts camelCase to kebab-case', () => {
        expect(toKebab('fontSize')).toBe('font-size');
        expect(toKebab('gridTemplateColumns')).toBe('grid-template-columns');
        expect(toKebab('padding')).toBe('padding');
    });

    it('applies the default unit to numbers except unitless props', () => {
        expect(declarationValue(16, 'font-size', 'px')).toBe('16px');
        expect(declarationValue(0.5, 'opacity', 'px')).toBe('0.5');
        expect(declarationValue(700, 'font-weight', 'px')).toBe('700');
        expect(declarationValue(0, 'margin', 'px')).toBe('0');
    });

    it('passes strings through untouched', () => {
        expect(declarationValue('50%', 'width', 'px')).toBe('50%');
    });

    it('UNITLESS covers the usual suspects', () => {
        for (const p of ['opacity', 'z-index', 'font-weight', 'line-height', 'flex-grow']) {
            expect(UNITLESS.has(p), p).toBe(true);
        }
    });
});

describe('emitCSS — split correctness', () => {
    it('emits linear fluid as clamp and keeps eased fluid dynamic', () => {
        const { css, dynamicRest } = emitCSS('.hero', {
            fontSize: fluid(16, 32),
            padding: fluid(8, 32, { curve: 'ease-in' }),
        });
        expect(css).toContain('font-size: clamp(16px, calc(12.8px + 1vw), 32px);');
        expect(css).not.toContain('padding');
        expect(Object.keys(dynamicRest)).toEqual(['padding']);
    });

    it('primitives always land in CSS', () => {
        const { css, dynamicRest } = emitCSS('.el', { display: 'grid', zIndex: 5, margin: 12 });
        expect(css).toContain('display: grid;');
        expect(css).toContain('z-index: 5;');
        expect(css).toContain('margin: 12px;');
        expect(Object.keys(dynamicRest)).toHaveLength(0);
    });

    it('custom functions stay dynamic', () => {
        const { css, dynamicRest } = emitCSS('.el', { width: custom((w) => w / 2) });
        expect(css).toBe('');
        expect(Object.keys(dynamicRest)).toEqual(['width']);
    });

    it('breakpoint switches become @media blocks', () => {
        const { css, dynamicRest } = emitCSS('.nav', {
            display: breakpoint.below(768, 'none', 'flex'),
        });
        expect(css).toContain('.nav {\n    display: none;');
        expect(css).toContain('@media (min-width: 768px)');
        expect(css).toContain('display: flex;');
        expect(Object.keys(dynamicRest)).toHaveLength(0);
    });

    it('predicate when() stays dynamic', () => {
        const { dynamicRest } = emitCSS('.el', { display: when((w) => w > 500, 'a', 'b') });
        expect(Object.keys(dynamicRest)).toEqual(['display']);
    });

    it('whenInRange emits min+max media conditions', () => {
        const { css } = emitCSS('.el', { padding: whenInRange(768, 1024, 16, 4) });
        expect(css).toContain('@media (min-width: 768px) and (max-width: 1024px)');
        expect(css).toContain('padding: 16px;');
    });

    it('groups multiple props into shared media blocks and sorts by min-width', () => {
        defineBreakpoints({ sm: 480, md: 768 });
        const { css } = emitCSS('.el', {
            display: breakpoint.above(768, 'flex', 'block'),
            gap: breakpoint.above(480, 8, 4),
        });
        const posSm = css.indexOf('(min-width: 480px)');
        const posMd = css.indexOf('(min-width: 768px)');
        expect(posSm).toBeGreaterThan(-1);
        expect(posMd).toBeGreaterThan(posSm);
    });

    it('per-breakpoint arrays produce piecewise clamps', () => {
        defineBreakpoints({ a: 400, b: 800, c: 1200 });
        const { css, dynamicRest } = emitCSS('.el', { margin: fluid([10, 20, 30]) });
        expect(Object.keys(dynamicRest)).toHaveLength(0);
        expect(css).toContain('margin: clamp(10px');
        expect(css).toContain('@media (min-width: 800px)');
        expect(css).toContain('clamp(20px');
    });

    it('output is deterministic', () => {
        const map = { fontSize: fluid(16, 32), display: 'block' };
        expect(emitCSS('.x', map).css).toBe(emitCSS('.x', map).css);
    });

    it('respects useMediaQueries=false consumers by still emitting on demand', () => {
        // emitCSS itself is unconditional — the split policy lives in apply.
        configure({ useMediaQueries: false });
        const { css } = emitCSS('.el', { fontSize: fluid(1, 2) });
        expect(css).toContain('clamp');
    });
});

import { describe, it, expect, afterEach } from 'vitest';
import { typography } from '../src/typography.js';
import { __resetConfig } from '../src/config.js';

afterEach(__resetConfig);

describe('typography.scale', () => {
    it('resolves kebab-case names to core ratios', () => {
        expect(typography.scale('major-third').ratio).toBe(1.25);
        expect(typography.scale('golden-ratio').ratio).toBe(1.618);
    });

    it('throws on unknown names listing the valid ones', () => {
        expect(() => typography.scale('mega-scale')).toThrow(/major-third/);
    });

    it('accepts custom ratio and base', () => {
        const s = typography.scale({ ratio: 2, base: [10, 12] });
        expect(s.ratio).toBe(2);
        expect(s.size(1).resolve(320)).toBe(20);
        expect(s.size(1).resolve(1920)).toBe(24);
    });

    it('size(0) is the fluid base', () => {
        const s = typography.scale('major-third');
        expect(s.size(0).resolve(320)).toBe(16);
        expect(s.size(0).resolve(1920)).toBe(18);
    });

    it('size grows by the ratio per level', () => {
        const s = typography.scale('major-third');
        expect(s.size(2).resolve(320)).toBeCloseTo(16 * 1.25 * 1.25, 1);
    });

    it('negative levels shrink below the base', () => {
        const s = typography.scale({ ratio: 1.25 });
        expect(s.size(-1).resolve(320)).toBeCloseTo(16 / 1.25, 1);
    });

    it('lineHeight tightens for display sizes (1.5 → 1.2)', () => {
        const s = typography.scale('major-third');
        const bodyLh = s.lineHeight(0).resolve(320) as number;
        const displayLh = s.lineHeight(4).resolve(320) as number;
        const bodySize = s.size(0).resolve(320) as number;
        const displaySize = s.size(4).resolve(320) as number;
        expect(bodyLh / bodySize).toBeCloseTo(1.5, 2);
        expect(displayLh / displaySize).toBeCloseTo(1.2, 2);
    });

    it('spacing is half the size', () => {
        const s = typography.scale('major-third');
        expect(s.spacing(0).resolve(320)).toBeCloseTo(8, 1);
    });

    it('rhythm passes through unitless', () => {
        expect(typography.rhythm(1.5)).toBe(1.5);
    });
});

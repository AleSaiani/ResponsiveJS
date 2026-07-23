import { describe, it, expect, afterEach } from 'vitest';
import { grid, space } from '../src/layout.js';
import { isResponsiveValue, type ResponsiveValue } from '../src/value.js';
import { __resetConfig } from '../src/config.js';

afterEach(() => {
    space.__reset();
    __resetConfig();
});

describe('grid.adaptive', () => {
    it('without maxColumns is pure CSS (auto-fit/minmax)', () => {
        const map = grid.adaptive({ minColumnWidth: 250 });
        expect(map.display).toBe('grid');
        expect(map.gridTemplateColumns).toBe('repeat(auto-fit, minmax(min(250px, 100%), 1fr))');
    });

    it('with maxColumns computes the column count dynamically', () => {
        const map = grid.adaptive({ minColumnWidth: 300, maxColumns: 4 });
        const cols = map.gridTemplateColumns as ResponsiveValue;
        expect(isResponsiveValue(cols)).toBe(true);
        expect(cols.resolve(350)).toBe('repeat(1, 1fr)');
        expect(cols.resolve(950)).toBe('repeat(3, 1fr)');
        expect(cols.resolve(5000)).toBe('repeat(4, 1fr)'); // capped
        expect(cols.resolve(100)).toBe('repeat(1, 1fr)'); // floor 1
    });

    it('threads the gap value through', () => {
        const map = grid.adaptive({ minColumnWidth: 200, gap: 16 });
        expect(map.gap).toBe(16);
    });
});

describe('space', () => {
    it('levels follow base·ratio^(n-1)', () => {
        expect(space.level(1)).toBe(8);
        expect(space.level(2)).toBe(12);
        expect(space.level(3)).toBe(18);
    });

    it('is reconfigurable', () => {
        space.config({ base: 4, ratio: 2 });
        expect(space.level(1)).toBe(4);
        expect(space.level(3)).toBe(16);
    });

    it('inset produces padding shorthand', () => {
        expect(space.inset(2)).toEqual({ padding: 12 });
        expect(space.inset(2, 4)).toEqual({ padding: '12px 27px' });
    });

    it('stack produces margin-bottom', () => {
        expect(space.stack(1)).toEqual({ marginBottom: 8 });
    });

    it('inline with one level is a number, with two is fluid', () => {
        expect(space.inline(1)).toBe(8);
        const v = space.inline(1, 3);
        expect(isResponsiveValue(v)).toBe(true);
        expect((v as ResponsiveValue).resolve(320)).toBe(8);
        expect((v as ResponsiveValue).resolve(1920)).toBe(18);
    });

    it('fluid spans two levels of the scale', () => {
        const v = space.fluid(1, 4);
        expect(v.resolve(320)).toBe(8);
        expect(v.resolve(1920)).toBe(27);
    });

    it('rhythm multiplies the baseline', () => {
        expect(space.rhythm(2)).toBe(48);
        space.config({ lineHeight: 20 });
        expect(space.rhythm(1.5)).toBe(30);
    });
});

import { describe, it, expect } from 'vitest';
import { curveToSvg } from '../src/curve-svg.js';

describe('curveToSvg', () => {
    it('maps widths to x and inverts values on y (bigger value = higher on screen)', () => {
        const svg = curveToSvg(new Map([[320, 16], [768, 24], [1280, 32]]), 300, 130, 18);
        expect(svg.points).toHaveLength(3);
        expect(svg.path.startsWith('M ')).toBe(true);
        expect((svg.path.match(/L /g) ?? []).length).toBe(2);
        // x grows with width
        expect(svg.points[0].x).toBeLessThan(svg.points[2].x);
        // y shrinks (screen-up) as the value grows
        expect(svg.points[0].y).toBeGreaterThan(svg.points[2].y);
        expect(svg.minValue).toBe(16);
        expect(svg.maxValue).toBe(32);
    });

    it('a flat curve stays inside the padded box (no division blowup)', () => {
        const svg = curveToSvg(new Map([[320, 20], [1280, 20]]), 300, 130, 18);
        for (const p of svg.points) {
            expect(p.y).toBeGreaterThanOrEqual(18);
            expect(p.y).toBeLessThanOrEqual(130 - 18);
        }
    });

    it('empty curve renders nothing', () => {
        expect(curveToSvg(new Map()).path).toBe('');
    });
});

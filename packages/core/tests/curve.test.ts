import { describe, it, expect } from 'vitest';
import { isMonotonicUp, isMonotonicDown, maxJump, isContinuous, discontinuities, valueRange, ratio, ratioInRange } from '../src/curve.js';

describe('isMonotonicUp', () => {
    it('strictly increasing', () => {
        expect(isMonotonicUp(new Map([[320, 14], [768, 16], [1920, 20]]))).toBe(true);
    });
    it('constant is monotonic up', () => {
        expect(isMonotonicUp(new Map([[320, 16], [768, 16], [1920, 16]]))).toBe(true);
    });
    it('decreasing is not monotonic up', () => {
        expect(isMonotonicUp(new Map([[320, 20], [768, 16], [1920, 14]]))).toBe(false);
    });
    it('small dip within tolerance', () => {
        expect(isMonotonicUp(new Map([[320, 16], [768, 16.3], [1920, 16.1]]), 0.5)).toBe(true);
    });
    it('dip exceeding tolerance', () => {
        expect(isMonotonicUp(new Map([[320, 16], [768, 18], [1920, 16]]), 0.5)).toBe(false);
    });
});

describe('isMonotonicDown', () => {
    it('strictly decreasing', () => {
        expect(isMonotonicDown(new Map([[320, 20], [768, 16], [1920, 14]]))).toBe(true);
    });
    it('increasing is not monotonic down', () => {
        expect(isMonotonicDown(new Map([[320, 14], [768, 16], [1920, 20]]))).toBe(false);
    });
});

describe('maxJump', () => {
    it('finds largest discontinuity', () => {
        const result = maxJump(new Map([[320, 100], [768, 200], [1024, 190], [1920, 400]]));
        expect(result.jump).toBe(210); // 190 → 400
        expect(result.fromWidth).toBe(1024);
        expect(result.toWidth).toBe(1920);
    });
    it('constant curve has zero jump', () => {
        expect(maxJump(new Map([[320, 50], [768, 50], [1920, 50]])).jump).toBe(0);
    });
});

describe('isContinuous', () => {
    it('smooth curve is continuous', () => {
        expect(isContinuous(new Map([[320, 100], [768, 150], [1920, 200]]), 60)).toBe(true);
    });
    it('large jump breaks continuity', () => {
        expect(isContinuous(new Map([[320, 100], [768, 300], [1920, 350]]), 100)).toBe(false);
    });
});

describe('discontinuities', () => {
    it('finds all jumps above threshold', () => {
        const result = discontinuities(
            new Map([[320, 100], [375, 105], [768, 300], [1024, 310], [1920, 500]]),
            50
        );
        expect(result).toHaveLength(2);
        expect(result[0].fromWidth).toBe(375);
        expect(result[0].toWidth).toBe(768);
        expect(result[1].fromWidth).toBe(1024);
        expect(result[1].toWidth).toBe(1920);
    });
});

describe('valueRange', () => {
    it('computes min, max, range', () => {
        const r = valueRange(new Map([[320, 14], [768, 18], [1920, 24]]));
        expect(r.min).toBe(14);
        expect(r.max).toBe(24);
        expect(r.range).toBe(10);
    });
});

describe('ratio', () => {
    it('computes a/b at each width', () => {
        const a = new Map([[320, 100], [768, 200], [1920, 400]]);
        const b = new Map([[320, 300], [768, 600], [1920, 1200]]);
        const r = ratio(a, b);
        expect(r.get(320)).toBeCloseTo(1 / 3);
        expect(r.get(768)).toBeCloseTo(1 / 3);
        expect(r.get(1920)).toBeCloseTo(1 / 3);
    });
});

describe('ratioInRange', () => {
    it('constant ratio within bounds', () => {
        const a = new Map([[320, 100], [1920, 400]]);
        const b = new Map([[320, 300], [1920, 1200]]);
        expect(ratioInRange(a, b, 0.3, 0.4)).toBe(true);
    });
    it('ratio outside bounds', () => {
        const a = new Map([[320, 100], [1920, 600]]);
        const b = new Map([[320, 300], [1920, 1200]]);
        expect(ratioInRange(a, b, 0.3, 0.4)).toBe(false); // 600/1200 = 0.5
    });
});

import { describe, it, expect } from 'vitest';
import { rect, contains, overlapsVertically, overlaps, distance, horizontalGap, verticalGap, sameHeight, sameWidth, alignedLeft, alignedTop, inViewport, widthRatio } from '../src/rect.js';

describe('rect', () => {
    it('creates rect with derived properties', () => {
        const r = rect(10, 20, 100, 50);
        expect(r.right).toBe(110);
        expect(r.bottom).toBe(70);
        expect(r.centerX).toBe(60);
        expect(r.centerY).toBe(45);
        expect(r.area).toBe(5000);
    });
});

describe('contains', () => {
    it('child fully inside parent', () => {
        expect(contains(rect(0, 0, 100, 100), rect(10, 10, 80, 80))).toBe(true);
    });
    it('child exceeds right', () => {
        expect(contains(rect(0, 0, 100, 100), rect(10, 10, 100, 80))).toBe(false);
    });
    it('child exceeds bottom', () => {
        expect(contains(rect(0, 0, 100, 100), rect(10, 10, 80, 100))).toBe(false);
    });
    it('child at exact boundary (with tolerance)', () => {
        expect(contains(rect(0, 0, 100, 100), rect(0, 0, 100, 100), 1)).toBe(true);
    });
    it('child 1px outside (within tolerance)', () => {
        expect(contains(rect(0, 0, 100, 100), rect(-1, -1, 102, 102), 1)).toBe(true);
    });
    it('child 2px outside (exceeds tolerance)', () => {
        expect(contains(rect(0, 0, 100, 100), rect(-2, 0, 100, 100), 1)).toBe(false);
    });
});

describe('overlapsVertically', () => {
    it('same line (identical top)', () => {
        expect(overlapsVertically(rect(0, 10, 50, 30), rect(60, 10, 50, 30))).toBe(true);
    });
    it('centered alignment (different height)', () => {
        // Button at y=15 h=20, input at y=10 h=30 → overlap = 20px, minH = 20 → 100%
        expect(overlapsVertically(rect(0, 15, 50, 20), rect(60, 10, 50, 30))).toBe(true);
    });
    it('no vertical overlap', () => {
        expect(overlapsVertically(rect(0, 0, 50, 20), rect(60, 50, 50, 20))).toBe(false);
    });
    it('minimal overlap (< 50%)', () => {
        // a: y=0 h=20 (bottom=20), b: y=15 h=20 (top=15) → overlap=5, minH=20 → 25% < 50%
        expect(overlapsVertically(rect(0, 0, 50, 20), rect(60, 15, 50, 20))).toBe(false);
    });
});

describe('overlaps', () => {
    it('overlapping rects', () => {
        expect(overlaps(rect(0, 0, 50, 50), rect(25, 25, 50, 50))).toBe(true);
    });
    it('non-overlapping rects', () => {
        expect(overlaps(rect(0, 0, 50, 50), rect(60, 0, 50, 50))).toBe(false);
    });
    it('touching rects (not overlapping)', () => {
        expect(overlaps(rect(0, 0, 50, 50), rect(50, 0, 50, 50))).toBe(false);
    });
});

describe('distance', () => {
    it('same position = 0', () => {
        expect(distance(rect(0, 0, 10, 10), rect(0, 0, 10, 10))).toBe(0);
    });
    it('horizontal distance', () => {
        // centers at (50, 50) and (150, 50) → distance = 100
        expect(distance(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(100);
    });
    it('diagonal distance', () => {
        // centers at (5, 5) and (8, 9) → sqrt(9+16) = 5
        expect(distance(rect(0, 0, 10, 10), rect(3, 4, 10, 10))).toBe(5);
    });
});

describe('gaps', () => {
    it('horizontal gap between separated rects', () => {
        expect(horizontalGap(rect(0, 0, 50, 50), rect(70, 0, 50, 50))).toBe(20);
    });
    it('horizontal gap when overlapping', () => {
        expect(horizontalGap(rect(0, 0, 50, 50), rect(30, 0, 50, 50))).toBe(-20);
    });
    it('vertical gap', () => {
        expect(verticalGap(rect(0, 0, 50, 50), rect(0, 70, 50, 50))).toBe(20);
    });
});

describe('alignment', () => {
    it('sameHeight within tolerance', () => {
        expect(sameHeight(rect(0, 0, 100, 44), rect(0, 0, 100, 44))).toBe(true);
        expect(sameHeight(rect(0, 0, 100, 44), rect(0, 0, 100, 46), 2)).toBe(true);
        expect(sameHeight(rect(0, 0, 100, 44), rect(0, 0, 100, 47), 2)).toBe(false);
    });
    it('sameWidth', () => {
        expect(sameWidth(rect(0, 0, 100, 50), rect(0, 0, 101, 50))).toBe(true);
        expect(sameWidth(rect(0, 0, 100, 50), rect(0, 0, 103, 50))).toBe(false);
    });
    it('alignedLeft', () => {
        expect(alignedLeft(rect(10, 0, 50, 50), rect(10, 60, 50, 50))).toBe(true);
        expect(alignedLeft(rect(10, 0, 50, 50), rect(12, 60, 50, 50), 1)).toBe(false);
    });
    it('alignedTop', () => {
        expect(alignedTop(rect(0, 10, 50, 50), rect(60, 10, 50, 50))).toBe(true);
    });
});

describe('inViewport', () => {
    it('fully inside', () => {
        expect(inViewport(rect(10, 10, 100, 50), 1280)).toBe(true);
    });
    it('exceeds right edge', () => {
        expect(inViewport(rect(1200, 0, 100, 50), 1280)).toBe(false);
    });
    it('exceeds left edge', () => {
        expect(inViewport(rect(-10, 0, 100, 50), 1280)).toBe(false);
    });
    it('at exact boundary', () => {
        expect(inViewport(rect(0, 0, 1280, 50), 1280)).toBe(true);
    });
});

describe('widthRatio', () => {
    it('1:3 ratio', () => {
        expect(widthRatio(rect(0, 0, 100, 50), rect(0, 0, 300, 50))).toBeCloseTo(1 / 3);
    });
    it('equal ratio', () => {
        expect(widthRatio(rect(0, 0, 100, 50), rect(0, 0, 100, 50))).toBe(1);
    });
});

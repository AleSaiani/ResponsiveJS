import { describe, it, expect } from 'vitest';
import { detectScale, fitsScale, usesTokens, SCALES } from '../src/typography.js';

describe('detectScale', () => {
    it('detects perfect major third scale', () => {
        const base = 16;
        const ratio = SCALES.majorThird; // 1.250
        const sizes = [base, base * ratio, base * ratio ** 2, base * ratio ** 3];
        const result = detectScale(sizes);

        expect(result.base).toBe(16);
        expect(result.ratio).toBeCloseTo(1.25, 2);
        expect(result.deviation).toBeLessThan(0.01);
    });

    it('detects golden ratio scale', () => {
        const base = 14;
        const r = SCALES.goldenRatio;
        const sizes = [base, base * r, base * r ** 2];
        const result = detectScale(sizes);

        expect(result.ratio).toBeCloseTo(1.618, 2);
    });

    it('handles single size', () => {
        const result = detectScale([16]);
        expect(result.base).toBe(16);
        expect(result.ratio).toBe(1);
    });

    it('handles unsorted input', () => {
        const sizes = [32, 16, 20, 25];
        const result = detectScale(sizes);
        expect(result.base).toBe(16);
        expect(result.ratio).toBeGreaterThan(1);
    });
});

describe('fitsScale', () => {
    it('recognizes perfect major second scale', () => {
        const base = 16;
        const r = SCALES.majorSecond;
        const sizes = [base, base * r, base * r ** 2, base * r ** 3];
        const result = fitsScale(sizes);

        expect(result.fits).toBe(true);
        expect(result.closest).toBe('majorSecond');
    });

    it('recognizes perfect fourth scale', () => {
        const base = 12;
        const r = SCALES.perfectFourth;
        const sizes = [base, base * r, base * r ** 2];
        const result = fitsScale(sizes);

        expect(result.fits).toBe(true);
        expect(result.closest).toBe('perfectFourth');
    });

    it('rejects random sizes', () => {
        const sizes = [12, 17, 23, 41];
        const result = fitsScale(sizes, 0.03);
        expect(result.fits).toBe(false);
    });

    it('handles two sizes', () => {
        const result = fitsScale([16, 24]);
        expect(result.fits).toBe(true);
    });

    it('returns deviation info', () => {
        const sizes = [16, 20, 25, 31]; // ~major third
        const result = fitsScale(sizes);
        expect(result.deviation).toBeDefined();
        expect(result.closest).toBeDefined();
    });
});

describe('usesTokens', () => {
    const tokens = [0, 4, 8, 12, 16, 24, 32, 48];

    it('accepts values that match tokens', () => {
        expect(usesTokens([8, 16, 24, 0], tokens).valid).toBe(true);
    });

    it('rejects values not in tokens', () => {
        const result = usesTokens([8, 14, 24], tokens); // 14 is 2 from both 12 and 16, exceeds tolerance 1
        expect(result.valid).toBe(false);
        expect(result.outliers).toContain(14);
    });

    it('allows tolerance', () => {
        expect(usesTokens([8, 14.5, 24], tokens, 1).valid).toBe(false); // 14.5 is 1.5 from both 12 and 16
        expect(usesTokens([8, 16.5, 24], tokens, 1).valid).toBe(true);  // 16.5 is 0.5 from 16
    });

    it('ignores zero values', () => {
        expect(usesTokens([0, 0, 0], tokens).valid).toBe(true);
    });

    it('returns empty outliers when all match', () => {
        expect(usesTokens([4, 8, 16], tokens).outliers).toEqual([]);
    });
});

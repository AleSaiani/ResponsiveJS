import { describe, it, expect } from 'vitest';
import { mean, stddev, cv, isUniform, gaps, min, max, range } from '../src/stats.js';

describe('mean', () => {
    it('average of values', () => {
        expect(mean([10, 20, 30])).toBe(20);
    });
    it('single value', () => {
        expect(mean([42])).toBe(42);
    });
    it('empty array', () => {
        expect(mean([])).toBe(0);
    });
});

describe('stddev', () => {
    it('identical values = 0', () => {
        expect(stddev([16, 16, 16])).toBe(0);
    });
    it('known stddev', () => {
        // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, variance=4, stddev=2
        expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    });
    it('single value = 0', () => {
        expect(stddev([42])).toBe(0);
    });
});

describe('cv (coefficient of variation)', () => {
    it('uniform values = 0', () => {
        expect(cv([16, 16, 16])).toBe(0);
    });
    it('moderate variation', () => {
        // [8, 10, 12] → mean=10, stddev≈1.633, cv≈0.163
        expect(cv([8, 10, 12])).toBeCloseTo(0.163, 2);
    });
});

describe('isUniform', () => {
    it('identical values are uniform', () => {
        expect(isUniform([16, 16, 16])).toBe(true);
    });
    it('slightly varied but within threshold', () => {
        expect(isUniform([15, 16, 16, 17], 0.1)).toBe(true);
    });
    it('too much variation', () => {
        expect(isUniform([10, 20, 30], 0.1)).toBe(false);
    });
});

describe('gaps', () => {
    it('computes distances between sorted values', () => {
        expect(gaps([0, 16, 32, 48])).toEqual([16, 16, 16]);
    });
    it('unsorted input gets sorted', () => {
        expect(gaps([48, 0, 32, 16])).toEqual([16, 16, 16]);
    });
    it('non-uniform gaps', () => {
        expect(gaps([0, 10, 30, 60])).toEqual([10, 20, 30]);
    });
});

describe('min/max/range', () => {
    it('basic operations', () => {
        const v = [5, 2, 8, 1, 9];
        expect(min(v)).toBe(1);
        expect(max(v)).toBe(9);
        expect(range(v)).toBe(8);
    });
});

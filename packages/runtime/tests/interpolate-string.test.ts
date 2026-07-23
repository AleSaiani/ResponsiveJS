import { describe, it, expect, afterEach } from 'vitest';
import { fluid } from '../src/value.js';
import { tokenize } from '../src/interpolate-string.js';
import { __resetConfig } from '../src/config.js';

afterEach(__resetConfig);

describe('tokenize', () => {
    it('splits literals, numbers with units, and colors', () => {
        const tokens = tokenize('0 2px 4px rgba(0,0,0,0.1)');
        expect(tokens.map((t) => t.kind)).toEqual(['number', 'literal', 'number', 'literal', 'number', 'literal', 'color']);
    });

    it('keeps function names as literals', () => {
        const tokens = tokenize('scale(0.8)');
        expect(tokens[0]).toEqual({ kind: 'literal', text: 'scale(' });
        expect(tokens[1]).toEqual({ kind: 'number', value: 0.8, unit: '' });
    });

    it('recognizes units', () => {
        const tokens = tokenize('rotate(45deg)');
        expect(tokens[1]).toEqual({ kind: 'number', value: 45, unit: 'deg' });
    });

    it('handles negative and decimal numbers', () => {
        const tokens = tokenize('translate(-10.5px)');
        expect(tokens[1]).toEqual({ kind: 'number', value: -10.5, unit: 'px' });
    });
});

describe('string fluid — transforms', () => {
    it('interpolates scale', () => {
        const v = fluid('scale(0.8)', 'scale(1.2)');
        expect(v.kind).toBe('string');
        expect(v.resolve(320)).toBe('scale(0.8)');
        expect(v.resolve(1920)).toBe('scale(1.2)');
        expect(v.resolve(1120)).toBe('scale(1)');
    });

    it('interpolates compound transforms', () => {
        const v = fluid('scale(0.8) rotate(0deg)', 'scale(1.2) rotate(45deg)');
        expect(v.resolve(1120)).toBe('scale(1) rotate(22.5deg)');
    });
});

describe('string fluid — shadows and filters', () => {
    it('interpolates a box-shadow including its color', () => {
        const v = fluid('0 2px 4px rgba(0,0,0,0.1)', '0 20px 40px rgba(0,0,0,0.3)');
        const mid = v.resolve(1120) as string;
        expect(mid).toMatch(/^0 11px 22px rgb\(0 0 0 \/ 0\.2\)$/);
    });

    it('interpolates filters', () => {
        const v = fluid('blur(0px) brightness(1)', 'blur(5px) brightness(1.2)');
        expect(v.resolve(1120)).toBe('blur(2.5px) brightness(1.1)');
    });
});

describe('unit handling', () => {
    it('bare 0 inherits the other side unit', () => {
        const v = fluid('blur(0)', 'blur(10px)');
        expect(v.resolve(1120)).toBe('blur(5px)');
    });

    it('rejects genuinely different units', () => {
        expect(() => fluid('rotate(10deg)', 'rotate(1rad)')).toThrow(/unit 'deg' vs 'rad'/);
    });
});

describe('congruence errors', () => {
    it('rejects different token counts with a clear message', () => {
        expect(() => fluid('scale(1)', 'scale(1) rotate(5deg)')).toThrow(/incompatible endpoints/);
    });

    it('rejects different function names', () => {
        expect(() => fluid('scale(1)', 'rotate(1)')).toThrow(/literal/);
    });

    it('rejects kind mismatches (number vs color)', () => {
        expect(() => fluid('fill(1)', 'fill(#fff)')).toThrow(/kinds differ/);
    });
});

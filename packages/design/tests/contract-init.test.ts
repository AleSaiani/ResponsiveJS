/** contractFromManifest — constructs in, verifiable contract out. */
import { describe, it, expect } from 'vitest';
import { contractFromManifest } from '../src/contract/init.js';
import { parseContract } from '@responsivejs/contract';
import type { ProvenanceEntry } from '@responsivejs/core/types';

const entry = (over: Partial<ProvenanceEntry>): ProvenanceEntry => ({
    id: 1,
    construct: 'style',
    target: '.hero',
    behavior: [],
    ...over,
});

describe('contractFromManifest', () => {
    it('a numeric fluid becomes monotonic + continuous + baseline', () => {
        const { contract, skipped } = contractFromManifest([
            entry({
                config: { fontSize: { value: 'fluid', min: 16, max: 32 } },
                source: 'src/hero.ts:3',
            }),
        ]);
        const asserts = contract.rules.map((r) => r.assert);
        expect(asserts).toEqual(['noOverflow', 'monotonic', 'continuous']);
        const mono = contract.rules.find((r) => r.assert === 'monotonic')!;
        expect(mono.args).toEqual({ selector: '.hero', prop: 'fontSize', direction: 'up' });
        expect(mono.description).toContain('src/hero.ts:3');
        expect(contract.baselines).toEqual([{ selector: '.hero', prop: 'fontSize' }]);
        expect(skipped).toEqual([]);
    });

    it('descending fluid gets direction down', () => {
        const { contract } = contractFromManifest([
            entry({ config: { width: { value: 'fluid', min: 400, max: 200 } } }),
        ]);
        expect(contract.rules.find((r) => r.assert === 'monotonic')!.args!.direction).toBe('down');
    });

    it('the page breakpoints become the viewport widths', () => {
        const { contract } = contractFromManifest([
            entry({ construct: 'breakpoints', target: ':root', config: { mobile: 360, tablet: 768, desktop: 1440 } }),
        ]);
        expect(contract.viewport?.widths).toEqual([360, 768, 1440]);
    });

    it('ratio with full bounds becomes proportion; partial bounds are skipped loudly', () => {
        const { contract, skipped } = contractFromManifest([
            entry({ construct: 'ratio', target: '.side', config: { of: '.main-col', min: 0.2, max: 0.33 } }),
            entry({ construct: 'ratio', target: '.other', config: { of: '.main-col', min: 0.2 } }),
        ]);
        const prop = contract.rules.find((r) => r.assert === 'proportion')!;
        expect(prop.args).toEqual({ a: '.side', b: '.main-col', bounds: { min: 0.2, max: 0.33 } });
        expect(skipped.some((s) => s.includes('.other'))).toBe(true);
    });

    it('not-yet-expressible constructs are reported, never silently dropped', () => {
        const { contract, skipped } = contractFromManifest([
            entry({ construct: 'geometry', target: '.nav', config: { 'data-wrapped': 'wraps' } }),
            entry({ config: { color: { value: 'fluid', from: '#f00', to: '#00f' } } }),
            entry({ config: { padding: { value: 'fluid', min: 8, max: 24 } } }),
            entry({ config: { fontSize: { value: 'fluid', min: 14, max: 18, follows: '.sidebar' } } }),
            entry({ target: '3 element(s)', config: { width: { value: 'fluid', min: 100, max: 200 } } }),
        ]);
        expect(contract.rules.map((r) => r.assert)).toEqual(['noOverflow']); // nothing expressible
        expect(skipped).toHaveLength(5);
        expect(skipped.some((s) => s.includes('non-numeric fluid'))).toBe(true);
        expect(skipped.some((s) => s.includes('only fontSize/width/height'))).toBe(true);
        expect(skipped.some((s) => s.includes('element/container-driven'))).toBe(true);
        expect(skipped.some((s) => s.includes('element-bound target'))).toBe(true);
    });

    it('the generated contract is loader-valid (round-trip through parseContract)', () => {
        const { contract } = contractFromManifest(
            [
                entry({ config: { fontSize: { value: 'fluid', min: 16, max: 32 } } }),
                entry({ construct: 'ratio', target: '.side', config: { of: '.main-col', min: 0.2, max: 0.33 } }),
                entry({ construct: 'breakpoints', target: ':root', config: { m: 320, d: 1280 } }),
            ],
            { name: 'example.com' },
        );
        const parsed = parseContract(JSON.parse(JSON.stringify(contract)));
        expect(parsed.name).toBe('example.com');
        expect(parsed.rules.length).toBe(4);
    });
});

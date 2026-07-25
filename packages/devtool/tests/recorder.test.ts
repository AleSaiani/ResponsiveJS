import { describe, it, expect } from 'vitest';
import { buildRecordedContract } from '../src/recorder.js';
import { parseContract } from '@responsivejs/contract';

describe('buildRecordedContract', () => {
    it('produces a loader-valid contract with sorted widths and pinned curves', () => {
        const contract = buildRecordedContract({
            name: 'recorded',
            widths: [1280, 320, 768],
            touchMin: 44,
            baselines: [{ selector: '.hero h1', prop: 'fontSize', curve: [[1280, 64], [320, 28]] }],
        });
        const parsed = parseContract(JSON.parse(JSON.stringify(contract)));
        expect(parsed.viewport?.widths).toEqual([320, 768, 1280]);
        expect(parsed.rules.some((r) => r.assert === 'noOverflow')).toBe(true);
        const touch = parsed.rules.filter((r) => r.assert === 'touchTarget');
        expect(touch.length).toBeGreaterThan(0);
        expect(touch[0].args?.min).toBe(44);
        expect(parsed.baselines?.[0].curve).toEqual([[320, 28], [1280, 64]]); // sorted
    });

    it('no touchMin → no touchTarget rules; noOverflow can be disabled', () => {
        const contract = buildRecordedContract({ widths: [320], noOverflow: false, baselines: [] });
        expect(contract.rules).toHaveLength(0);
        expect(contract.baselines).toBeUndefined();
    });
});

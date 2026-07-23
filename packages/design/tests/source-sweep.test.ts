import { describe, it, expect } from 'vitest';
import { resolveWidths, sweepSource, resweepSource } from '../src/source/sweep.js';
import { DEFAULT_WIDTHS } from '@responsivejs/core/types';
import { FakeSource, makeSnapshot, makeEl, makeStore } from './f3-fixtures.js';

const buildSnap = (width: number, selectors: string[]) =>
    makeSnapshot(width, new Map(selectors.map((s) => [s, [makeEl(s)]])));

describe('resolveWidths', () => {
    it('explicit widths are sorted', () => {
        expect(resolveWidths({ widths: [1280, 320, 768] })).toEqual([320, 768, 1280]);
    });

    it('from/to/step generates the range inclusive', () => {
        expect(resolveWidths({ from: 300, to: 400, step: 50 })).toEqual([300, 350, 400]);
    });

    it('defaults to DEFAULT_WIDTHS', () => {
        expect(resolveWidths({})).toEqual([...DEFAULT_WIDTHS]);
    });
});

describe('sweepSource', () => {
    it('opens, then measures at every width in order', async () => {
        const source = new FakeSource(buildSnap);
        const store = await sweepSource(source, { url: 'http://x', selectors: ['.a'], widths: [320, 768] });
        expect(source.calls).toEqual(['open:http://x', 'viewport:320x900', 'measure:320', 'viewport:768x900', 'measure:768']);
        expect(store.widths).toEqual([320, 768]);
        expect(store.snapshots.get(320)!.width).toBe(320);
    });

    it('skips open when no url is given (pre-navigated source)', async () => {
        const source = new FakeSource(buildSnap);
        await sweepSource(source, { url: '', selectors: ['.a'], widths: [320] });
        expect(source.calls[0]).toBe('viewport:320x900');
    });

    it('scroll sweeping requires an evaluate-capable source', async () => {
        const source = new FakeSource(buildSnap, { withEvaluate: false });
        await expect(
            sweepSource(source, { url: '', selectors: ['.a'], widths: [320], scroll: true }),
        ).rejects.toThrow(/evaluate-capable/);
    });

    it('scroll sweep merges newly-visible elements without overwriting', async () => {
        let call = 0;
        const source = new FakeSource((width, selectors) => {
            call++;
            const els = call === 1 ? [makeEl('.a', { index: 0 })] : [makeEl('.a', { index: 0 }), makeEl('.a', { index: 1 })];
            return makeSnapshot(width, new Map([[selectors[0], els]]));
        });
        source.evalResults.set('document.documentElement.scrollHeight', 3000);
        const store = await sweepSource(source, { url: '', selectors: ['.a'], widths: [320], scroll: true, scrollSteps: 1 });
        const merged = store.snapshots.get(320)!.elements.get('.a')!;
        expect(merged.map((e) => e.index)).toEqual([0, 1]); // index 0 not duplicated
        expect(source.evaluations.some((e) => e.startsWith('window.scrollTo(0, 0)'))).toBe(true);
    });
});

describe('resweepSource', () => {
    it('re-measures requested widths and unions widths/selectors', async () => {
        const existing = makeStore([320, 768], ['.a']);
        const source = new FakeSource(buildSnap);
        const merged = await resweepSource(source, existing, { widths: [1280], selectors: ['.b'] });
        expect(merged.widths).toEqual([320, 768, 1280]);
        expect(merged.selectors).toEqual(['.a', '.b']);
        expect(merged.snapshots.get(320)).toBe(existing.snapshots.get(320)); // untouched widths preserved
        expect(merged.snapshots.get(1280)!.elements.has('.b')).toBe(true);
    });
});

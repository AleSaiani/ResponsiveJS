import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyze } from '../src/analyze/index.js';
import { FakeSource, makeSnapshot, makeEl, makeStore } from './f3-fixtures.js';

const buildSnap = (width: number, selectors: string[]) =>
    makeSnapshot(width, new Map(selectors.map((s) => [s, [makeEl(s)]])));

const EMPTY_AXE = { violations: [], passes: [] };

afterEach(() => {
    vi.doUnmock('axe-core');
    vi.resetModules();
});

function sourceWithAxe(): FakeSource {
    const source = new FakeSource(buildSnap);
    source.evalResults.set('axe.run(', {
        violations: [
            {
                id: 'region',
                impact: 'moderate',
                help: 'landmarks',
                helpUrl: 'https://x',
                nodes: [{ target: ['footer'] }],
            },
        ],
        passes: [{ nodes: [1, 2] }],
    });
    return source;
}

describe('analyze() orchestration', () => {
    it('requires a source or a store', async () => {
        await expect(analyze({})).rejects.toThrow(/source .* or a store/);
    });

    it('requires selectors when sweeping', async () => {
        await expect(analyze({ source: new FakeSource(buildSnap) })).rejects.toThrow(/selectors/);
    });

    it('sweeps, analyzes, and runs axe when available', async () => {
        vi.doMock('axe-core', () => ({ default: { source: 'window.axe = window.axe || {run: () => {}}' } }));
        const source = sourceWithAxe();
        const report = await analyze({
            source,
            url: 'http://x',
            selectors: ['.a'],
            widths: [320, 1280],
            score: false,
        });
        expect(report.sources).toEqual({ measurement: 'fake', a11y: 'axe' });
        expect(report.violations.some((v) => v.rule === 'axe:region')).toBe(true);
        expect(report.summary.warnings).toBeGreaterThan(0);
        // axe default widths = [min, max] → injected once, run twice
        expect(source.evaluations.filter((e) => e.startsWith('axe.run(')).length).toBe(2);
    });

    it('a11y omitted + axe-core missing → silently unavailable', async () => {
        vi.doMock('axe-core', () => {
            throw new Error('not installed');
        });
        const report = await analyze({
            source: new FakeSource(buildSnap),
            url: 'http://x',
            selectors: ['.a'],
            widths: [320],
            score: false,
        });
        expect(report.sources.a11y).toBe('unavailable');
        expect(report.pass).toBe(true);
    });

    it('a11y explicitly configured + axe-core missing → throws', async () => {
        vi.doMock('axe-core', () => {
            throw new Error('not installed');
        });
        await expect(
            analyze({
                source: new FakeSource(buildSnap),
                url: 'http://x',
                selectors: ['.a'],
                widths: [320],
                a11y: { wcagTags: ['wcag2aa'] },
            }),
        ).rejects.toThrow(/a11y was requested/);
    });

    it('store-only input skips sweep and a11y', async () => {
        const report = await analyze({ store: makeStore([320], ['.a']), score: false });
        expect(report.sources).toEqual({ measurement: 'store', a11y: 'skipped' });
        expect(report.widths).toEqual([320]);
    });

    it('store + source: reuses the store but still runs axe', async () => {
        vi.doMock('axe-core', () => ({ default: { source: 'window.axe = {}' } }));
        const source = sourceWithAxe();
        source.evalResults.set('axe.run(', EMPTY_AXE);
        const report = await analyze({ store: makeStore([320], ['.a']), source, score: false });
        expect(source.calls.filter((c) => c.startsWith('measure'))).toHaveLength(0); // no re-sweep
        expect(report.sources.a11y).toBe('axe');
    });
});

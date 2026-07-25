import { describe, it, expect } from 'vitest';
import { diffSweeps } from '../src/diff.js';
import type { Violation } from '@responsivejs/core/types';
import { makeStore, makeEl, makeRect } from '../../design/tests/f3-fixtures.js';

const v = (rule: string, element: string, width: number): Violation => ({ rule, element, width, detail: 'd' });

describe('diffSweeps', () => {
    it('reports value changes above tolerance, per selector/prop/width', () => {
        const before = makeStore([320, 1280], ['.hero'], () => [makeEl('.hero', { rect: makeRect(0, 0, 300, 50), styles: { fontSize: 24 } })]);
        const after = makeStore([320, 1280], ['.hero'], (w) => [
            makeEl('.hero', { rect: makeRect(0, 0, w === 320 ? 300 : 340, 50), styles: { fontSize: 28 } }),
        ]);
        const diff = diffSweeps({ store: before, violations: [] }, { store: after, violations: [] });

        const keys = diff.changes.map((c) => `${c.prop}@${c.width}`).sort();
        expect(keys).toEqual(['fontSize@1280', 'fontSize@320', 'width@1280']);
        const font = diff.changes.find((c) => c.prop === 'fontSize' && c.width === 320)!;
        expect(font.before).toBe(24);
        expect(font.after).toBe(28);
    });

    it('sub-pixel jitter is not a change', () => {
        const before = makeStore([320], ['.a'], () => [makeEl('.a', { rect: makeRect(0, 0, 100.0, 50) })]);
        const after = makeStore([320], ['.a'], () => [makeEl('.a', { rect: makeRect(0, 0, 100.4, 50) })]);
        expect(diffSweeps({ store: before, violations: [] }, { store: after, violations: [] }).changes).toHaveLength(0);
    });

    it('violations appeared/resolved by key', () => {
        const store = makeStore([320], ['.a'], () => [makeEl('.a')]);
        const diff = diffSweeps(
            { store, violations: [v('noOverflow', '.a[0]', 320), v('touchTarget', '.b[0]', 320)] },
            { store, violations: [v('noOverflow', '.a[0]', 320), v('contrastRatio', '.c[0]', 320)] },
        );
        expect(diff.appeared).toEqual(['contrastRatio|.c[0]|320']);
        expect(diff.resolved).toEqual(['touchTarget|.b[0]|320']);
    });

    it('widths present only on one side are skipped (not phantom changes)', () => {
        const before = makeStore([320], ['.a'], () => [makeEl('.a')]);
        const after = makeStore([320, 1280], ['.a'], () => [makeEl('.a')]);
        expect(diffSweeps({ store: before, violations: [] }, { store: after, violations: [] }).changes).toHaveLength(0);
    });
});

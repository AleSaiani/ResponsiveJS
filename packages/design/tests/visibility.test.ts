import { describe, it, expect } from 'vitest';
import { Asserter } from '../src/constraints/index.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

describe('visible / hidden', () => {
    it('hidden passes when the element is absent at a width', () => {
        const store = makeStore([320], ['.other']);
        const report = new Asserter(store).hidden('.sidebar').report();
        expect(report.pass).toBe(true);
    });

    it('hidden passes for display:none, visibility:hidden, and zero area', () => {
        for (const overrides of [
            { computed: { display: 'none' } },
            { computed: { visibility: 'hidden' } },
            { rect: makeRect(0, 0, 0, 0) },
        ]) {
            const store = makeStore([320], ['.s'], () => [makeEl('.s', overrides as never)]);
            expect(new Asserter(store).hidden('.s').report().pass).toBe(true);
        }
    });

    it('hidden fails with a fix when the element renders', () => {
        const store = makeStore([320], ['.s']);
        const report = new Asserter(store).hidden('.s').report();
        expect(report.pass).toBe(false);
        expect(report.violations[0].rule).toBe('hidden');
        expect(report.violations[0].fix?.property).toBe('display');
    });

    it('visible fails when absent or unrendered, passes when rendered', () => {
        const absent = makeStore([320], ['.other']);
        expect(new Asserter(absent).visible('.s').report().pass).toBe(false);

        const unrendered = makeStore([320], ['.s'], () => [makeEl('.s', { computed: { display: 'none' } })]);
        expect(new Asserter(unrendered).visible('.s').report().pass).toBe(false);

        const rendered = makeStore([320], ['.s']);
        expect(new Asserter(rendered).visible('.s').report().pass).toBe(true);
    });

    it('checks every width independently', () => {
        const store = makeStore([320, 1280], ['.s'], (w) => [
            makeEl('.s', w < 768 ? ({ computed: { display: 'none' } } as never) : {}),
        ]);
        const report = new Asserter(store).visible('.s').report();
        expect(report.violations).toHaveLength(1);
        expect(report.violations[0].width).toBe(320);
    });
});

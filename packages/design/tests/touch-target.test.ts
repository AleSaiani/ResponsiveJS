import { describe, it, expect } from 'vitest';
import { Asserter } from '../src/constraints/index.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

/** Small pointer targets at a mobile width, varying display. */
function storeWith(display: string, rect = makeRect(0, 0, 110, 28)) {
    return makeStore([320], ['a'], () => [
        makeEl('a', {
            rect,
            computed: { cursor: 'pointer', display },
        }),
    ]);
}

describe('touchTarget — WCAG 2.5.8 inline exception', () => {
    it('flags inline-block targets under the 24px floor', () => {
        const report = new Asserter(storeWith('inline-block', makeRect(0, 0, 110, 20))).touchTarget('a').report();
        expect(report.violations).toHaveLength(1);
        expect(report.violations[0].rule).toBe('touchTarget');
    });

    it('exempts display:inline targets — links flowing in prose', () => {
        const report = new Asserter(storeWith('inline', makeRect(0, 0, 110, 20))).touchTarget('a').report();
        expect(report.violations).toHaveLength(0);
        expect(report.total).toBe(0); // not even counted as a check
    });
});

describe('touchTarget — configurable minimum', () => {
    it('a 110x28 target meets the default WCAG 2.5.8 floor (24) but fails platform guidance (44)', () => {
        const wcag = new Asserter(storeWith('inline-block')).touchTarget('a').report();
        expect(wcag.violations).toHaveLength(0);

        const platform = new Asserter(storeWith('inline-block')).touchTarget('a', 44).report();
        expect(platform.violations).toHaveLength(1);
        expect(platform.violations[0].detail).toContain('< 44x44px');
    });

    it('the reported expectation and fix follow the custom minimum', () => {
        const report = new Asserter(storeWith('inline-block')).touchTarget('a', 48).report();
        expect(report.violations[0].expected).toBe(48);
        expect(report.violations[0].detail).toContain('< 48x48px');
        expect(report.violations[0].fix?.value).toBe('48px');
    });
});

import { describe, it, expect } from 'vitest';
import { Asserter } from '../src/constraints/index.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

/** Small pointer targets at a mobile width, varying display. */
function storeWith(display: string) {
    return makeStore([320], ['a'], () => [
        makeEl('a', {
            rect: makeRect(0, 0, 110, 28), // under 44x44
            computed: { cursor: 'pointer', display },
        }),
    ]);
}

describe('touchTarget — WCAG 2.5.8 inline exception', () => {
    it('flags small inline-block targets (buttons, nav pills)', () => {
        const report = new Asserter(storeWith('inline-block')).touchTarget('a').report();
        expect(report.violations).toHaveLength(1);
        expect(report.violations[0].rule).toBe('touchTarget');
    });

    it('exempts display:inline targets — links flowing in prose', () => {
        const report = new Asserter(storeWith('inline')).touchTarget('a').report();
        expect(report.violations).toHaveLength(0);
        expect(report.total).toBe(0); // not even counted as a check
    });
});

describe('touchTarget — custom minimum', () => {
    it('a 110x28 target passes the WCAG 2.5.8 AA minimum (24) but fails the default 44', () => {
        const lenient = new Asserter(storeWith('inline-block')).touchTarget('a', 24).report();
        expect(lenient.violations).toHaveLength(0);

        const strict = new Asserter(storeWith('inline-block')).touchTarget('a').report();
        expect(strict.violations).toHaveLength(1);
        expect(strict.violations[0].detail).toContain('< 44x44px');
    });

    it('the reported expectation and fix follow the custom minimum', () => {
        const report = new Asserter(storeWith('inline-block')).touchTarget('a', 48).report();
        expect(report.violations[0].expected).toBe(48);
        expect(report.violations[0].detail).toContain('< 48x48px');
        expect(report.violations[0].fix?.value).toBe('48px');
    });
});

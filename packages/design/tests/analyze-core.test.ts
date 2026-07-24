import { describe, it, expect } from 'vitest';
import { analyzeStore, mergeReports, summarize, applicableFixes } from '../src/analyze/core.js';
import type { Violation } from '@responsivejs/core/types';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

// A store whose element overflows the viewport at 320 (right = 400 > 320).
const overflowing = () =>
    makeStore([320, 1280], ['.wide'], (w, sel) => [makeEl(sel, { rect: makeRect(0, 0, 400, 50) })]);

const wellBehaved = () =>
    makeStore([320, 1280], ['.ok'], (w) => [makeEl('.ok', { rect: makeRect(10, 10, Math.min(200, w - 40), 60) })]);

describe('analyzeStore — defaults', () => {
    it('runs the low-false-positive default set (noOverflow + contrast + touchTarget)', () => {
        const report = analyzeStore(overflowing(), { score: false });
        expect(report.pass).toBe(false);
        const rules = new Set(report.violations.map((v) => v.rule));
        expect(rules.has('noOverflow')).toBe(true);
    });

    it('passes on a well-behaved store', () => {
        const report = analyzeStore(wellBehaved(), { score: false });
        expect(report.pass).toBe(true);
        expect(report.clean).toBe(true);
    });

    it('constraint toggles disable individual defaults', () => {
        const report = analyzeStore(overflowing(), {
            score: false,
            constraints: { noOverflow: false, contrast: false, touchTarget: false },
        });
        expect(report.total).toBe(0);
    });

    it('accepts a custom constraints function (full Asserter surface)', () => {
        const report = analyzeStore(wellBehaved(), {
            score: false,
            constraints: (assert) => assert.noZeroHeight('.ok'),
        });
        expect(report.total).toBeGreaterThan(0);
        expect(report.pass).toBe(true);
    });
});

describe('analyzeStore — score', () => {
    it('includes the aesthetic score by default', () => {
        const report = analyzeStore(wellBehaved());
        expect(report.scores).toBeDefined();
        expect(report.scores!.average.overall).toBeGreaterThan(0);
        expect(report.scores!.perWidth.size).toBe(2);
    });

    it('score: false disables scoring', () => {
        expect(analyzeStore(wellBehaved(), { score: false }).scores).toBeUndefined();
    });
});

describe('UnifiedReport semantics', () => {
    it('pass = no errors; clean = no violations at all', () => {
        const base = analyzeStore(wellBehaved(), { score: false });
        const withWarning = mergeReports(base, {
            pass: false,
            total: 1,
            passed: 0,
            failed: 1,
            violations: [{ rule: 'custom', width: 320, detail: 'just a warning', severity: 'warning' }],
        });
        expect(withWarning.pass).toBe(true); // warnings don't fail
        expect(withWarning.clean).toBe(false);
        expect(withWarning.summary.warnings).toBe(1);
    });

    it('legacy violations without severity count as errors', () => {
        const summary = summarize([{ rule: 'x', width: 1, detail: 'd' } as Violation]);
        expect(summary.errors).toBe(1);
    });

    it('summary groups by rule and width; fixes are flattened', () => {
        const report = analyzeStore(overflowing(), { score: false });
        expect(Object.keys(report.summary.byRule).length).toBeGreaterThan(0);
        expect(report.summary.byWidth['320']).toBeGreaterThan(0);
        for (const fix of report.fixes) {
            expect(fix).toHaveProperty('selector');
            expect(fix).toHaveProperty('property');
        }
    });

    it('fixes[] carries only exact fixes, deduped by (selector, property) across widths', () => {
        const v = (width: number, fix: Violation['fix']): Violation => ({
            rule: 'r',
            element: '.x[0]',
            width,
            detail: 'd',
            severity: 'error',
            fix,
        });
        const fixes = applicableFixes([
            v(320, { selector: '.x', property: 'min-height', value: '24px', reason: 'a', kind: 'exact' }),
            v(768, { selector: '.x', property: 'min-height', value: '24px', reason: 'a', kind: 'exact' }),
            v(320, { selector: '.x', property: 'color', value: '(increase contrast)', reason: 'b', kind: 'heuristic' }),
            v(320, { selector: '.y', property: 'min-height', value: '24px', reason: 'a', kind: 'exact' }),
            v(320, undefined),
        ]);
        expect(fixes).toHaveLength(2);
        expect(fixes.every((f) => f.kind === 'exact')).toBe(true);
        expect(fixes.map((f) => f.selector).sort()).toEqual(['.x', '.y']);
    });

    it('mergeReports recomputes totals and summary', () => {
        const base = analyzeStore(wellBehaved(), { score: false });
        const merged = mergeReports(base, {
            pass: false,
            total: 2,
            passed: 1,
            failed: 1,
            violations: [{ rule: 'theme:contrast', width: 0, detail: 'token pair fails', severity: 'error' }],
        });
        expect(merged.total).toBe(base.total + 2);
        expect(merged.pass).toBe(false);
        expect(merged.summary.byRule['theme:contrast']).toBe(1);
    });
});

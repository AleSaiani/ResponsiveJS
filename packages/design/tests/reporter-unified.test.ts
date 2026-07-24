import { describe, it, expect } from 'vitest';
import { formatConsole, formatJSON, formatCompact, formatSARIF, formatContractSARIF } from '../src/report/reporter.js';
import type { ContractReport } from '@responsivejs/contract';
import { analyzeStore, mergeReports } from '../src/analyze/core.js';
import type { Report } from '@responsivejs/core/types';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

const store = () => makeStore([320, 1280], ['.a'], () => [makeEl('.a', { rect: makeRect(10, 10, 200, 60) })]);

function unifiedWithViolations() {
    return mergeReports(analyzeStore(store()), {
        pass: false,
        total: 2,
        passed: 0,
        failed: 2,
        violations: [
            { rule: 'axe:region', element: 'footer', width: 320, detail: 'landmark missing', severity: 'warning', suggestion: 'wrap in <main> (https://x)' },
            { rule: 'noOverflow', element: '.a[0]', width: 320, detail: 'right=400 > 320', severity: 'error', fix: { selector: '.a', property: 'max-width', value: '100%', reason: 'contain overflow', kind: 'exact' } },
        ],
    });
}

describe('unified reporter', () => {
    it('formatJSON serializes scores.perWidth as a record (not {})', () => {
        const parsed = JSON.parse(formatJSON(analyzeStore(store())));
        expect(parsed.scores.perWidth['320']).toBeDefined();
        expect(parsed.scores.perWidth['320'].overall).toBeTypeOf('number');
    });

    it('legacy plain Report console format is unchanged', () => {
        const plain: Report = { pass: true, total: 3, passed: 3, failed: 0, violations: [] };
        expect(formatConsole(plain)).toBe('r$ ✓ 3/3 constraints passed');
    });

    it('unified console format groups by rule and shows severity counts', () => {
        const text = formatConsole(unifiedWithViolations());
        expect(text).toContain('errors');
        expect(text).toContain('axe:region');
        expect(text).toContain('noOverflow');
        expect(text).toContain('fixes available: 1');
    });

    it('unified console groups the same element across widths into one line', () => {
        const report = mergeReports(analyzeStore(store()), {
            pass: false,
            total: 3,
            passed: 0,
            failed: 3,
            violations: [
                { rule: 'noOverflow', element: '.wide[0]', width: 320, detail: 'right=480 > 320', severity: 'error' },
                { rule: 'noOverflow', element: '.wide[0]', width: 768, detail: 'right=480 > 768', severity: 'error' },
                { rule: 'noOverflow', element: '.other[0]', width: 320, detail: 'right=400 > 320', severity: 'error' },
            ],
        });
        const text = formatConsole(report);
        expect(text).toContain('noOverflow (3 across 2 elements)');
        expect(text).toContain('.wide[0] @320,768px — right=480 > 320');
        // one line per element, not per width
        expect(text.match(/\.wide\[0\]/g)).toHaveLength(1);
    });

    it('unified compact format carries E/W/I counts', () => {
        const text = formatCompact(unifiedWithViolations());
        expect(text).toMatch(/E1\/W1\/I0/);
    });

    it('SARIF output is valid-shaped 2.1.0 with mapped levels', () => {
        const sarif = JSON.parse(formatSARIF(unifiedWithViolations(), { toolVersion: '1.2.3' }));
        expect(sarif.version).toBe('2.1.0');
        const run = sarif.runs[0];
        expect(run.tool.driver.name).toBe('responsivejs-design');
        expect(run.tool.driver.version).toBe('1.2.3');
        const levels = run.results.map((r: { level: string }) => r.level);
        expect(levels).toContain('warning');
        expect(levels).toContain('error');
        const names = run.results.map(
            (r: { locations: { logicalLocations: { fullyQualifiedName: string }[] }[] }) =>
                r.locations[0].logicalLocations[0].fullyQualifiedName,
        );
        expect(names).toContain('footer');
    });

    it('contract SARIF uses contract rule ids and carries intent as shortDescription', () => {
        const report: ContractReport = {
            contract: { name: 'home', version: 1 },
            pass: false,
            total: 3,
            passed: 2,
            failed: 1,
            rules: [],
            violations: [
                {
                    rule: 'noOverflow',
                    ruleId: 'no-bleed',
                    ruleDescription: 'nothing bleeds out of the viewport',
                    element: '.card[0]',
                    width: 320,
                    detail: 'right=480 > viewport=320',
                    severity: 'error',
                },
            ],
        };
        const sarif = JSON.parse(formatContractSARIF(report, { toolVersion: '1.2.3' }));
        expect(sarif.version).toBe('2.1.0');
        const run = sarif.runs[0];
        expect(run.tool.driver.rules[0]).toEqual({
            id: 'no-bleed',
            shortDescription: { text: 'nothing bleeds out of the viewport' },
        });
        expect(run.results[0].ruleId).toBe('no-bleed');
        expect(run.results[0].level).toBe('error');
        expect(run.results[0].message.text).toContain('[home]');
        expect(run.results[0].locations[0].logicalLocations[0].fullyQualifiedName).toBe('.card[0]');
    });
});

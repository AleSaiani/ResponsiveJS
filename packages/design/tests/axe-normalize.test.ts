import { describe, it, expect } from 'vitest';
import { normalizeAxeResults, buildAxeRunExpression, type AxeRawResults } from '../src/a11y/axe.js';

const RAW: AxeRawResults = {
    violations: [
        {
            id: 'aria-required-attr',
            impact: 'critical',
            help: 'Required ARIA attributes must be provided',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-required-attr',
            nodes: [
                { target: ['#menu', 'button'], failureSummary: 'Fix any of the following:\n aria-expanded missing' },
                { target: ['.other'] },
            ],
        },
        {
            id: 'region',
            impact: 'moderate',
            help: 'All page content should be contained by landmarks',
            helpUrl: 'https://example.com/region',
            nodes: [{ target: ['footer'] }],
        },
        {
            id: 'meta-viewport',
            impact: 'minor',
            help: 'Zooming and scaling must not be disabled',
            helpUrl: 'https://example.com/meta',
            nodes: [{ target: ['meta[name=viewport]'] }],
        },
    ],
    passes: [{ nodes: [1, 2, 3] }, { nodes: [4] }],
};

describe('normalizeAxeResults', () => {
    it('namespaces rules with axe: and expands per node', () => {
        const { violations } = normalizeAxeResults(RAW, 768);
        expect(violations).toHaveLength(4);
        expect(violations[0].rule).toBe('axe:aria-required-attr');
        expect(violations[0].element).toBe('#menu button');
        expect(violations[0].width).toBe(768);
    });

    it('maps impact to severity (critical/serious→error, moderate→warning, minor→info)', () => {
        const { violations } = normalizeAxeResults(RAW, 320);
        expect(violations[0].severity).toBe('error');
        expect(violations[2].severity).toBe('warning');
        expect(violations[3].severity).toBe('info');
    });

    it('uses the first failureSummary line as detail, help as fallback', () => {
        const { violations } = normalizeAxeResults(RAW, 320);
        expect(violations[0].detail).toBe('Fix any of the following:');
        expect(violations[1].detail).toBe('Required ARIA attributes must be provided');
    });

    it('carries help + helpUrl as the suggestion', () => {
        const { violations } = normalizeAxeResults(RAW, 320);
        expect(violations[0].suggestion).toContain('dequeuniversity.com');
    });

    it('counts pass nodes', () => {
        expect(normalizeAxeResults(RAW, 320).passes).toBe(4);
    });
});

describe('buildAxeRunExpression', () => {
    it('always disables color-contrast, even with user disableRules', () => {
        const expr = buildAxeRunExpression({ disableRules: ['region'] });
        expect(expr).toContain('"color-contrast":{"enabled":false}');
        expect(expr).toContain('"region":{"enabled":false}');
    });

    it('defaults to the WCAG A/AA tag set and document context', () => {
        const expr = buildAxeRunExpression({});
        expect(expr).toContain('"wcag2a","wcag2aa","wcag21a","wcag21aa"');
        expect(expr.startsWith('axe.run(document,')).toBe(true);
    });

    it('include/exclude become the axe context object', () => {
        const expr = buildAxeRunExpression({ include: ['main'], exclude: ['.ads'] });
        expect(expr).toContain('"include":[["main"]]');
        expect(expr).toContain('"exclude":[[".ads"]]');
    });
});

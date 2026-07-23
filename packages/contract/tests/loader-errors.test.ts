import { describe, it, expect } from 'vitest';
import { validateContract, parseContract } from '../src/index.js';

function issuesOf(input: object) {
    const result = validateContract(input);
    expect(result.contract).toBeNull();
    return (result as { issues: { path: string; message: string; suggestion?: string }[] }).issues;
}

const base = { version: 1, rules: [] };

describe('loader errors (helpfulness is the contract)', () => {
    it('unknown constraint gets a did-you-mean', () => {
        const issues = issuesOf({ ...base, rules: [{ assert: 'noOverflw' }] });
        expect(issues[0].path).toBe('rules[0].assert');
        expect(issues[0].suggestion).toContain('noOverflow');
    });

    it('wrong arg type names the expectation', () => {
        const issues = issuesOf({ ...base, rules: [{ assert: 'sameHeight', args: { a: '.x', b: '.y', tolerance: 'big' } }] });
        expect(issues[0].path).toBe('rules[0].args.tolerance');
        expect(issues[0].message).toContain('finite number');
    });

    it('missing required arg is reported with its doc', () => {
        const issues = issuesOf({ ...base, rules: [{ assert: 'minSize', args: { selector: '.x' } }] });
        expect(issues[0].path).toBe('rules[0].args.min');
        expect(issues[0].message).toContain('required');
    });

    it('unknown arg gets a did-you-mean against the constraint params', () => {
        const issues = issuesOf({ ...base, rules: [{ assert: 'contains', args: { parent: '.a', chidl: '.b' } }] });
        const unknown = issues.find((i) => i.message.includes("unknown arg"));
        expect(unknown?.suggestion).toContain('child');
    });

    it('min > max range is rejected', () => {
        const issues = issuesOf({ ...base, rules: [{ assert: 'noOverflow', when: { min: 1000, max: 500 } }] });
        expect(issues[0].message).toContain('min (1000) > max (500)');
    });

    it('duplicate rule ids are rejected', () => {
        const issues = issuesOf({
            ...base,
            rules: [
                { id: 'x', assert: 'noOverflow' },
                { id: 'x', assert: 'noOverflow' },
            ],
        });
        expect(issues[0].message).toContain("duplicate rule id 'x'");
    });

    it('unresolved $alias lists known aliases', () => {
        const issues = issuesOf({
            ...base,
            selectors: { nav: '.main-nav' },
            rules: [{ assert: 'touchTarget', args: { selector: '$sidebar' } }],
        });
        expect(issues[0].message).toContain("unresolved alias '$sidebar'");
        expect(issues[0].suggestion).toContain('$nav');
    });

    it('wrong version points at an upgrade', () => {
        const issues = issuesOf({ version: 2, rules: [] });
        expect(issues[0].path).toBe('version');
        expect(issues[0].suggestion).toContain('upgrade');
    });

    it('unknown top-level field gets a did-you-mean', () => {
        const issues = issuesOf({ ...base, viewprot: {} });
        expect(issues[0].suggestion).toContain('viewport');
    });

    it('parseContract throws with all issues formatted', () => {
        expect(() => parseContract({ version: 1, rules: [{ assert: 'nope' }] })).toThrow(/unknown constraint/);
    });

    it('valid contracts pass with zero issues', () => {
        const result = validateContract({
            version: 1,
            selectors: { s: '.sidebar' },
            rules: [{ assert: 'hidden', args: { selector: '$s' }, when: { max: 767 } }],
        });
        expect(result.contract).not.toBeNull();
        expect(result.issues).toHaveLength(0);
    });
});

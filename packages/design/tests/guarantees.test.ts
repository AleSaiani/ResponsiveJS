/**
 * Regression tests for the 2026-07-24 external review findings — each one
 * reproduces the reported failure and pins the corrected guarantee.
 */

import { describe, it, expect } from 'vitest';
import { verifyContract, contractSweepPlan } from '../src/contract/verify.js';
import { Asserter } from '../src/constraints/index.js';
import { analyzeStore, attachOwnership } from '../src/analyze/core.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

describe('provenance — violations trace back to the owning construct', () => {
    const overflowStore = () => ({
        ...makeStore([320], ['.card'], () => [makeEl('.card', { rect: makeRect(0, 0, 480, 100) })]),
        manifest: [
            { id: 1, construct: 'style', target: '.card', behavior: ['width: fluid'], source: 'src/cards.ts:12' },
        ],
    });

    it('analyzeStore annotates violations with owner {construct, behavior, source}', () => {
        const report = analyzeStore(overflowStore(), { score: false });
        const hit = report.violations.find((v) => v.rule === 'noOverflow');
        expect(hit?.owner).toEqual({ construct: 'style', behavior: ['width: fluid'], source: 'src/cards.ts:12' });
    });

    it('verifyContract annotates too, and unmatched elements stay unowned', () => {
        const contract = { name: 'x', version: 1, rules: [{ assert: 'noOverflow', args: {} }] };
        const store = overflowStore();
        const report = verifyContract(contract, store);
        const hit = report.violations.find((v) => v.rule === 'noOverflow');
        expect(hit?.owner?.construct).toBe('style');
        expect(hit?.owner?.source).toBe('src/cards.ts:12');
    });

    it('attachOwnership is a no-op without a manifest', () => {
        const violations = [{ rule: 'noOverflow', element: '.card[0]', width: 320, detail: 'x' }];
        attachOwnership(violations, undefined);
        expect(violations[0]).not.toHaveProperty('owner');
    });
});

describe('finding 1 — a global-rules contract can never pass with zero checks', () => {
    const onlyNoOverflow = { name: 'x', version: 1, rules: [{ assert: 'noOverflow', args: {} }] };

    it('the sweep plan of a selector-less contract is NOT empty', () => {
        const plan = contractSweepPlan(onlyNoOverflow);
        expect(plan.selectors.length).toBeGreaterThan(0);
        expect(plan.selectors).toContain('main');
    });

    it('a run that performed zero checks fails loudly instead of passing 0/0', () => {
        // Store with none of the contract's targets → nothing measurable.
        const empty = makeStore([320], ['.unrelated'], () => []);
        const report = verifyContract(onlyNoOverflow, empty);
        expect(report.total).toBe(0);
        expect(report.pass).toBe(false);
        expect(report.violations.some((v) => v.rule === 'contract.noChecks')).toBe(true);
    });

    it('a normal store measured through the default set still passes honestly', () => {
        const store = makeStore([320], ['main'], () => [makeEl('main', { rect: makeRect(0, 0, 300, 100) })]);
        const report = verifyContract(onlyNoOverflow, store);
        expect(report.total).toBeGreaterThan(0);
        expect(report.pass).toBe(true);
    });
});

describe('finding 4 — report counters stay mathematically valid', () => {
    it('minSize failing width AND height: 2 violations, 1 failed check, passed never negative', () => {
        const store = makeStore([320], ['.tiny'], () => [
            makeEl('.tiny', { rect: makeRect(0, 0, 5, 5) }),
        ]);
        const report = new Asserter(store).minSize('.tiny', { width: 44, height: 44 }).report();
        expect(report.total).toBe(1);
        expect(report.violations.length).toBe(2); // width + height both reported
        expect(report.failed).toBe(1); // …but ONE check failed
        expect(report.passed).toBe(0); // not -1
        expect(report.passed).toBeGreaterThanOrEqual(0);
    });
});

describe('finding 5 — touchTarget sees native controls, not just cursor:pointer', () => {
    function buttonStore(computed: Record<string, unknown>) {
        return makeStore([320], ['button'], () => [
            makeEl('button', { rect: makeRect(0, 0, 10, 10), computed: computed as never }),
        ]);
    }

    it('a native <button> with cursor:auto is checked (and fails at 10x10)', () => {
        const report = new Asserter(
            buttonStore({ cursor: 'auto', display: 'inline-block', tagName: 'button', interactive: true }),
        ).touchTarget('button').report();
        expect(report.total).toBe(1);
        expect(report.violations).toHaveLength(1);
    });

    it('cursor:pointer still works as the behavioral fallback (synthetic stores)', () => {
        const report = new Asserter(
            buttonStore({ cursor: 'pointer', display: 'inline-block' }),
        ).touchTarget('button').report();
        expect(report.violations).toHaveLength(1);
    });

    it('non-interactive elements stay unchecked', () => {
        const report = new Asserter(
            buttonStore({ cursor: 'auto', display: 'block', tagName: 'div', interactive: false }),
        ).touchTarget('button').report();
        expect(report.total).toBe(0);
    });

    it('unrendered controls (0x0) are skipped', () => {
        const store = makeStore([320], ['input'], () => [
            makeEl('input', { rect: makeRect(0, 0, 0, 0), computed: { cursor: 'auto', interactive: true } as never }),
        ]);
        expect(new Asserter(store).touchTarget('input').report().total).toBe(0);
    });
});

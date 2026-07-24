import { describe, it, expect } from 'vitest';
import { contract } from '@responsivejs/contract';
import { verifyContract, recordBaseline } from '../src/contract/verify.js';
import { designSystemRules } from '../src/contract/design-system-rules.js';
import { compileRule } from '../src/contract/dispatch.js';
import { Asserter } from '../src/constraints/index.js';
import { applyDesignSystem, type DesignSystemConfig } from '../src/constraints/design-system.js';
import { formatContractConsole } from '../src/report/reporter.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

// Sidebar rendered only at >=768; overflowing box at 320.
const appStore = () =>
    makeStore([320, 768, 1280], ['.sidebar', '.hero'], (w, sel) => {
        if (sel === '.sidebar') {
            return [makeEl(sel, w < 768 ? ({ computed: { display: 'none' } } as never) : { rect: makeRect(0, 0, 240, 600) })];
        }
        return [makeEl(sel, { rect: makeRect(0, 0, 400, 100) })]; // overflows at 320
    });

describe('verifyContract — scoping and attribution', () => {
    it('range-scoped rules fire only inside their range', () => {
        const c = contract('scoping')
            .below(768)
            .assert('hidden', { selector: '.sidebar' }, { id: 'sidebar-mobile' })
            .from(768)
            .assert('visible', { selector: '.sidebar' }, { id: 'sidebar-desktop' })
            .build();

        const report = verifyContract(c, appStore());
        expect(report.pass).toBe(true);
        expect(report.rules.map((r) => r.ruleId)).toEqual(['sidebar-mobile', 'sidebar-desktop']);
    });

    it('violations carry ruleId, description, and severity override', () => {
        const c = contract('attribution')
            .at('*')
            .assert('noOverflow', undefined, {
                id: 'no-overflow',
                severity: 'warning',
                description: 'nothing may bleed out of the viewport',
            })
            .build();

        const report = verifyContract(c, appStore());
        const v = report.violations.find((x) => x.ruleId === 'no-overflow');
        expect(v).toBeDefined(); // .hero (400px) overflows at 320
        expect(v!.severity).toBe('warning');
        expect(v!.ruleDescription).toContain('bleed');
        expect(report.pass).toBe(true); // warning severity does not fail the contract
    });

    it('empty ranges are reported skipped, never failing', () => {
        const c = contract().between(2000, 3000).assert('noOverflow', undefined, { id: 'ultra' }).build();
        const report = verifyContract(c, appStore());
        expect(report.rules[0].skipped).toBe(true);
        expect(report.pass).toBe(true);
    });

    it('$aliases resolve through the selectors map', () => {
        const c = contract()
            .select('side', '.sidebar')
            .from(768)
            .assert('visible', { selector: '$side' }, { id: 'v' })
            .build();
        expect(verifyContract(c, appStore()).pass).toBe(true);
    });
});

describe('verifyContract — score requirements', () => {
    it('average score check produces ScoreCheckResult and synthetic violations on failure', () => {
        const c = contract().score({ min: 0.999 }).assert('noOverflow', undefined, { severity: 'info', id: 'x' }).build();
        const report = verifyContract(c, appStore());
        expect(report.score).toBeDefined();
        const overall = report.score!.find((s) => s.metric === 'overall')!;
        expect(overall.pass).toBe(false); // 0.999 is unreachable
        expect(report.violations.some((v) => v.rule === 'score.overall')).toBe(true);
        expect(report.pass).toBe(false);
    });

    it('passing thresholds leave the contract green', () => {
        const c = contract().score({ min: 0.01 }).assert('noOverflow', undefined, { severity: 'info', id: 'x' }).build();
        expect(verifyContract(c, appStore()).score!.every((s) => s.pass)).toBe(true);
    });
});

describe('verifyContract — baselines', () => {
    it('recordBaseline fills curves; verify passes within tolerance and fails beyond', () => {
        const c = contract().baseline('.hero', 'width', { px: 2 }).assert('noOverflow', undefined, { severity: 'info', id: 'x' }).build();
        const recorded = recordBaseline(c, appStore());
        expect(recorded.baselines![0].curve).toEqual([
            [320, 400],
            [768, 400],
            [1280, 400],
        ]);

        // Same layout → pass.
        expect(verifyContract(recorded, appStore()).baselines![0].pass).toBe(true);

        // Regressed layout (hero now full width at 768) → deviation.
        const regressed = makeStore([320, 768, 1280], ['.sidebar', '.hero'], (w, sel) =>
            sel === '.hero' ? [makeEl(sel, { rect: makeRect(0, 0, w, 100) })] : [makeEl(sel)],
        );
        const report = verifyContract(recorded, regressed);
        const baseline = report.baselines![0];
        expect(baseline.pass).toBe(false);
        expect(baseline.deviations.some((d) => d.width === 768 && d.actual === 768)).toBe(true);
        expect(report.violations.some((v) => v.rule === 'baseline')).toBe(true);
    });

    it('unrecorded baselines are reported but do not fail', () => {
        const c = contract().baseline('.hero', 'width').assert('noOverflow', undefined, { severity: 'info', id: 'x' }).build();
        const report = verifyContract(c, appStore());
        expect(report.baselines![0].unrecorded).toBe(true);
        expect(report.pass).toBe(true);
    });

    it('percent tolerance works independently of px', () => {
        const c = contract().baseline('.hero', 'width', { percent: 50 }).assert('noOverflow', undefined, { severity: 'info', id: 'x' }).build();
        const recorded = recordBaseline(c, appStore());
        const slightlyOff = makeStore([320, 768, 1280], ['.sidebar', '.hero'], (w, sel) =>
            sel === '.hero' ? [makeEl(sel, { rect: makeRect(0, 0, Math.min(w, 400) * 1.2, 100) })] : [makeEl(sel)],
        );
        expect(verifyContract(recorded, slightlyOff).baselines![0].pass).toBe(true); // 20% < 50%
    });
});

describe('design-system unification', () => {
    const ds: DesignSystemConfig = {
        spacing: { tokens: [4, 8, 16] },
        components: { button: { height: 40 } },
        accessibility: { contrast: 'AA' },
    };
    const selectors = { interactive: ['button'], text: ['h1'], inputs: [], containers: ['main'], surfaces: [] };

    it('applyDesignSystem ≡ compiling designSystemRules (parity regression)', () => {
        const store = makeStore([320, 1280], ['button', 'h1', 'main']);
        const viaLegacy = applyDesignSystem(new Asserter(store), ds, selectors).report();
        const asserter = new Asserter(store);
        for (const rule of designSystemRules(ds, selectors)) compileRule(asserter, rule);
        const viaRules = asserter.report();
        expect(viaRules.total).toBe(viaLegacy.total);
        expect(viaRules.violations).toEqual(viaLegacy.violations);
    });

    it('contracts embed profiles: rules appear with ds.* ids', () => {
        const c = contract()
            .use('material-design-3', selectors)
            .assert('noOverflow', undefined, { id: 'own-rule' })
            .build();
        const report = verifyContract(c, makeStore([320], ['button', 'h1', 'main']));
        const ids = report.rules.map((r) => r.ruleId);
        expect(ids).toContain('own-rule');
        expect(ids.some((id) => id.startsWith('ds.'))).toBe(true);
    });

    it('unknown profile names throw with the bundled list', () => {
        const c = contract().use('bootstrap').assert('noOverflow').build();
        expect(() => verifyContract(c, makeStore([320], ['.a']))).toThrow(/apple-hig/);
    });
});

describe('contract reporter', () => {
    it('console output carries rule ids and authored intent', () => {
        const c = contract('landing')
            .at('*')
            .assert('noOverflow', undefined, { id: 'no-bleed', description: 'stay inside the viewport' })
            .build();
        const text = formatContractConsole(verifyContract(c, appStore()));
        expect(text).toContain('no-bleed');
        expect(text).toContain('stay inside the viewport');
    });
});

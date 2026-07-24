/**
 * verifyContract — execute a design contract against measurements.
 *
 * Pipeline: parse/resolve → expand design-system profile → scope each rule to
 * its width range (memoized sub-stores) → one Asserter per rule (trivial
 * violation→rule attribution, clean severity override) → score checks →
 * baseline comparisons → ContractReport.
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore } from '@responsivejs/core/types';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { DEFAULT_WIDTHS } from '@responsivejs/core/types';
import {
    parseContract,
    resolveAliases,
    inRange,
    CONSTRAINT_REGISTRY,
    type DesignContract,
    type ContractRule,
    type ContractReport,
    type ContractViolation,
    type RuleResult,
    type ScoreCheckResult,
    type BaselineResult,
    type AestheticMetricName,
    type ConstraintName,
} from '@responsivejs/contract';
import { Asserter } from '../constraints/index.js';
import type { DesignSystemConfig, ValidationSelectors } from '../constraints/design-system.js';
import { scoreFromStore, scoreSubtree } from '../score/index.js';
import { designSystemRules } from './design-system-rules.js';
import { compileRule } from './dispatch.js';
import { PlaywrightSource } from '../source/playwright.js';
import { sweepSource } from '../source/sweep.js';

import appleHig from '../design-systems/apple-hig.json' with { type: 'json' };
import fluentUi2 from '../design-systems/fluent-ui-2.json' with { type: 'json' };
import materialDesign3 from '../design-systems/material-design-3.json' with { type: 'json' };

const BUNDLED_PROFILES: Record<string, DesignSystemConfig> = {
    'apple-hig': appleHig as unknown as DesignSystemConfig,
    'fluent-ui-2': fluentUi2 as unknown as DesignSystemConfig,
    'material-design-3': materialDesign3 as unknown as DesignSystemConfig,
};

// ─── normalization ──────────────────────────────────────────────────────

interface NormalizedContract {
    parsed: DesignContract;
    /** Contract rules + expanded DS rules, every rule with a stable id. */
    rules: ContractRule[];
}

function normalize(input: DesignContract | object): NormalizedContract {
    const parsed = resolveAliases(parseContract(input));

    const rules: ContractRule[] = parsed.rules.map((r, i) => (r.id ? r : { ...r, id: `rule-${i + 1}-${r.assert}` }));

    if (parsed.designSystem) {
        const { profile, selectors } = parsed.designSystem;
        let config: DesignSystemConfig;
        if (typeof profile === 'string') {
            const bundled = BUNDLED_PROFILES[profile];
            if (!bundled) {
                throw new Error(
                    `r$: unknown design-system profile '${profile}'. Bundled: ${Object.keys(BUNDLED_PROFILES).join(', ')}.`,
                );
            }
            config = bundled;
        } else {
            config = profile as DesignSystemConfig;
        }
        rules.push(...designSystemRules(config, selectors as ValidationSelectors | undefined));
    }

    return { parsed, rules };
}

// ─── range-scoped sub-stores ────────────────────────────────────────────

function subStore(store: SnapshotStore, range: ContractRule['when'], cache: Map<string, SnapshotStore>): SnapshotStore {
    if (!range) return store;
    const key = `${range.min ?? ''}|${range.max ?? ''}`;
    let scoped = cache.get(key);
    if (!scoped) {
        const widths = store.widths.filter((w) => inRange(w, range));
        scoped = {
            widths,
            selectors: store.selectors,
            snapshots: new Map(widths.map((w) => [w, store.snapshots.get(w)!])),
        };
        cache.set(key, scoped);
    }
    return scoped;
}

// ─── verify ─────────────────────────────────────────────────────────────

export function verifyContract(contract: DesignContract | object, store: SnapshotStore): ContractReport;
export function verifyContract(
    contract: DesignContract | object,
    page: Page,
    opts?: { height?: number },
): Promise<ContractReport>;
export function verifyContract(
    contract: DesignContract | object,
    target: SnapshotStore | Page,
    opts: { height?: number } = {},
): ContractReport | Promise<ContractReport> {
    if (isStore(target)) return verifyStore(contract, target);
    return sweepAndVerify(contract, target, opts);
}

function isStore(target: SnapshotStore | Page): target is SnapshotStore {
    return typeof target === 'object' && target !== null && 'snapshots' in target && 'widths' in target;
}

function verifyStore(input: DesignContract | object, store: SnapshotStore): ContractReport {
    const { parsed, rules } = normalize(input);
    const cache = new Map<string, SnapshotStore>();

    const ruleResults: RuleResult[] = [];
    const allViolations: ContractViolation[] = [];
    let totalChecks = 0;

    for (const rule of rules) {
        const scoped = subStore(store, rule.when, cache);
        if (scoped.widths.length === 0) {
            ruleResults.push({ ruleId: rule.id!, assert: rule.assert, when: rule.when, pass: true, skipped: true, checks: 0, violations: [] });
            continue;
        }

        const asserter = new Asserter(scoped);
        compileRule(asserter, rule);
        const report = asserter.report();
        totalChecks += report.total;

        const violations: ContractViolation[] = report.violations.map((v) => ({
            ...v,
            ...(rule.severity ? { severity: rule.severity } : {}),
            ruleId: rule.id!,
            ...(rule.description ? { ruleDescription: rule.description } : {}),
        }));
        allViolations.push(...violations);
        ruleResults.push({
            ruleId: rule.id!,
            assert: rule.assert,
            when: rule.when,
            pass: violations.length === 0,
            checks: report.total,
            violations,
        });
    }

    // ─── score requirements ─────────────────────────────────────────────
    const scoreResults: ScoreCheckResult[] = [];
    (parsed.score ?? []).forEach((req, n) => {
        const scoped = subStore(store, req.when, cache);
        if (scoped.widths.length === 0) return;
        const result = req.scope ? scoreSubtree(scoped, req.scope) : scoreFromStore(scoped);

        const checks: [AestheticMetricName, number][] = [];
        if (req.min !== undefined) checks.push(['overall', req.min]);
        for (const [metric, min] of Object.entries(req.metrics ?? {})) {
            checks.push([metric as AestheticMetricName, min!]);
        }

        for (const [metric, min] of checks) {
            const evaluate = (actual: number, width?: number): void => {
                totalChecks++;
                const pass = actual >= min;
                scoreResults.push({ scope: req.scope, metric, width, min, actual, pass });
                if (!pass) {
                    allViolations.push({
                        rule: `score.${metric}`,
                        element: req.scope ?? 'page',
                        width: width ?? 0,
                        detail: `${metric} ${actual.toFixed(3)} < required ${min}${width === undefined ? ' (average)' : ''}`,
                        severity: 'error',
                        ruleId: `score-${n + 1}`,
                    });
                }
            };
            if (req.when) {
                for (const [w, score] of result.perWidth) evaluate(score[metric], w);
            } else {
                evaluate(result.average[metric]);
            }
        }
    });

    // ─── baselines ──────────────────────────────────────────────────────
    const baselineResults: BaselineResult[] = [];
    for (const spec of parsed.baselines ?? []) {
        if (!spec.curve || spec.curve.length === 0) {
            baselineResults.push({ selector: spec.selector, prop: spec.prop, pass: true, unrecorded: true, deviations: [] });
            continue;
        }
        const measured = measureCurve(store, spec.selector, spec.prop);
        const tolerance = spec.tolerance ?? { px: 2 };
        const deviations: BaselineResult['deviations'] = [];

        for (const [width, expected] of spec.curve) {
            totalChecks++;
            const actual = measured.get(width);
            if (actual === undefined) {
                deviations.push({ width, expected, actual: NaN, delta: NaN });
                continue;
            }
            const delta = Math.abs(actual - expected);
            const pxFail = tolerance.px !== undefined && delta > tolerance.px;
            const pctFail =
                tolerance.percent !== undefined && expected !== 0 && (delta / Math.abs(expected)) * 100 > tolerance.percent;
            if (pxFail || pctFail) deviations.push({ width, expected, actual, delta });
        }

        const pass = deviations.length === 0;
        baselineResults.push({ selector: spec.selector, prop: spec.prop, pass, deviations });
        if (!pass) {
            for (const d of deviations) {
                allViolations.push({
                    rule: 'baseline',
                    element: spec.selector,
                    width: d.width,
                    detail: Number.isNaN(d.actual)
                        ? `${spec.prop}: no measurement at recorded width ${d.width}`
                        : `${spec.prop}: expected ${d.expected}, measured ${d.actual} (Δ${Math.round(d.delta * 100) / 100})`,
                    severity: 'error',
                    ruleId: `baseline-${spec.selector}-${spec.prop}`,
                });
            }
        }
    }

    const failed = allViolations.length;
    return {
        contract: { name: parsed.name, version: parsed.version },
        pass: allViolations.every((v) => (v.severity ?? 'error') !== 'error'),
        total: totalChecks,
        passed: totalChecks - failed,
        failed,
        rules: ruleResults,
        violations: allViolations,
        ...(scoreResults.length > 0 ? { score: scoreResults } : {}),
        ...(baselineResults.length > 0 ? { baselines: baselineResults } : {}),
    };
}

function measureCurve(store: SnapshotStore, selector: string, prop: 'width' | 'height' | 'x' | 'y' | 'fontSize'): Map<number, number> {
    return new StoreQuery(store).curve(selector, prop);
}

// ─── record ─────────────────────────────────────────────────────────────

/** Fill baselines[].curve from measurements — the "record then assert" flow. */
export function recordBaseline(contract: DesignContract | object, store: SnapshotStore): DesignContract {
    const parsed = resolveAliases(parseContract(contract));
    return {
        ...parsed,
        baselines: (parsed.baselines ?? []).map((spec) => ({
            ...spec,
            curve: [...measureCurve(store, spec.selector, spec.prop)].sort((a, b) => a[0] - b[0]),
        })),
    };
}

// ─── page overload: derive the sweep from the contract itself ───────────

function collectSelectors(rules: ContractRule[], parsed: DesignContract): string[] {
    const selectors = new Set<string>();
    for (const rule of rules) {
        const spec = CONSTRAINT_REGISTRY[rule.assert as ConstraintName];
        for (const [name, paramSpec] of Object.entries(spec.params)) {
            const value = rule.args?.[name];
            if (paramSpec.type === 'selector' && typeof value === 'string') selectors.add(value);
            if (paramSpec.type === 'selectorArray' && Array.isArray(value)) {
                for (const v of value) if (typeof v === 'string') selectors.add(v);
            }
        }
    }
    for (const req of parsed.score ?? []) if (req.scope) selectors.add(req.scope);
    for (const spec of parsed.baselines ?? []) selectors.add(spec.selector);
    return [...selectors];
}

function deriveWidths(parsed: DesignContract, rules: ContractRule[]): number[] {
    const vp = parsed.viewport;
    let widths: number[];
    if (vp?.widths) widths = [...vp.widths];
    else if (vp?.from !== undefined && vp?.to !== undefined) {
        widths = [];
        for (let w = vp.from; w <= vp.to; w += vp.step || 50) widths.push(w);
    } else widths = [...DEFAULT_WIDTHS];

    // breakpointSafe needs bp±1 samples to be meaningful.
    for (const rule of rules) {
        if (rule.assert === 'breakpointSafe' && Array.isArray(rule.args?.breakpoints)) {
            for (const bp of rule.args.breakpoints as number[]) widths.push(bp - 1, bp + 1);
        }
    }
    return [...new Set(widths)].sort((a, b) => a - b);
}

/** The sweep a contract implies: selectors from rule args, widths from viewport (+bp±1). */
export interface ContractSweepPlan {
    selectors: string[];
    widths: number[];
    height?: number;
}

/** Driver-neutral: feed the plan to any MeasurementSource, then verify the store. */
export function contractSweepPlan(input: DesignContract | object): ContractSweepPlan {
    const { parsed, rules } = normalize(input);
    return {
        selectors: collectSelectors(rules, parsed),
        widths: deriveWidths(parsed, rules),
        ...(parsed.viewport?.height !== undefined ? { height: parsed.viewport.height } : {}),
    };
}

async function sweepAndVerify(input: DesignContract | object, page: Page, opts: { height?: number }): Promise<ContractReport> {
    const plan = contractSweepPlan(input);
    const store = await sweepSource(new PlaywrightSource(page), {
        url: '',
        ...plan,
        height: opts.height ?? plan.height,
    });
    return verifyStore(input, store);
}

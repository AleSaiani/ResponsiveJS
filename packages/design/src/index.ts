/**
 * ResponsiveJS (r$)
 *
 * The screen is a parametric Cartesian plane.
 * Every element property is a function: value = f(viewportWidth).
 * r$ measures, models, and validates these functions.
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore, SweepOptions, Report, InteractionSnapshot } from '@responsivejs/core/types';
import { sweep, resweep as doResweep } from './driver/sweeper.js';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { Asserter } from './constraints/index.js';
import { formatConsole, formatJSON, formatCompact } from './report/reporter.js';
import { scoreFromStore, scoreSubtree, type ScoreResult } from './score/index.js';
import { LiveValidator } from './realtime/live.js';
import { applyDesignSystem, type DesignSystemConfig, type ValidationSelectors } from './constraints/design-system.js';
import { analyze, type AnalyzeOptions } from './analyze/index.js';
import type { UnifiedReport } from './analyze/core.js';
import { PlaywrightSource } from './source/playwright.js';

export class ResponsiveValidator {
    private store: SnapshotStore | null = null;
    private _assert: Asserter | null = null;

    constructor(private readonly page: Page) {}

    /** Sweep the page across multiple viewport widths, measuring all elements */
    async sweep(opts: SweepOptions): Promise<this> {
        this.store = await sweep(this.page, opts);
        this._assert = new Asserter(this.store);
        return this;
    }

    /** Query measurements at a specific viewport width */
    at(width: number) {
        this.ensureSwept();
        return new StoreQuery(this.store!).at(width);
    }

    /** Build a property curve across all viewport widths */
    curve(selector: string, prop: Parameters<StoreQuery['curve']>[1]) {
        this.ensureSwept();
        return new StoreQuery(this.store!).curve(selector, prop);
    }

    /** Build a rect property curve */
    rectCurve(selector: string, prop: Parameters<StoreQuery['rectCurve']>[1]) {
        this.ensureSwept();
        return new StoreQuery(this.store!).rectCurve(selector, prop);
    }

    /** Access the constraint asserter (fluent chain) */
    get assert(): Asserter {
        this.ensureSwept();
        return this._assert!;
    }

    /** Compute aesthetic score (Ngo metrics + Birkhoff) from measured data.
     *  If parentSelector is provided, scores only the subtree within that parent. */
    score(parentSelector?: string): ScoreResult {
        this.ensureSwept();
        if (parentSelector) {
            return scoreSubtree(this.store!, parentSelector);
        }
        return scoreFromStore(this.store!);
    }

    /** Get the validation report */
    report(): Report {
        this.ensureSwept();
        return this._assert!.report();
    }

    /** Print report to console */
    log(format: 'console' | 'json' | 'compact' = 'console'): this {
        const report = this.report();
        switch (format) {
            case 'json': console.log(formatJSON(report)); break;
            case 'compact': console.log(formatCompact(report)); break;
            default: console.log(formatConsole(report));
        }
        return this;
    }

    /** Get all measured viewport widths */
    get widths(): number[] {
        this.ensureSwept();
        return this.store!.widths;
    }

    /** Get the raw snapshot store */
    get raw(): SnapshotStore {
        this.ensureSwept();
        return this.store!;
    }

    /** Measure an element in normal, hover, and focus states */
    async measureInteraction(selector: string): Promise<InteractionSnapshot> {
        this.ensureSwept();
        const { measureInteraction: mi } = await import('./driver/measurer.js');
        return mi(this.page, selector, this.store!.selectors);
    }

    /** Incrementally re-sweep specific widths/selectors, merging into existing data. */
    async resweep(opts?: { widths?: number[]; selectors?: string[] }): Promise<this> {
        this.ensureSwept();
        this.store = await doResweep(this.page, this.store!, opts ?? {});
        this._assert = new Asserter(this.store);
        return this;
    }

    /** Run the unified oracle: constraints + score + a11y (axe, when available).
     *  Reuses the existing sweep when present; otherwise sweeps first (needs url+selectors). */
    async analyze(opts: Omit<AnalyzeOptions, 'source' | 'store'> = {}): Promise<UnifiedReport> {
        return analyze({
            ...opts,
            source: new PlaywrightSource(this.page),
            store: this.store ?? undefined,
            selectors: opts.selectors ?? this.store?.selectors,
        });
    }

    /** Validate against a design system — loads DS rules and applies all constraints automatically.
     *  Call after sweep(). Returns the report. */
    validateDesignSystem(ds: DesignSystemConfig, selectors?: ValidationSelectors): Report {
        this.ensureSwept();
        this._assert = new Asserter(this.store!);
        applyDesignSystem(this._assert, ds, selectors);
        return this._assert.report();
    }

    /** Create a LiveValidator for real-time measurement via browser observers. */
    static async live(page: Page, opts: { selectors: string[] }): Promise<LiveValidator> {
        const lv = new LiveValidator();
        await lv.attach(page, opts.selectors);
        return lv;
    }

    private ensureSwept(): void {
        if (!this.store) throw new Error('r$: call sweep() first');
    }
}

/** Create a new r$ validator for a Playwright page */
export function r$(page: Page): ResponsiveValidator {
    return new ResponsiveValidator(page);
}

// Re-export types and math utilities
export type { Rect } from '@responsivejs/core/rect';
export type { Curve } from '@responsivejs/core/curve';
export type { Report, Violation, SweepOptions, ElementSnapshot, ViewportSnapshot, ChildRelation, FixSuggestion, InteractionSnapshot } from '@responsivejs/core/types';
export { DEFAULT_WIDTHS } from '@responsivejs/core/types';
export * as rect from '@responsivejs/core/rect';
export * as curve from '@responsivejs/core/curve';
export * as stats from '@responsivejs/core/stats';
export * as color from '@responsivejs/core/color';
export * as typography from '@responsivejs/core/typography';
export * as aesthetics from '@responsivejs/core/aesthetics';
export type { AestheticScore } from '@responsivejs/core/aesthetics';
export type { ScoreResult } from './score/index.js';
export { LiveValidator } from './realtime/live.js';
export { calibrate, DEFAULT_WEIGHTS as CALIBRATION_DEFAULTS, type CalibrationSample, type CalibrationResult } from './score/calibration.js';
export { applyDesignSystem, type DesignSystemConfig, type ValidationSelectors } from './constraints/design-system.js';

// ─── F3: unified oracle + MeasurementSource ─────────────────────────────
export { analyze, type AnalyzeOptions } from './analyze/index.js';
export {
    analyzeStore,
    mergeReports,
    type AnalyzeStoreOptions,
    type UnifiedReport,
    type ConstraintsConfig,
} from './analyze/core.js';
export type { MeasurementSource } from './source/types.js';
export { PlaywrightSource, type PlaywrightSourceOptions } from './source/playwright.js';
export { CdpSource, type CdpClient, type CdpSourceOptions } from './source/cdp.js';
export { EvalSource, chunkedEval, type EvalFn, type EvalSourceOptions, type ChunkedEvalOptions } from './source/eval.js';
export { sweepSource, resweepSource, resolveWidths, type SourceSweepOptions } from './source/sweep.js';
export { runAxe, normalizeAxeResults, type A11yOptions } from './a11y/axe.js';
export { storeToJSON, storeFromJSON, type SerializedStore, type ViewportSnapshotWire } from './browser/wire.js';
export {
    formatConsole,
    formatJSON,
    formatCompact,
    formatSARIF,
    toSerializable,
    formatContractConsole,
    formatContractCompact,
} from './report/reporter.js';
export { Asserter } from './constraints/index.js';

// ─── F5: design-contract execution ──────────────────────────────────────
export { verifyContract, recordBaseline } from './contract/verify.js';
export { designSystemRules } from './contract/design-system-rules.js';
export { compileRule } from './contract/dispatch.js';
export {
    contract,
    ContractBuilder,
    parseContract,
    validateContract,
    resolveAliases,
    CONSTRAINT_REGISTRY,
    CONSTRAINT_NAMES,
    type DesignContract,
    type ContractRule,
    type ContractReport,
    type ContractViolation,
    type ConstraintName,
} from '@responsivejs/contract';

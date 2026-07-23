/**
 * analyzeStore — the pure, driver-free half of the unified oracle.
 * Constraints + aesthetic score + merge over an in-memory SnapshotStore.
 * Exported from the browser subpath too: no Playwright anywhere below here.
 */

import type { SnapshotStore, Report, Violation, FixSuggestion } from '@responsivejs/core/types';
import { Asserter } from '../constraints/index.js';
import { applyDesignSystem, type DesignSystemConfig, type ValidationSelectors } from '../constraints/design-system.js';
import { scoreFromStore, scoreSubtree, type ScoreResult } from '../score/index.js';

export interface ConstraintsConfig {
    /** Default: true. */
    noOverflow?: boolean;
    /** Default: AA on every analyzed selector. false disables. */
    contrast?: { selectors?: string[]; level?: 'AA' | 'AAA' } | false;
    /** Default: every analyzed selector. false disables. */
    touchTarget?: string[] | false;
    textReadable?: string[];
    focusVisible?: string[];
    /** Escape hatch: the full 24-constraint Asserter surface. */
    custom?: (assert: Asserter) => void;
}

export interface AnalyzeStoreOptions {
    /** Default: store.selectors. */
    selectors?: string[];
    constraints?: ConstraintsConfig | ((assert: Asserter) => void);
    designSystem?: { config: DesignSystemConfig; selectors?: ValidationSelectors };
    /** Default: whole-page score. { subtree } scopes it; false disables. */
    score?: { subtree?: string } | false;
}

export interface UnifiedReport extends Report {
    /** pass = zero error-severity violations; clean = zero violations at all. */
    clean: boolean;
    scores?: ScoreResult;
    /** Flattened non-null fixes — the agent-loop surface. */
    fixes: FixSuggestion[];
    widths: number[];
    url?: string;
    sources: { measurement: string; a11y: 'axe' | 'skipped' | 'unavailable' };
    summary: {
        errors: number;
        warnings: number;
        info: number;
        byRule: Record<string, number>;
        byWidth: Record<string, number>;
    };
    durationMs: number;
}

/** Violations without an explicit severity keep the legacy strictness: error. */
export function severityOf(v: Violation): 'error' | 'warning' | 'info' {
    return v.severity ?? 'error';
}

export function summarize(violations: Violation[]): UnifiedReport['summary'] {
    const summary: UnifiedReport['summary'] = { errors: 0, warnings: 0, info: 0, byRule: {}, byWidth: {} };
    for (const v of violations) {
        const sev = severityOf(v);
        if (sev === 'error') summary.errors++;
        else if (sev === 'warning') summary.warnings++;
        else summary.info++;
        summary.byRule[v.rule] = (summary.byRule[v.rule] ?? 0) + 1;
        const w = String(v.width);
        summary.byWidth[w] = (summary.byWidth[w] ?? 0) + 1;
    }
    return summary;
}

function applyDefaultConstraints(assert: Asserter, selectors: string[], cfg: ConstraintsConfig): void {
    if (cfg.noOverflow !== false) assert.noOverflow();

    if (cfg.contrast !== false) {
        const level = (cfg.contrast && cfg.contrast.level) || 'AA';
        for (const sel of (cfg.contrast && cfg.contrast.selectors) || selectors) {
            assert.contrastRatio(sel, level);
        }
    }

    if (cfg.touchTarget !== false) {
        for (const sel of cfg.touchTarget ?? selectors) assert.touchTarget(sel);
    }

    for (const sel of cfg.textReadable ?? []) assert.textReadable(sel);
    for (const sel of cfg.focusVisible ?? []) assert.focusVisible(sel);

    cfg.custom?.(assert);
}

/** Analyze an in-memory store: constraints + score → UnifiedReport (sync, pure). */
export function analyzeStore(store: SnapshotStore, opts: AnalyzeStoreOptions = {}): UnifiedReport {
    const started = Date.now();
    const selectors = opts.selectors ?? store.selectors;
    const assert = new Asserter(store);

    if (opts.designSystem) {
        applyDesignSystem(assert, opts.designSystem.config, opts.designSystem.selectors);
    }
    if (typeof opts.constraints === 'function') {
        opts.constraints(assert);
    } else {
        applyDefaultConstraints(assert, selectors, opts.constraints ?? {});
    }

    const base = assert.report();
    let scores: ScoreResult | undefined;
    if (opts.score !== false) {
        scores = opts.score?.subtree ? scoreSubtree(store, opts.score.subtree) : scoreFromStore(store);
    }

    return finalizeReport(base, {
        scores,
        widths: store.widths,
        measurement: 'store',
        a11y: 'skipped',
        durationMs: Date.now() - started,
    });
}

interface FinalizeExtras {
    scores?: ScoreResult;
    widths: number[];
    url?: string;
    measurement: string;
    a11y: UnifiedReport['sources']['a11y'];
    durationMs: number;
}

/** Assemble a UnifiedReport from a base Report and context. */
export function finalizeReport(base: Report, extras: FinalizeExtras): UnifiedReport {
    const summary = summarize(base.violations);
    return {
        ...base,
        pass: summary.errors === 0,
        clean: base.violations.length === 0,
        scores: extras.scores,
        fixes: base.violations.map((v) => v.fix).filter((f): f is FixSuggestion => f !== undefined),
        widths: extras.widths,
        url: extras.url,
        sources: { measurement: extras.measurement, a11y: extras.a11y },
        summary,
        durationMs: extras.durationMs,
    };
}

/** Merge additional partial reports (e.g. a consumer's own checks) into one. */
export function mergeReports(base: UnifiedReport, ...extra: Report[]): UnifiedReport {
    const violations = [...base.violations, ...extra.flatMap((r) => r.violations)];
    const total = base.total + extra.reduce((n, r) => n + r.total, 0);
    const failed = violations.length;
    const merged: Report = { pass: failed === 0, total, passed: total - failed, failed, violations };
    return finalizeReport(merged, {
        scores: base.scores,
        widths: base.widths,
        url: base.url,
        measurement: base.sources.measurement,
        a11y: base.sources.a11y,
        durationMs: base.durationMs,
    });
}

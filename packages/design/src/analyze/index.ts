/**
 * analyze() — the async orchestrator of the unified oracle:
 * sweep (any MeasurementSource) → constraints + score (analyzeStore) → axe.
 */

import type { SnapshotStore } from '@responsivejs/core/types';
import type { MeasurementSource } from '../source/types.js';
import { sweepSource } from '../source/sweep.js';
import { runAxe, type A11yOptions } from '../a11y/axe.js';
import { analyzeStore, finalizeReport, attachOwnership, type AnalyzeStoreOptions, type UnifiedReport } from './core.js';

export interface AnalyzeOptions extends AnalyzeStoreOptions {
    /** Required unless `store` is given. Also enables a11y for store input. */
    source?: MeasurementSource;
    /** Pre-measured input: skips the sweep. */
    store?: SnapshotStore;
    /** Required when sweeping against a source with open(). */
    url?: string;
    /** Required when sweeping. */
    selectors?: string[];
    widths?: number[];
    from?: number;
    to?: number;
    step?: number;
    height?: number;
    scroll?: boolean;
    scrollSteps?: number;
    /** Capture a viewport screenshot per width into store.screenshots. */
    screenshots?: boolean;
    /**
     * Default: runs when axe-core is installed and the source can evaluate;
     * silently skipped otherwise. Explicit config + missing axe-core → throw.
     */
    a11y?: A11yOptions | false;
}

export async function analyze(opts: AnalyzeOptions): Promise<UnifiedReport> {
    const started = Date.now();
    const { source, store: givenStore } = opts;

    if (!source && !givenStore) {
        throw new Error('r$: analyze() needs a source (MeasurementSource) or a store (SnapshotStore)');
    }

    let store = givenStore;
    if (!store) {
        if (!opts.selectors || opts.selectors.length === 0) {
            throw new Error('r$: analyze() needs selectors to sweep');
        }
        store = await sweepSource(source!, {
            url: opts.url ?? '',
            selectors: opts.selectors,
            widths: opts.widths,
            from: opts.from,
            to: opts.to,
            step: opts.step,
            height: opts.height,
            scroll: opts.scroll,
            scrollSteps: opts.scrollSteps,
            screenshots: opts.screenshots,
        });
    }

    const baseline = analyzeStore(store, opts);

    // ─── a11y layer ─────────────────────────────────────────────────────
    let a11yState: UnifiedReport['sources']['a11y'] = 'skipped';
    const axeViolations = [];
    let axePasses = 0;

    if (opts.a11y !== false && source?.evaluate) {
        const outcome = await runAxe(source, store.widths, opts.height ?? 900, opts.a11y ?? {});
        if ('unavailable' in outcome) {
            if (opts.a11y !== undefined) {
                throw new Error(`r$: a11y was requested but ${outcome.unavailable}`);
            }
            a11yState = 'unavailable';
        } else {
            a11yState = 'axe';
            axeViolations.push(...outcome.violations);
            axePasses = outcome.passes;
        }
    } else if (opts.a11y !== false && opts.a11y !== undefined && !source?.evaluate) {
        throw new Error('r$: a11y was requested but the input has no evaluate-capable source');
    }

    const violations = [...baseline.violations, ...axeViolations];
    attachOwnership(violations, store.manifest);
    const total = baseline.total + axeViolations.length + axePasses;

    return finalizeReport(
        { pass: violations.length === 0, total, passed: total - violations.length, failed: violations.length, violations },
        {
            scores: baseline.scores,
            widths: store.widths,
            url: opts.url,
            measurement: source?.kind ?? 'store',
            a11y: a11yState,
            durationMs: Date.now() - started,
            manifest: store.manifest,
        },
    );
}

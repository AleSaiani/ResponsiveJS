/**
 * analyzeDOM — the one-call in-page oracle: measure the LIVE DOM at the
 * current viewport and judge it. What the overlay, the bookmarklet and a
 * devtools console all share. Single-width by nature — the CLI does the
 * full sweep.
 */

import { collectStore, type CollectOptions } from './collect.js';
import { analyzeStore, LANDMARK_SELECTORS, type AnalyzeStoreOptions, type UnifiedReport } from '../analyze/core.js';

export function analyzeDOM(
    selectors: string[] = LANDMARK_SELECTORS,
    opts: AnalyzeStoreOptions & { collect?: CollectOptions } = {},
): UnifiedReport {
    return analyzeStore(collectStore(selectors, opts.collect), opts);
}

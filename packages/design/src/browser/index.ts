/**
 * r$ Browser core — the ZERO-DRIVER entry point (RESPONSIVE-STRATEGY §3).
 *
 * Playwright-free: safe to import in a browser app (the theme builder) or to
 * inject into any page via a driver's eval. Exposes the live-DOM collector +
 * the pure scoring core. The main entry (`@responsivejs/design`) keeps the
 * Playwright driver for CI.
 */

export { collectViewport, collectStore, type CollectOptions } from './collect.js';
export { scoreFromStore, scoreSubtree, type ScoreResult } from '../score/index.js';
export { score as computeScore, type AestheticScore } from '@responsivejs/core/aesthetics';
export type { ViewportSnapshot, SnapshotStore, ElementSnapshot, ChildRelation } from '@responsivejs/core/types';

// F3: the pure oracle + injection/wire toolkit (all driver-free)
export {
    analyzeStore,
    mergeReports,
    LANDMARK_SELECTORS,
    type AnalyzeStoreOptions,
    type UnifiedReport,
    type ConstraintsConfig,
} from '../analyze/core.js';

// M4: the injectable surface — one-call oracle + the in-page overlay
export { analyzeDOM } from './analyze-dom.js';
export { defineOverlay, mountOverlay, type OverlayOptions } from './overlay.js';
export { collectPage, buildCollectExpression, type CollectArgs } from './inject.js';
export {
    fromWire,
    toWire,
    storeToJSON,
    storeFromJSON,
    type ViewportSnapshotWire,
    type SerializedStore,
} from './wire.js';

import { collectStore, type CollectOptions } from './collect.js';
import { scoreFromStore, type ScoreResult } from '../score/index.js';

/** One-shot: measure the live DOM (matching `selectors`) and score it. Browser-only. */
export function scoreDOM(selectors: string[], opts?: CollectOptions): ScoreResult {
    return scoreFromStore(collectStore(selectors, opts));
}

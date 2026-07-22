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

import { collectStore, type CollectOptions } from './collect.js';
import { scoreFromStore, type ScoreResult } from '../score/index.js';

/** One-shot: measure the live DOM (matching `selectors`) and score it. Browser-only. */
export function scoreDOM(selectors: string[], opts?: CollectOptions): ScoreResult {
    return scoreFromStore(collectStore(selectors, opts));
}

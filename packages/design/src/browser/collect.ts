/**
 * Browser-native collector — the ZERO-DRIVER measurement source.
 *
 * Runs the shared in-page collector (`inject.ts`) directly against the live
 * DOM — no Playwright, no driver. Use it in-page (theme builder, devtool) or
 * let a driver inject it via eval; either way the measurements are identical.
 */

import type { ViewportSnapshot, SnapshotStore } from '@responsivejs/core/types';
import { collectPage } from './inject.js';
import { fromWire } from './wire.js';

export interface CollectOptions {
    /** Scope the query to a subtree (default: `document`). */
    root?: ParentNode;
    /** Override the measured viewport (default: `window.innerWidth`/`Height`). */
    width?: number;
    height?: number;
}

/** Measure all elements matching `selectors` from the LIVE DOM. Browser-only. */
export function collectViewport(selectors: string[], opts: CollectOptions = {}): ViewportSnapshot {
    const wire = collectPage({ selectors, width: opts.width, height: opts.height }, opts.root);
    return fromWire(wire);
}

/** Wrap a single live-DOM measurement into a `SnapshotStore` for the scoring core. */
export function collectStore(selectors: string[], opts: CollectOptions = {}): SnapshotStore {
    const snap = collectViewport(selectors, opts);
    return { snapshots: new Map([[snap.width, snap]]), widths: [snap.width], selectors };
}

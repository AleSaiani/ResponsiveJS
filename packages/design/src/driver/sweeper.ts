/**
 * Playwright sweep — a thin delegate over the driver-neutral sweeper
 * (source/sweep.ts) via PlaywrightSource. Public API unchanged.
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore, SweepOptions } from '@responsivejs/core/types';
import { PlaywrightSource } from '../source/playwright.js';
import { sweepSource, resweepSource } from '../source/sweep.js';

/**
 * Sweep the page across multiple viewport widths, measuring elements at each.
 * Returns a SnapshotStore with all measurements indexed by width.
 */
export function sweep(page: Page, opts: SweepOptions): Promise<SnapshotStore> {
    return sweepSource(new PlaywrightSource(page), opts);
}

/**
 * Incremental re-sweep: re-measure specific widths/selectors and merge into existing store.
 */
export function resweep(
    page: Page,
    existingStore: SnapshotStore,
    opts: { widths?: number[]; selectors?: string[]; height?: number },
): Promise<SnapshotStore> {
    return resweepSource(new PlaywrightSource(page), existingStore, opts);
}

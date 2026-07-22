/**
 * Sweeper: orchestrates viewport resize + measurement across multiple widths.
 * This is where property = f(viewportWidth) gets its data points.
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore, SweepOptions, ViewportSnapshot } from '@responsivejs/core/types';
import { DEFAULT_WIDTHS } from '@responsivejs/core/types';
import { measure, measureAtScroll } from './measurer.js';

/** Resolve sweep options to a concrete list of widths */
function resolveWidths(opts: SweepOptions): number[] {
    if (opts.widths) return [...opts.widths].sort((a, b) => a - b);
    if (opts.from !== undefined && opts.to !== undefined) {
        const step = opts.step || 50;
        const widths: number[] = [];
        for (let w = opts.from; w <= opts.to; w += step) {
            widths.push(w);
        }
        return widths;
    }
    return [...DEFAULT_WIDTHS];
}

/**
 * Sweep the page across multiple viewport widths, measuring elements at each.
 * Returns a SnapshotStore with all measurements indexed by width.
 */
export async function sweep(page: Page, opts: SweepOptions): Promise<SnapshotStore> {
    const widths = resolveWidths(opts);
    const height = opts.height || 900;
    const snapshots = new Map<number, ViewportSnapshot>();

    // Navigate to URL
    await page.goto(opts.url, { waitUntil: 'networkidle' });

    for (const w of widths) {
        // Resize viewport
        await page.setViewportSize({ width: w, height });

        // Wait for layout to settle (CSS transitions, container queries)
        await page.waitForTimeout(50);

        // Measure
        const snapshot = await measure(page, opts.selectors);

        // Scroll measurement: capture elements that are only visible after scrolling
        if (opts.scroll) {
            const scrollSteps = opts.scrollSteps ?? 3;
            const pageHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
            const viewportHeight = height;

            for (let step = 1; step <= scrollSteps; step++) {
                const scrollY = Math.min(step * viewportHeight, pageHeight - viewportHeight);
                if (scrollY <= 0) break;

                const scrollSnapshot = await measureAtScroll(page, opts.selectors, scrollY);

                // Merge new elements into existing snapshot (don't overwrite)
                for (const [sel, elements] of scrollSnapshot.elements) {
                    const existing = snapshot.elements.get(sel);
                    if (!existing) {
                        snapshot.elements.set(sel, elements);
                    } else {
                        // Add elements with indices not already present
                        const existingIndices = new Set(existing.map(e => e.index));
                        for (const el of elements) {
                            if (!existingIndices.has(el.index)) {
                                existing.push(el);
                            }
                        }
                    }
                }

                // Merge child relations
                for (const [sel, relations] of scrollSnapshot.childRelations) {
                    if (!snapshot.childRelations.has(sel)) {
                        snapshot.childRelations.set(sel, relations);
                    }
                }
            }

            // Scroll back to top
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(50);
        }

        snapshots.set(w, snapshot);
    }

    return {
        snapshots,
        widths,
        selectors: opts.selectors,
    };
}

/**
 * Incremental re-sweep: re-measure specific widths/selectors and merge into existing store.
 * Only re-measures the specified widths (or all if omitted).
 * Only measures specified selectors (or existingStore.selectors if omitted).
 * Overwrites re-measured widths in the existing store.
 */
export async function resweep(
    page: Page,
    existingStore: SnapshotStore,
    opts: { widths?: number[]; selectors?: string[]; height?: number }
): Promise<SnapshotStore> {
    const widthsToMeasure = opts.widths ?? [...existingStore.widths];
    const selectors = opts.selectors ?? existingStore.selectors;
    const height = opts.height ?? 900;

    // Clone existing snapshots
    const snapshots = new Map(existingStore.snapshots);

    for (const w of widthsToMeasure) {
        await page.setViewportSize({ width: w, height });
        await page.waitForTimeout(50);
        const snapshot = await measure(page, selectors);
        snapshots.set(w, snapshot);
    }

    // Build the combined widths list (union of existing + new, sorted)
    const allWidths = new Set([...existingStore.widths, ...widthsToMeasure]);
    const sortedWidths = [...allWidths].sort((a, b) => a - b);

    // Merge selectors (union of existing + new)
    const allSelectors = [...new Set([...existingStore.selectors, ...selectors])];

    return {
        snapshots,
        widths: sortedWidths,
        selectors: allSelectors,
    };
}

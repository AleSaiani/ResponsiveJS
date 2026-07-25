/**
 * LiveValidator — attach to a Playwright page and keep measuring it while it
 * changes (theme builders, devtools, tuning loops).
 *
 * It runs the SAME in-page collector as every other path (sweep, CDP,
 * agent-browser, the browser bundle), so its measurements are identical:
 * DOM-semantic interactivity, effective backgrounds, overflow containment and
 * the provenance manifest all come along.
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore, ViewportSnapshot, Report } from '@responsivejs/core/types';
import type { AestheticScore } from '@responsivejs/core/aesthetics';
import { score as computeScore } from '@responsivejs/core/aesthetics';
import {
    buildObserverScript,
    buildReadWidthExpression,
    CLEAR_LIVE_EXPRESSION,
    READ_LIVE_EXPRESSION,
    STOP_LIVE_EXPRESSION,
} from './observer.js';
import { fromWire, type ViewportSnapshotWire } from '../browser/wire.js';
import { Asserter } from '../constraints/index.js';

export class LiveValidator {
    private page: Page | null = null;
    private selectors: string[] = [];

    /** Inject the observers and take a first measurement. */
    async attach(page: Page, selectors: string[]): Promise<void> {
        this.page = page;
        this.selectors = selectors;
        await page.evaluate(buildObserverScript(selectors));
    }

    /** Every measurement collected so far, as a SnapshotStore. */
    async snapshot(): Promise<SnapshotStore> {
        this.ensureAttached();
        const entries = await this.page!.evaluate<[number, ViewportSnapshotWire][]>(READ_LIVE_EXPRESSION);

        const snapshots = new Map<number, ViewportSnapshot>();
        let manifest: SnapshotStore['manifest'];
        for (const [width, wire] of entries ?? []) {
            const snap = fromWire(wire);
            snapshots.set(width, snap);
            if (snap.manifest) manifest = snap.manifest;
        }

        return {
            snapshots,
            widths: [...snapshots.keys()].sort((a, b) => a - b),
            selectors: this.selectors,
            ...(manifest ? { manifest } : {}),
        };
    }

    /** Resize the viewport and let the observers re-measure. */
    async resizeTo(width: number, height = 900): Promise<void> {
        this.ensureAttached();
        await this.page!.setViewportSize({ width, height });
        await this.page!.waitForTimeout(100);
    }

    /** Aesthetic score at the current (or given) viewport width. */
    async scoreAt(width?: number): Promise<AestheticScore> {
        this.ensureAttached();
        const targetWidth = width ?? (await this.page!.evaluate<number>('window.innerWidth'));

        // Bounded probe (L-94): the previous version recursed forever when no
        // snapshot existed, because clearing never produces a fresh measurement.
        for (let attempt = 0; attempt < 2; attempt++) {
            const wire = await this.page!.evaluate<ViewportSnapshotWire | null>(buildReadWidthExpression(targetWidth));
            if (wire) {
                const snap = fromWire(wire);
                const rects = [...snap.elements.values()].flat().map((e) => e.rect);
                return computeScore(rects, { width: snap.width, height: snap.height });
            }
            await this.page!.evaluate(CLEAR_LIVE_EXPRESSION);
            await this.page!.waitForTimeout(50);
        }

        const height = await this.page!.evaluate<number>('window.innerHeight');
        return computeScore([], { width: targetWidth, height });
    }

    /** Build a store from the current measurements and run the Asserter. */
    async check(): Promise<Report> {
        const store = await this.snapshot();
        const asserter = new Asserter(store);
        asserter.noOverflow();
        return asserter.report();
    }

    /** Disconnect the observers and drop the in-page store. */
    async detach(): Promise<void> {
        if (this.page) await this.page.evaluate(STOP_LIVE_EXPRESSION);
        this.page = null;
        this.selectors = [];
    }

    private ensureAttached(): void {
        if (!this.page) throw new Error('r$ LiveValidator: call attach() first');
    }
}

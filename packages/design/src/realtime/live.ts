/**
 * LiveValidator — attach to a Playwright page for real-time measurement
 * via browser-injected observers (ResizeObserver + MutationObserver).
 */

import type { Page } from '@playwright/test';
import type { SnapshotStore, ViewportSnapshot, ElementSnapshot, ChildRelation, Report } from '@responsivejs/core/types';
import type { AestheticScore } from '@responsivejs/core/aesthetics';
import { score as computeScore } from '@responsivejs/core/aesthetics';
import { buildObserverScript } from './observer.js';
import { Asserter } from '../constraints/index.js';
import { fromDOMRect } from '@responsivejs/core/rect';

/** Raw snapshot shape stored by the browser observer script. */
interface BrowserSnapshot {
    width: number;
    height: number;
    measurements: BrowserMeasurement[];
    timestamp: number;
}

/** Single element measurement as stored by the observer. */
interface BrowserMeasurement {
    selector: string;
    index: number;
    rect: { x: number; y: number; width: number; height: number };
    styles: ElementSnapshot['styles'];
    computed: ElementSnapshot['computed'];
}

export class LiveValidator {
    private page: Page | null = null;
    private selectors: string[] = [];

    /** Inject observers into the page and start measuring. */
    async attach(page: Page, selectors: string[]): Promise<void> {
        this.page = page;
        this.selectors = selectors;
        await page.evaluate(buildObserverScript(selectors));
    }

    /** Read all collected measurements from the browser and convert to SnapshotStore. */
    async snapshot(): Promise<SnapshotStore> {
        this.ensureAttached();

        // Read __rjs_store from browser — it's a Map<number, BrowserSnapshot>
        const rawEntries: [number, BrowserSnapshot][] = await this.page!.evaluate(() => {
            const store = (window as any).__rjs_store as Map<number, any>;
            return Array.from(store.entries());
        });

        const snapshots = new Map<number, ViewportSnapshot>();
        const widths: number[] = [];

        for (const [width, raw] of rawEntries) {
            widths.push(width);
            snapshots.set(width, this.convertSnapshot(raw));
        }

        widths.sort((a, b) => a - b);

        return { snapshots, widths, selectors: this.selectors };
    }

    /** Resize the browser viewport and wait for observer to re-measure. */
    async resizeTo(width: number, height = 900): Promise<void> {
        this.ensureAttached();
        await this.page!.setViewportSize({ width, height });
        // Wait for observer callback to fire and measure
        await this.page!.waitForTimeout(100);
    }

    /** Compute aesthetic score at the current (or specified) viewport width. */
    async scoreAt(width?: number): Promise<AestheticScore> {
        this.ensureAttached();

        const targetWidth = width ?? (await this.page!.evaluate(() => window.innerWidth));

        // Read the snapshot for this width, retrying AT MOST once after nudging the store.
        // The previous version recursed unconditionally when no snapshot existed; since
        // clear() never produces a fresh measurement, that recursion never terminated (L-94).
        for (let attempt = 0; attempt < 2; attempt++) {
            const raw: BrowserSnapshot | null = await this.page!.evaluate((w) => {
                const store = (window as any).__rjs_store as Map<number, any>;
                return store.get(w) ?? null;
            }, targetWidth);

            if (raw) {
                const vp = { width: raw.width, height: raw.height };
                const rects = raw.measurements.map(m => fromDOMRect(m.rect));
                return computeScore(rects, vp);
            }

            // No snapshot yet — nudge the observer to re-measure, then retry ONCE.
            await this.page!.evaluate(() => { (window as any).__rjs_store?.clear(); });
            await this.page!.waitForTimeout(50);
        }

        // Still nothing after the retry: score an empty layout rather than loop forever.
        const height = await this.page!.evaluate(() => window.innerHeight);
        return computeScore([], { width: targetWidth, height });
    }

    /** Build a SnapshotStore from current measurements and run the Asserter. */
    async check(): Promise<Report> {
        const store = await this.snapshot();
        const asserter = new Asserter(store);
        asserter.noOverflow();
        return asserter.report();
    }

    /** Remove observers from the page. */
    async detach(): Promise<void> {
        if (this.page) {
            await this.page.evaluate(() => {
                const win = window as any;
                if (win.__rjs_resizeObserver) {
                    win.__rjs_resizeObserver.disconnect();
                    delete win.__rjs_resizeObserver;
                }
                if (win.__rjs_mutationObserver) {
                    win.__rjs_mutationObserver.disconnect();
                    delete win.__rjs_mutationObserver;
                }
                delete win.__rjs_store;
            });
        }
        this.page = null;
        this.selectors = [];
    }

    /** Convert a browser snapshot into a ViewportSnapshot. */
    private convertSnapshot(raw: BrowserSnapshot): ViewportSnapshot {
        const elements = new Map<string, ElementSnapshot[]>();

        for (const m of raw.measurements) {
            const snapshot: ElementSnapshot = {
                selector: m.selector,
                index: m.index,
                rect: fromDOMRect(m.rect),
                styles: m.styles,
                computed: m.computed,
            };

            if (!elements.has(m.selector)) elements.set(m.selector, []);
            elements.get(m.selector)!.push(snapshot);
        }

        return {
            width: raw.width,
            height: raw.height,
            elements,
            childRelations: new Map<string, ChildRelation[]>(),
            timestamp: raw.timestamp,
        };
    }

    private ensureAttached(): void {
        if (!this.page) throw new Error('r$ LiveValidator: call attach() first');
    }
}

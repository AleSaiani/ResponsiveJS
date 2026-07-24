/**
 * Shared fixtures for the F3 (analyze/MeasurementSource) test suite:
 * synthetic snapshots and an in-memory MeasurementSource.
 */

import type { ElementSnapshot, ViewportSnapshot, SnapshotStore } from '@responsivejs/core/types';
import type { MeasurementSource } from '../src/source/types.js';

export function makeRect(x = 0, y = 0, width = 100, height = 50) {
    return {
        x, y, width, height,
        right: x + width, bottom: y + height,
        centerX: x + width / 2, centerY: y + height / 2,
        area: width * height,
    };
}

export function makeEl(
    selector: string,
    overrides: {
        index?: number;
        rect?: ElementSnapshot['rect'];
        styles?: Partial<ElementSnapshot['styles']>;
        computed?: Partial<ElementSnapshot['computed']>;
    } = {},
): ElementSnapshot {
    return {
        selector,
        index: overrides.index ?? 0,
        rect: overrides.rect ?? makeRect(),
        styles: {
            fontSize: 16, lineHeight: 24, fontWeight: 400, gap: 0,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
            marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
            borderRadiusTL: 0, borderRadiusTR: 0, borderRadiusBR: 0, borderRadiusBL: 0,
            minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity,
            zIndex: 0, opacity: 1, outlineWidth: 0, outlineOffset: 0,
            ...overrides.styles,
        },
        computed: {
            display: 'block', overflow: 'visible', position: 'static', visibility: 'visible',
            pointerEvents: 'auto', backgroundColor: '#ffffff', color: '#000000',
            boxSizing: 'border-box', textAlign: 'left', whiteSpace: 'normal', cursor: 'auto',
            ...overrides.computed,
        },
    };
}

export function makeSnapshot(width: number, elements: Map<string, ElementSnapshot[]>): ViewportSnapshot {
    return { width, height: 900, elements, childRelations: new Map(), timestamp: 0 };
}

export function makeStore(widths: number[], selectors: string[], build?: (width: number, selector: string) => ElementSnapshot[]): SnapshotStore {
    const snapshots = new Map<number, ViewportSnapshot>();
    for (const w of widths) {
        const elements = new Map<string, ElementSnapshot[]>();
        for (const sel of selectors) {
            elements.set(sel, build ? build(w, sel) : [makeEl(sel)]);
        }
        snapshots.set(w, makeSnapshot(w, elements));
    }
    return { snapshots, widths, selectors };
}

/** In-memory MeasurementSource: serves canned snapshots, records every call. */
export class FakeSource implements MeasurementSource {
    readonly kind = 'fake';
    calls: string[] = [];
    currentWidth = 0;
    evaluations: string[] = [];
    /** Expression-prefix → canned result. */
    evalResults = new Map<string, unknown>();
    withEvaluate: boolean;

    constructor(
        private readonly build: (width: number, selectors: string[]) => ViewportSnapshot,
        opts: { withEvaluate?: boolean; withOpen?: boolean } = {},
    ) {
        this.withEvaluate = opts.withEvaluate ?? true;
        if (opts.withOpen !== false) {
            this.open = async (url: string) => {
                this.calls.push(`open:${url}`);
            };
        }
        if (!this.withEvaluate) this.evaluate = undefined;
    }

    open?: (url: string) => Promise<void>;
    /** Optional seam: tests assign a fake to exercise screenshot flows. */
    screenshot?: () => Promise<Uint8Array>;

    async setViewport(width: number, height: number): Promise<void> {
        this.calls.push(`viewport:${width}x${height}`);
        this.currentWidth = width;
    }

    async measure(selectors: string[]): Promise<ViewportSnapshot> {
        this.calls.push(`measure:${this.currentWidth}`);
        return this.build(this.currentWidth, selectors);
    }

    evaluate?: (<T>(expression: string) => Promise<T>) = async <T>(expression: string): Promise<T> => {
        this.evaluations.push(expression);
        for (const [prefix, result] of this.evalResults) {
            if (expression.startsWith(prefix)) return result as T;
        }
        return undefined as T;
    };
}

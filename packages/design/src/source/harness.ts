/**
 * HarnessSource — measure a COMPONENT instead of a page.
 *
 * The whole stack above `MeasurementSource` depends on one knob: setViewport.
 * This source implements it by resizing a wrapper element, so sweeping,
 * constraints, curves, scores and contracts all work unchanged on a single
 * component — in-page, with no navigation, no viewport emulation and no
 * debugger. Container queries respond because the harness gets
 * `container-type: inline-size`.
 *
 * It needs nothing but an eval seam, so it composes with every driver
 * (Playwright, CDP, agent-browser) and with a devtools panel.
 */

import type { ViewportSnapshot } from '@responsivejs/core/types';
import type { MeasurementSource } from './types.js';
import { buildCollectExpression } from '../browser/inject.js';
import { fromWire, type ViewportSnapshotWire } from '../browser/wire.js';
import type { EvalFn } from './eval.js';

export interface HarnessSourceOptions {
    /** Selector of the wrapper whose width is swept — the "viewport" of the component. */
    harness: string;
    /** Fixed harness height (px). Default: leave it to the content. */
    height?: number;
    /** Settle delay after each resize (transitions, container queries). */
    settleMs?: number;
}

export class HarnessSource implements MeasurementSource {
    readonly kind = 'harness';
    private width = 0;
    private readonly settleMs: number;

    constructor(
        private readonly evalFn: EvalFn,
        private readonly opts: HarnessSourceOptions,
    ) {
        this.settleMs = opts.settleMs ?? 60;
    }

    /** Resize the harness, not the window. */
    async setViewport(width: number, height?: number): Promise<void> {
        this.width = width;
        const h = height ?? this.opts.height;
        const applied = await this.evalFn(`(() => {
    const el = document.querySelector(${JSON.stringify(this.opts.harness)});
    if (!el) return false;
    el.style.width = ${JSON.stringify(`${width}px`)};
    ${h !== undefined ? `el.style.height = ${JSON.stringify(`${h}px`)};` : ''}
    // container queries inside the component must respond to the harness
    if (!el.style.containerType) el.style.containerType = 'inline-size';
    el.getBoundingClientRect();
    return true;
})()`);
        if (applied === false) {
            throw new Error(`r$: harness '${this.opts.harness}' matched no element`);
        }
        if (this.settleMs > 0) await delay(this.settleMs);
    }

    /** Measure inside the harness, with rects relative to it. */
    async measure(selectors: string[]): Promise<ViewportSnapshot> {
        const wire = (await this.evalFn(
            buildCollectExpression({
                selectors,
                width: this.width,
                height: this.opts.height,
                within: this.opts.harness,
                relative: true,
            }),
        )) as ViewportSnapshotWire | string;
        return fromWire(typeof wire === 'string' ? (JSON.parse(wire) as ViewportSnapshotWire) : wire);
    }

    evaluate<T = unknown>(expression: string): Promise<T> {
        return this.evalFn(expression) as Promise<T>;
    }

    /** Give the harness its size back. */
    async close(): Promise<void> {
        await this.evalFn(`(() => {
    const el = document.querySelector(${JSON.stringify(this.opts.harness)});
    if (el) { el.style.removeProperty('width'); el.style.removeProperty('height'); el.style.removeProperty('container-type'); }
})()`);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

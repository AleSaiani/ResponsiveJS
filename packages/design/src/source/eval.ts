/**
 * EvalSource — MeasurementSource over a bare `eval` primitive.
 *
 * The lowest-friction adapter: if an environment can evaluate a JS string in
 * a page (agent-browser, a browser extension, a bookmarklet host, a REPL over
 * a live tab), it can drive r$ — no protocol client, no driver. Viewport
 * control and navigation are optional callbacks; when the environment cannot
 * resize the viewport, the source verifies the live width instead of lying
 * about it.
 */

import type { ViewportSnapshot } from '@responsivejs/core/types';
import type { MeasurementSource } from './types.js';
import { buildCollectExpression } from '../browser/inject.js';
import { fromWire, type ViewportSnapshotWire } from '../browser/wire.js';

/**
 * The primitive: evaluate a JS expression string in the page, resolving to a
 * JSON-serializable value. Text-only transports may resolve to the raw JSON
 * string — `measure()` parses it.
 */
export type EvalFn = (expression: string) => Promise<unknown>;

export interface EvalSourceOptions {
    /** Resize/emulate the viewport. Absent ⇒ requested widths must match the live viewport. */
    setViewport?: (width: number, height: number) => Promise<void>;
    /** Navigate to a URL. Absent ⇒ pre-navigate and omit `url` when sweeping. */
    open?: (url: string) => Promise<void>;
    /** Settle delay after viewport changes (CSS transitions, container queries). */
    settleMs?: number;
    /** Allowed drift (px) between requested and live width when no setter exists. */
    widthTolerance?: number;
}

export class EvalSource implements MeasurementSource {
    readonly kind = 'eval';
    open?: (url: string) => Promise<void>;

    private width: number | null = null;
    private height: number | null = null;
    private readonly setter?: (width: number, height: number) => Promise<void>;
    private readonly settleMs: number;
    private readonly widthTolerance: number;

    constructor(
        private readonly evalFn: EvalFn,
        opts: EvalSourceOptions = {},
    ) {
        this.setter = opts.setViewport;
        this.settleMs = opts.settleMs ?? 50;
        this.widthTolerance = opts.widthTolerance ?? 1;
        // Assigned conditionally: sweepSource feature-detects `source.open`.
        if (opts.open) this.open = opts.open;
    }

    async setViewport(width: number, height: number): Promise<void> {
        if (this.setter) {
            await this.setter(width, height);
            this.width = width;
            this.height = height;
            await delay(this.settleMs);
            return;
        }
        // No setter: honesty check — measure only at the width the page really has.
        const actual = await this.evaluate<number>('window.innerWidth');
        if (Math.abs(actual - width) > this.widthTolerance) {
            throw new Error(
                `r$: EvalSource has no setViewport callback and the live viewport is ${actual}px, ` +
                    `not ${width}px. Either provide setViewport in EvalSourceOptions, or sweep at ` +
                    `the live width (currentWidth()).`,
            );
        }
        this.width = width;
        this.height = height;
    }

    /** The page's live viewport width — the natural sweep width for eval-only environments. */
    async currentWidth(): Promise<number> {
        return this.evaluate<number>('window.innerWidth');
    }

    async measure(selectors: string[]): Promise<ViewportSnapshot> {
        // Width/height only when explicitly set — as-is measurement stays honest
        // (the collector falls back to the page's own innerWidth/Height).
        const raw = await this.evaluate<ViewportSnapshotWire | string>(
            buildCollectExpression({
                selectors,
                ...(this.width !== null ? { width: this.width } : {}),
                ...(this.height !== null ? { height: this.height } : {}),
            }),
        );
        return fromWire(parseWire(raw));
    }

    async evaluate<T = unknown>(expression: string): Promise<T> {
        return (await this.evalFn(expression)) as T;
    }
}

export interface ChunkedEvalOptions {
    /** Expressions longer than this are uploaded in chunks (default 12 000 chars). */
    limit?: number;
    /** In-page staging variable (default `__rjs_xfer`). */
    varName?: string;
}

/**
 * Wrap an EvalFn so oversized expressions survive argument-length limits
 * (Windows command lines cap at ~32K; axe injection alone is ~500K): the
 * expression is staged into an in-page variable chunk by chunk, then eval'd.
 * Compose: `new EvalSource(chunkedEval(fn))`.
 */
export function chunkedEval(evalFn: EvalFn, opts: ChunkedEvalOptions = {}): EvalFn {
    const limit = opts.limit ?? 12_000;
    const varName = opts.varName ?? '__rjs_xfer';
    return async (expression: string) => {
        if (expression.length <= limit) return evalFn(expression);
        await evalFn(`void (window.${varName} = "")`);
        for (let i = 0; i < expression.length; i += limit) {
            await evalFn(`void (window.${varName} += ${JSON.stringify(expression.slice(i, i + limit))})`);
        }
        // Indirect eval → global scope; the staged source may return a promise
        // (the transport's awaitPromise semantics apply unchanged).
        return evalFn(`(0, eval)(window.${varName})`);
    };
}

/** Text transports (CLI stdout, message ports) deliver the wire as a JSON string. */
function parseWire(raw: ViewportSnapshotWire | string): ViewportSnapshotWire {
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw) as ViewportSnapshotWire;
    } catch {
        throw new Error(`r$: EvalSource measure returned a non-JSON string: ${raw.slice(0, 120)}`);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

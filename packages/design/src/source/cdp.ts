/**
 * CDP adapter for MeasurementSource — zero dependencies by design.
 *
 * Takes a structural client ({ send(method, params) }), which matches
 * chrome-remote-interface, Playwright's CDPSession, and agent-browser CDP
 * bridges alike. Measurement happens by injecting the shared in-page
 * collector via Runtime.evaluate.
 */

import type { ViewportSnapshot } from '@responsivejs/core/types';
import type { MeasurementSource } from './types.js';
import { buildCollectExpression } from '../browser/inject.js';
import { fromWire, type ViewportSnapshotWire } from '../browser/wire.js';

export interface CdpClient {
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

interface RuntimeEvaluateResult {
    result?: { value?: unknown };
    exceptionDetails?: { text?: string; exception?: { description?: string } };
}

export interface CdpSourceOptions {
    height?: number;
    settleMs?: number;
    /** open(): max readyState polls (100ms apart). */
    loadTimeoutMs?: number;
}

export class CdpSource implements MeasurementSource {
    readonly kind = 'cdp';
    private width = 1280;
    private height: number;
    private readonly settleMs: number;
    private readonly loadTimeoutMs: number;

    constructor(
        private readonly client: CdpClient,
        opts: CdpSourceOptions = {},
    ) {
        this.height = opts.height ?? 900;
        this.settleMs = opts.settleMs ?? 50;
        this.loadTimeoutMs = opts.loadTimeoutMs ?? 15_000;
    }

    /**
     * Request/response navigation (no event streams → transport-agnostic).
     * Polls document.readyState — SPAs that hydrate later should pre-navigate
     * and skip open().
     */
    async open(url: string): Promise<void> {
        await this.client.send('Page.enable');
        await this.client.send('Page.navigate', { url });
        const deadline = Date.now() + this.loadTimeoutMs;
        for (;;) {
            const ready = await this.evaluate<string>('document.readyState');
            if (ready === 'complete') return;
            if (Date.now() > deadline) throw new Error(`r$: CDP navigation to ${url} timed out`);
            await delay(100);
        }
    }

    async setViewport(width: number, height: number): Promise<void> {
        this.width = width;
        this.height = height;
        await this.client.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(this.settleMs);
    }

    async measure(selectors: string[]): Promise<ViewportSnapshot> {
        // Width/height passed explicitly: innerWidth drifts with scrollbars.
        const wire = await this.evaluate<ViewportSnapshotWire>(
            buildCollectExpression({ selectors, width: this.width, height: this.height }),
        );
        return fromWire(wire);
    }

    async evaluate<T = unknown>(expression: string): Promise<T> {
        const res = (await this.client.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        })) as RuntimeEvaluateResult;
        if (res.exceptionDetails) {
            const detail = res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? 'unknown error';
            throw new Error(`r$: CDP evaluate failed — ${detail}`);
        }
        return res.result?.value as T;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

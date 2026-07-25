/**
 * The devtool's engine — pure of chrome.* so it is unit- and e2e-testable.
 * A Messenger abstracts the panel→background→chrome.debugger hop; the rest
 * is the SAME oracle the CLI runs: CdpSource + sweepSource + analyzeStore.
 */

import type { SnapshotStore } from '@responsivejs/core/types';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { CdpSource, sweepSource, analyzeStore, LANDMARK_SELECTORS, type CdpClient, type UnifiedReport } from '@responsivejs/design';

/** panel → background transport (chrome.runtime.sendMessage in production). */
export interface Messenger {
    send(msg: Record<string, unknown>): Promise<{ ok?: boolean; result?: unknown; error?: string }>;
}

export interface TabCdp extends CdpClient {
    attach(): Promise<void>;
    detach(): Promise<void>;
}

/** A CdpClient over the background's chrome.debugger proxy. */
export function makeCdpClient(messenger: Messenger, tabId: number): TabCdp {
    const call = async (msg: Record<string, unknown>): Promise<unknown> => {
        const res = await messenger.send(msg);
        if (res.error) throw new Error(`r$ devtool: ${res.error}`);
        return res.result;
    };
    return {
        attach: async () => void (await call({ type: 'cdp.attach', tabId })),
        detach: async () => void (await call({ type: 'cdp.detach', tabId })),
        send: (method, params) => call({ type: 'cdp.send', tabId, method, params }),
    };
}

export interface SweepConfig {
    widths: number[];
    selectors?: string[];
    height?: number;
    touchMin?: number;
}

export interface SweepOutcome {
    store: SnapshotStore;
    report: UnifiedReport;
}

/** Full multi-width sweep of the ALREADY-OPEN inspected page. */
export async function fullSweep(client: CdpClient, cfg: SweepConfig): Promise<SweepOutcome> {
    const source = new CdpSource(client, { height: cfg.height });
    const store = await sweepSource(source, {
        selectors: cfg.selectors ?? LANDMARK_SELECTORS,
        widths: cfg.widths,
        height: cfg.height,
    });
    // Release the emulation so the page returns to its real viewport.
    await client.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    const report = analyzeStore(store, {
        ...(cfg.touchMin !== undefined ? { constraints: { touchTarget: { min: cfg.touchMin } } } : {}),
    });
    return { store, report };
}

/** Measured f(width) for one element+prop — the curve inspector's data. */
export function curveOf(
    store: SnapshotStore,
    selector: string,
    prop: 'width' | 'height' | 'x' | 'y' | 'fontSize',
): Map<number, number> {
    return new StoreQuery(store).curve(selector, prop);
}

/**
 * The devtool's engine — pure of chrome.* so it is unit- and e2e-testable.
 * A Messenger abstracts the panel→background→chrome.debugger hop; the rest
 * is the SAME oracle the CLI runs: CdpSource + sweepSource + analyzeStore.
 */

import type { SnapshotStore, ViewportSnapshot } from '@responsivejs/core/types';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { buildPropsExpression } from './props.js';
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

export interface ElementInspection {
    store: SnapshotStore;
    /** Raw computed values per extra property, per width. */
    extra: Map<string, Map<number, string>>;
}

/**
 * The element inspector's sweep: ONE emulation pass per width measuring
 * both the collector snapshot (default props/rects) and any extra CSS
 * properties via getComputedStyle — custom properties included.
 */
export async function inspectElementSweep(
    client: CdpClient,
    selector: string,
    cfg: { widths: number[]; extraProps?: string[]; height?: number },
): Promise<ElementInspection> {
    const source = new CdpSource(client, { height: cfg.height });
    const snapshots = new Map<number, ViewportSnapshot>();
    const extra = new Map<string, Map<number, string>>();
    for (const p of cfg.extraProps ?? []) extra.set(p, new Map());

    for (const w of cfg.widths) {
        await source.setViewport(w, cfg.height ?? 900);
        snapshots.set(w, await source.measure([selector]));
        if (extra.size > 0) {
            const values = await source.evaluate<Record<string, string> | null>(
                buildPropsExpression(selector, [...extra.keys()]),
            );
            if (values) for (const [p, v] of Object.entries(values)) extra.get(p)!.set(w, v);
        }
    }
    await client.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    return { store: { snapshots, widths: cfg.widths, selectors: [selector] }, extra };
}

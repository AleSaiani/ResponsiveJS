/**
 * The devtool's engine — pure of chrome.* so it is unit- and e2e-testable.
 * A Messenger abstracts the panel→background→chrome.debugger hop; the rest
 * is the SAME oracle the CLI runs: CdpSource + sweepSource + analyzeStore.
 */

import type { SnapshotStore, ViewportSnapshot } from '@responsivejs/core/types';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { fromWire, type ViewportSnapshotWire } from '@responsivejs/design/browser';
import { buildPropsExpression } from './props.js';
import {
    buildIframeSweepStartExpression,
    IFRAME_SWEEP_POLL_EXPRESSION,
    type IframeSweepResult,
    type IframeSweepState,
} from './iframe-sweep.js';
import {
    CdpSource,
    HarnessSource,
    sweepSource,
    analyzeStore,
    LANDMARK_SELECTORS,
    type CdpClient,
    type UnifiedReport,
} from '@responsivejs/design';

/** panel → background transport (chrome.runtime.sendMessage in production). */
export interface Messenger {
    send(msg: Record<string, unknown>): Promise<{ ok?: boolean; result?: unknown; error?: string }>;
}

export interface TabCdp extends CdpClient {
    /** pageUrl helps the background find the page TARGET when tab-level
     *  attach is poisoned by foreign-extension frames. */
    attach(pageUrl?: string): Promise<void>;
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
        attach: async (pageUrl) => void (await call({ type: 'cdp.attach', tabId, ...(pageUrl ? { pageUrl } : {}) })),
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

export interface MeasureConfig {
    widths: number[];
    selectors: string[];
    height?: number;
    /** Extra CSS properties (custom properties included) for extraSelector. */
    extraProps?: string[];
    extraSelector?: string;
}

export interface ElementInspection {
    store: SnapshotStore;
    /** Raw computed values per extra property, per width. */
    extra: Map<string, Map<number, string>>;
}

/**
 * CDP sweep: ONE emulation pass per width measuring the collector snapshot
 * and (optionally) extra CSS properties via getComputedStyle.
 */
export async function cdpSweep(client: CdpClient, cfg: MeasureConfig): Promise<ElementInspection> {
    const source = new CdpSource(client, { height: cfg.height });
    const snapshots = new Map<number, ViewportSnapshot>();
    const extra = new Map<string, Map<number, string>>();
    for (const p of cfg.extraProps ?? []) extra.set(p, new Map());

    let manifest: SnapshotStore['manifest'];
    for (const w of cfg.widths) {
        await source.setViewport(w, cfg.height ?? 900);
        const snap = await source.measure(cfg.selectors);
        snapshots.set(w, snap);
        if (snap.manifest) manifest = snap.manifest;
        if (extra.size > 0 && cfg.extraSelector) {
            const values = await source.evaluate<Record<string, string> | null>(
                buildPropsExpression(cfg.extraSelector, [...extra.keys()]),
            );
            if (values) for (const [p, v] of Object.entries(values)) extra.get(p)!.set(w, v);
        }
    }
    await client.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    return {
        store: { snapshots, widths: cfg.widths, selectors: cfg.selectors, ...(manifest ? { manifest } : {}) },
        extra,
    };
}

/**
 * Component mode: sweep the SELECTED ELEMENT's width instead of the viewport.
 * Needs nothing but the eval seam — so it works on pages where the debugger
 * cannot attach, and it is how you inspect f(containerWidth).
 */
export async function harnessSweep(
    evalFn: <T>(expression: string) => Promise<T>,
    harness: string,
    cfg: MeasureConfig,
): Promise<ElementInspection> {
    const source = new HarnessSource((expression) => evalFn(expression), { harness, height: cfg.height });
    try {
        const store = await sweepSource(source, { selectors: cfg.selectors, widths: cfg.widths });
        const extra = new Map<string, Map<number, string>>();
        for (const p of cfg.extraProps ?? []) extra.set(p, new Map());
        if (extra.size > 0 && cfg.extraSelector) {
            // one extra pass per width: the harness is already sized by the sweep
            for (const w of cfg.widths) {
                await source.setViewport(w);
                const values = await evalFn<Record<string, string> | null>(
                    buildPropsExpression(cfg.extraSelector, [...extra.keys()]),
                );
                if (values) for (const [p, v] of Object.entries(values)) extra.get(p)!.set(w, v);
            }
        }
        return { store, extra };
    } finally {
        await source.close().catch(() => {});
    }
}

/**
 * Debugger-free fallback: the same measurement through a hidden same-origin
 * iframe (see iframe-sweep.ts). evalFn is inspectedWindow.eval — which does
 * NOT await promises, hence the start + poll handshake.
 */
export async function iframeSweep(
    evalFn: <T>(expression: string) => Promise<T>,
    cfg: MeasureConfig,
): Promise<ElementInspection> {
    await evalFn<string>(buildIframeSweepStartExpression(cfg));
    // generous ceiling: page load + settle per width + slack
    const deadline = Date.now() + 15_000 + cfg.widths.length * 700 + 10_000;
    let result: IframeSweepResult | undefined;
    for (;;) {
        await new Promise((r) => setTimeout(r, 250));
        const s = await evalFn<IframeSweepState>(IFRAME_SWEEP_POLL_EXPRESSION);
        if (s.state === 'done') {
            result = s.result;
            break;
        }
        if (Date.now() > deadline) throw new Error('iframe sweep timed out');
    }
    if (!result || result.error || !result.wires) {
        throw new Error(result?.error ?? 'iframe sweep produced no measurements');
    }
    const snapshots = new Map<number, ViewportSnapshot>();
    let manifest: SnapshotStore['manifest'];
    result.wires.forEach((wire, i) => {
        const snap = fromWire(wire as ViewportSnapshotWire);
        snapshots.set(cfg.widths[i], snap);
        if (snap.manifest) manifest = snap.manifest;
    });
    const extra = new Map<string, Map<number, string>>();
    for (const [prop, byWidth] of Object.entries(result.extra ?? {})) {
        extra.set(prop, new Map(Object.entries(byWidth).map(([w, v]) => [Number(w), v])));
    }
    return {
        store: { snapshots, widths: cfg.widths, selectors: cfg.selectors, ...(manifest ? { manifest } : {}) },
        extra,
    };
}

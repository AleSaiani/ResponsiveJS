/// <reference types="chrome" />
/**
 * Shared devtools plumbing for the panel AND the Elements sidebar: eval in
 * the inspected page, the background messenger, and measure-with-fallback
 * (CDP emulation → iframe emulation when a foreign extension blocks the
 * debugger).
 */

import { makeCdpClient, cdpSweep, iframeSweep, type TabCdp, type MeasureConfig, type ElementInspection } from './engine.js';

export function evalInPage<T>(expression: string): Promise<T> {
    return new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(expression, (result, err) => {
            if (err) reject(new Error(err.description ?? 'eval failed'));
            else resolve(result as T);
        });
    });
}

const messenger = {
    send: (msg: Record<string, unknown>) =>
        chrome.runtime.sendMessage(msg) as Promise<{ ok?: boolean; result?: unknown; error?: string }>,
};

let cdp: TabCdp | null = null;

async function withCdp<T>(work: (client: TabCdp) => Promise<T>): Promise<T> {
    cdp ??= makeCdpClient(messenger, chrome.devtools.inspectedWindow.tabId);
    const pageUrl = await evalInPage<string>('location.href').catch(() => undefined);
    await cdp.attach(pageUrl);
    try {
        return await work(cdp);
    } finally {
        await cdp.detach().catch(() => {});
    }
}

export type MeasureOutcome = ElementInspection & { mode: 'cdp' | 'iframe' };

/**
 * Measure through the debugger; when Chrome refuses the attach because a
 * FOREIGN extension has frames in the page (its check covers the whole
 * tab), fall back to iframe emulation — a fresh same-origin load.
 */
export async function measure(cfg: MeasureConfig, onFallback?: () => void): Promise<MeasureOutcome> {
    try {
        const inspection = await withCdp((client) => cdpSweep(client, cfg));
        return { ...inspection, mode: 'cdp' };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!message.includes('different extension')) throw e;
        onFallback?.();
        const inspection = await iframeSweep(evalInPage, cfg);
        return { ...inspection, mode: 'iframe' };
    }
}

export const modeNote = (mode: 'cdp' | 'iframe'): string =>
    mode === 'iframe' ? ' · measured via iframe emulation (fresh load — another extension blocks the debugger here)' : '';

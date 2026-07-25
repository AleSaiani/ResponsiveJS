/**
 * Debugger-free width emulation — the fallback when chrome.debugger cannot
 * attach (a foreign extension's iframe poisons the whole tab, by Chrome
 * design). The page is reloaded inside a hidden SAME-ORIGIN iframe and
 * resized through the sweep widths: media queries respond to the iframe's
 * size, and the shared collector measures inside its document from the top
 * realm (no eval in the iframe → page CSP stays irrelevant).
 *
 * Honest limits, surfaced to the user: it is a FRESH page load (state is
 * not shared with the visible page), and sites sending X-Frame-Options /
 * frame-ancestors that exclude 'self' cannot be framed at all.
 */

import { collectPage } from '@responsivejs/design/browser';

export interface IframeSweepConfig {
    widths: number[];
    selectors: string[];
    height?: number;
    /** Extra CSS properties for ONE element (the inspector's selector). */
    extraProps?: string[];
    /** The element the extra props belong to. */
    extraSelector?: string;
    settleMs?: number;
    loadTimeoutMs?: number;
}

/**
 * Expression for inspectedWindow.eval: resolves to
 * { wires: ViewportSnapshotWire[], extra: { [prop]: { [width]: value } } }
 * or { error } when the page refuses to be framed.
 */
export function buildIframeSweepExpression(cfg: IframeSweepConfig): string {
    const height = cfg.height ?? 900;
    const settle = cfg.settleMs ?? 150;
    const timeout = cfg.loadTimeoutMs ?? 15_000;
    return `(async () => {
    const collect = ${collectPage.toString()};
    const widths = ${JSON.stringify(cfg.widths)};
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:0;top:0;border:0;visibility:hidden;pointer-events:none;z-index:-1;';
    iframe.src = location.href;
    document.documentElement.appendChild(iframe);
    try {
        await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('iframe load timed out — the page may refuse to be framed (X-Frame-Options / frame-ancestors)')), ${timeout});
            iframe.onload = () => { clearTimeout(t); resolve(); };
        });
        const wires = [];
        const extra = {};
        for (const p of ${JSON.stringify(cfg.extraProps ?? [])}) extra[p] = {};
        for (const w of widths) {
            iframe.style.width = w + 'px';
            iframe.style.height = '${height}px';
            await new Promise((r) => setTimeout(r, ${settle}));
            const idoc = iframe.contentDocument;
            if (!idoc) throw new Error('iframe document unreachable (cross-origin redirect?)');
            wires.push(collect({ selectors: ${JSON.stringify(cfg.selectors)}, width: w, height: ${height} }, idoc));
            const target = ${JSON.stringify(cfg.extraSelector ?? null)} && idoc.querySelector(${JSON.stringify(cfg.extraSelector ?? '')});
            if (target) {
                const cs = idoc.defaultView.getComputedStyle(target);
                for (const p of ${JSON.stringify(cfg.extraProps ?? [])}) extra[p][w] = cs.getPropertyValue(p).trim();
            }
        }
        return { wires, extra };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    } finally {
        iframe.remove();
    }
})()`;
}

export interface IframeSweepResult {
    wires?: unknown[];
    extra?: Record<string, Record<string, string>>;
    error?: string;
}

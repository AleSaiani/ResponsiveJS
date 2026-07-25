/**
 * Live observation script — ResizeObserver + MutationObserver that re-run the
 * ONE shared collector (browser/inject.ts) and park wire snapshots on
 * `window.__rjs_live`, keyed by viewport width.
 *
 * It deliberately does NOT measure anything itself: a second collector is a
 * second definition of truth, and this file used to be exactly that (it had
 * drifted — no DOM-semantic interactivity, no overflow containment, no
 * provenance manifest, so LiveValidator disagreed with every other path).
 */

import { collectPage } from '../browser/inject.js';

export const LIVE_STORE = '__rjs_live';

/** Build the injectable script: measure now, then on resize and mutation. */
export function buildObserverScript(selectors: string[]): string {
    return `(() => {
    const collect = ${collectPage.toString()};
    const selectors = ${JSON.stringify(selectors)};
    const win = window;
    win.${LIVE_STORE} = win.${LIVE_STORE} ?? new Map();

    const measure = () => {
        const width = win.innerWidth;
        win.${LIVE_STORE}.set(width, collect({ selectors, width, height: win.innerHeight }));
    };

    if (win.__rjs_live_stop) win.__rjs_live_stop();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    const mo = new MutationObserver(measure);
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    win.__rjs_live_stop = () => {
        ro.disconnect();
        mo.disconnect();
        delete win.__rjs_live_stop;
    };

    measure();
    return 'observing';
})()`;
}

/** Read every measurement collected so far, as [width, wireSnapshot] pairs. */
export const READ_LIVE_EXPRESSION = `(() => {
    const store = window.${LIVE_STORE};
    return store ? Array.from(store.entries()) : [];
})()`;

/** Read one width's measurement (null when it has not been measured yet). */
export function buildReadWidthExpression(width: number): string {
    return `(() => {
    const store = window.${LIVE_STORE};
    return store ? (store.get(${width}) ?? null) : null;
})()`;
}

/** Drop collected measurements (forces the next observation to re-fill). */
export const CLEAR_LIVE_EXPRESSION = `(() => { window.${LIVE_STORE}?.clear(); })()`;

/** Disconnect the observers and drop the store. */
export const STOP_LIVE_EXPRESSION = `(() => {
    window.__rjs_live_stop?.();
    delete window.${LIVE_STORE};
})()`;

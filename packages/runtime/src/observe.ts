/**
 * observe() — the SPA answer. `r$('.card', …)` binds to the elements that
 * exist at call time; in a framework app they come and go. observe() keeps a
 * selector bound: the static half is injected once (CSS matches future
 * elements for free), and the JS half is wired per element as they appear and
 * released as they leave.
 */

import { applyDynamic, type ResponsiveHandle } from './apply.js';
import { configState } from './config.js';
import { emitCSS, injectStyle, removeStyle } from './static.js';
import { isResponsiveValue, type StyleMap, type StyleValue } from './value.js';
import { registerProvenance, describeMap } from './provenance.js';

export interface ObserveHandle {
    /** The elements currently matched. */
    readonly elements: readonly HTMLElement[];
    /** Re-scan now (after an imperative DOM change you already know about). */
    refresh(): void;
    dispose(): void;
}

let observeCounter = 0;

export function observe(selector: string, map: StyleMap): ObserveHandle {
    const styleKey = `r$:observe:#${++observeCounter}:${selector}`;
    let injected = false;

    // The static half is selector-scoped: it already applies to elements that
    // do not exist yet — that is the whole point of emitting CSS.
    let dynamicRest: StyleMap = map;
    if (configState.get().useMediaQueries) {
        const { css, dynamicRest: rest } = emitCSS(selector, map);
        if (css.length > 0) {
            injectStyle(css, styleKey);
            injected = true;
        }
        dynamicRest = rest;
    }

    const describeValue = (v: StyleValue): string =>
        isResponsiveValue(v) ? v.kind : typeof v === 'function' ? 'custom' : 'literal';
    const unregister = registerProvenance({
        construct: 'style',
        target: selector,
        behavior: Object.entries(map).map(([p, v]) => `${p}: ${describeValue(v)}`),
        config: describeMap(map),
    });

    const handles = new Map<HTMLElement, ResponsiveHandle>();
    let disposed = false;

    const refresh = (): void => {
        if (disposed || typeof document === 'undefined') return;
        const current = new Set(document.querySelectorAll<HTMLElement>(selector));
        for (const [el, handle] of handles) {
            if (!current.has(el)) {
                handle.dispose(); // restores whatever we had overwritten
                handles.delete(el);
            }
        }
        for (const el of current) {
            if (!handles.has(el)) handles.set(el, applyDynamic(el, dynamicRest));
        }
    };

    refresh();

    // One observer per handle, coalesced: DOM churn arrives in bursts.
    let pending = false;
    let mo: MutationObserver | undefined;
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        mo = new MutationObserver(() => {
            if (pending) return;
            pending = true;
            queueMicrotask(() => {
                pending = false;
                refresh();
            });
        });
        mo.observe(document.documentElement, { subtree: true, childList: true });
    }

    return {
        get elements() {
            return [...handles.keys()];
        },
        refresh,
        dispose() {
            if (disposed) return;
            disposed = true;
            mo?.disconnect();
            for (const handle of handles.values()) handle.dispose();
            handles.clear();
            unregister();
            if (injected) removeStyle(styleKey);
        },
    };
}

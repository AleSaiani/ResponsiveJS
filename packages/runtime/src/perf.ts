/**
 * Performance/DX helpers: lazy application, memoized custom functions,
 * cross-call batching.
 */

import { batch as signalBatch } from './signals.js';
import { applyResponsive, flush, type ResponsiveHandle, type Target } from './apply.js';
import { isResponsiveValue, custom, type StyleMap, type StyleValue } from './value.js';
import { configure } from './config.js';

/** Apply styles only when the element first becomes visible (IntersectionObserver). */
export function lazy(target: Target, map: StyleMap): { dispose(): void } {
    if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') {
        const handle = applyResponsive(target, map);
        return { dispose: () => handle.dispose() };
    }

    const handles: ResponsiveHandle[] = [];
    const elements =
        typeof target === 'string'
            ? [...document.querySelectorAll<HTMLElement>(target)]
            : target instanceof Element
              ? [target as HTMLElement]
              : ([...target] as HTMLElement[]);

    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                handles.push(applyResponsive(entry.target as HTMLElement, map));
                io.unobserve(entry.target);
            }
        }
    });
    for (const el of elements) io.observe(el);

    return {
        dispose() {
            io.disconnect();
            for (const h of handles) h.dispose();
        },
    };
}

/** Wrap every function value with a per-width cache (1px quantization). */
export function memo(map: StyleMap): StyleMap {
    const out: StyleMap = {};
    for (const [prop, value] of Object.entries(map)) {
        if (typeof value === 'function' && !isResponsiveValue(value)) {
            const cache = new Map<number, string | number>();
            const fn = value as (width: number) => string | number;
            out[prop] = custom((width) => {
                const key = Math.round(width);
                let hit = cache.get(key);
                if (hit === undefined) {
                    hit = fn(key);
                    cache.set(key, hit);
                }
                return hit;
            });
        } else {
            out[prop] = value as StyleValue;
        }
    }
    return out;
}

/** Batch several responsive() calls: one signal flush, one style flush. */
export function batch(fn: () => void): void {
    signalBatch(fn);
    flush();
}

/** Toggle debug logging of resolved values. */
export function debug(enabled: boolean): void {
    configure({ debug: enabled });
}

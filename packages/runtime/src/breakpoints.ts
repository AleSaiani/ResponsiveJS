/**
 * Typed breakpoints: defineBreakpoints({mobile: 320, …} as const) configures
 * the runtime AND returns an API typed on YOUR names — bp.below('mobile')
 * autocompletes, a typo is a compile error instead of a runtime throw.
 */

import { configure } from './config.js';
import { breakpoint } from './conditionals.js';
import { breakpointSignal } from './viewport.js';
import { registerProvenance } from './provenance.js';
import type { ResponsiveValue, StyleValue } from './value.js';
import type { Computed, Disposer } from './signals.js';

export interface TypedBreakpoints<K extends string> {
    /** Value when width < breakpoints[name], else the fallback. */
    below(name: K, value: StyleValue, otherwise?: StyleValue): ResponsiveValue;
    /** Value when width >= breakpoints[name], else the fallback. */
    above(name: K, value: StyleValue, otherwise?: StyleValue): ResponsiveValue;
    /** Value when breakpoints[lo] <= width < breakpoints[hi], else the fallback. */
    between(lo: K, hi: K, value: StyleValue, otherwise?: StyleValue): ResponsiveValue;
    /** Named switch: the largest matching breakpoint wins. */
    match(map: Partial<Record<K, StyleValue>>): ResponsiveValue;
    /** The configured pixel width of a breakpoint. */
    width(name: K): number;
    /** Reactive min-width match (dispose releases the media-query listener). */
    matches(name: K): { signal: Computed<boolean>; dispose: Disposer };
    /** The names, in ascending width order. */
    readonly names: readonly K[];
}

/** Each defineBreakpoints call REPLACES the global config — one manifest
 *  entry mirrors that (the previous registration is disposed, not stacked). */
let unregisterBreakpoints: (() => void) | undefined;

/** Define (or replace) named breakpoints and get the typed API back. */
export function defineBreakpoints<T extends Record<string, number>>(map: T): TypedBreakpoints<Extract<keyof T, string>> {
    type K = Extract<keyof T, string>;
    configure({ breakpoints: map });
    const names = (Object.keys(map) as K[]).sort((a, b) => map[a] - map[b]);

    unregisterBreakpoints?.();
    unregisterBreakpoints = registerProvenance({
        construct: 'breakpoints',
        target: ':root',
        behavior: names.map((n) => `${n}: ${map[n]}`),
        config: { ...map },
    });

    return {
        below: (name, value, otherwise) => breakpoint.below(name, value, otherwise),
        above: (name, value, otherwise) => breakpoint.above(name, value, otherwise),
        between: (lo, hi, value, otherwise) => breakpoint.between(lo, hi, value, otherwise),
        match: (styleMap) => breakpoint.match(styleMap as Record<string, StyleValue>),
        width: (name) => map[name],
        matches: (name) => breakpointSignal(name),
        names,
    };
}

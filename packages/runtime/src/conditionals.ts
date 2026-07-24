/**
 * Conditional values: predicate-based (always JS-driven) and breakpoint-based
 * (static-emittable — breakpoint.* carries enough metadata to become @media).
 */

import { bpWidth } from './config.js';
import {
    makeValue,
    isResponsiveValue,
    type ResponsiveValue,
    type StyleValue,
    type StaticContext,
    type StaticEmission,
} from './value.js';

function resolveBranch(v: StyleValue | undefined, width: number): string | number {
    if (v === undefined) return '';
    if (isResponsiveValue(v)) return v.resolve(width);
    if (typeof v === 'function') return v(width);
    return v;
}

/** Only plain primitives can be inlined into static CSS declarations. */
function staticBranch(v: StyleValue | undefined, unit: string): string | null {
    if (v === undefined) return null;
    if (typeof v === 'number') return `${v}${unit}`;
    if (typeof v === 'string') return v;
    return null; // nested ResponsiveValue/function → dynamic
}

/** when(pred, a, b?) or when([[pred, value], ...]) — first match wins. */
export function when(pred: (width: number) => boolean, a: StyleValue, b?: StyleValue): ResponsiveValue;
export function when(cases: [(width: number) => boolean, StyleValue][]): ResponsiveValue;
export function when(
    predOrCases: ((width: number) => boolean) | [(width: number) => boolean, StyleValue][],
    a?: StyleValue,
    b?: StyleValue,
): ResponsiveValue {
    const cases: [(width: number) => boolean, StyleValue | undefined][] = Array.isArray(predOrCases)
        ? predOrCases
        : [
              [predOrCases, a],
              [() => true, b],
          ];

    return makeValue({
        kind: 'conditional',
        container: cases.some(([, v]) => isResponsiveValue(v) && v.container),
        resolve(width) {
            for (const [pred, value] of cases) {
                if (pred(width)) return resolveBranch(value, width);
            }
            return '';
        },
        toStatic: () => null, // arbitrary lambdas cannot become CSS
    });
}

/** whenInRange(min, max, value, otherwise?) — 2013 heritage, static-emittable. */
export function whenInRange(
    min: number,
    max: number,
    value: StyleValue,
    otherwise?: StyleValue,
): ResponsiveValue {
    return makeValue({
        kind: 'conditional',
        container: [value, otherwise].some((v) => isResponsiveValue(v) && v.container),
        resolve(width) {
            return width >= min && width <= max ? resolveBranch(value, width) : resolveBranch(otherwise, width);
        },
        toStatic(ctx): StaticEmission | null {
            const inRange = staticBranch(value, ctx.unit);
            const outside = staticBranch(otherwise, ctx.unit);
            if (inRange === null || (otherwise !== undefined && outside === null)) return null;
            const blocks: StaticEmission['mediaBlocks'] = [{ min, max, declaration: inRange }];
            return outside !== null && otherwise !== undefined
                ? { declaration: outside, mediaBlocks: blocks }
                : { mediaBlocks: blocks };
        },
    });
}

function switchValue(
    threshold: string | number,
    below: StyleValue,
    aboveOrEqual: StyleValue | undefined,
    op: 'below' | 'above',
): ResponsiveValue {
    return makeValue({
        kind: 'conditional',
        container: [below, aboveOrEqual].some((v) => isResponsiveValue(v) && v.container),
        resolve(width) {
            const w = bpWidth(threshold);
            const matches = op === 'below' ? width < w : width >= w;
            return matches ? resolveBranch(below, width) : resolveBranch(aboveOrEqual, width);
        },
        toStatic(ctx): StaticEmission | null {
            const w = bpWidth(threshold);
            const matched = staticBranch(below, ctx.unit);
            const other = staticBranch(aboveOrEqual, ctx.unit);
            if (matched === null || (aboveOrEqual !== undefined && other === null)) return null;
            // Mobile-first: base = the value below the threshold, @media(min-width) = the other.
            if (op === 'below') {
                if (other === null || aboveOrEqual === undefined) {
                    // No fallback ⇒ the value must NOT leak above the threshold:
                    // emit it max-width-guarded instead of as a global declaration.
                    return { mediaBlocks: [{ max: w - 1, declaration: matched }] };
                }
                return {
                    declaration: matched,
                    mediaBlocks: [{ min: w, declaration: other }],
                };
            }
            return {
                declaration: other ?? '',
                mediaBlocks: [{ min: w, declaration: matched }],
            };
        },
    });
}

export const breakpoint = {
    /** Value when width < breakpoint, else the fallback. */
    below(ref: string | number, value: StyleValue, otherwise?: StyleValue): ResponsiveValue {
        return switchValue(ref, value, otherwise, 'below');
    },

    /** Value when width >= breakpoint, else the fallback. */
    above(ref: string | number, value: StyleValue, otherwise?: StyleValue): ResponsiveValue {
        return switchValue(ref, value, otherwise, 'above');
    },

    /** Value when lo <= width < hi, else the fallback. */
    between(lo: string | number, hi: string | number, value: StyleValue, otherwise?: StyleValue): ResponsiveValue {
        return makeValue({
            kind: 'conditional',
            container: [value, otherwise].some((v) => isResponsiveValue(v) && v.container),
            resolve(width) {
                const min = bpWidth(lo);
                const max = bpWidth(hi);
                return width >= min && width < max ? resolveBranch(value, width) : resolveBranch(otherwise, width);
            },
            toStatic(ctx): StaticEmission | null {
                const inRange = staticBranch(value, ctx.unit);
                const outside = staticBranch(otherwise, ctx.unit);
                if (inRange === null || (otherwise !== undefined && outside === null)) return null;
                const blocks = [{ min: bpWidth(lo), max: bpWidth(hi) - 1, declaration: inRange }];
                return otherwise !== undefined && outside !== null
                    ? { declaration: outside, mediaBlocks: blocks }
                    : { mediaBlocks: blocks };
            },
        });
    },

    /** Named-breakpoint switch: largest matching breakpoint wins. */
    match(map: Record<string, StyleValue>): ResponsiveValue {
        const names = Object.keys(map);
        if (names.length === 0) throw new Error('breakpoint.match(): empty map');

        const sorted = () => names.map((n) => [n, bpWidth(n)] as const).sort((a, b) => a[1] - b[1]);

        return makeValue({
            kind: 'conditional',
            container: names.some((n) => isResponsiveValue(map[n]) && (map[n] as ResponsiveValue).container),
            resolve(width) {
                const entries = sorted();
                let chosen = entries[0][0];
                for (const [name, w] of entries) {
                    if (width >= w) chosen = name;
                }
                return resolveBranch(map[chosen], width);
            },
            toStatic(ctx: StaticContext): StaticEmission | null {
                const entries = sorted();
                const decls = entries.map(([name]) => staticBranch(map[name], ctx.unit));
                if (decls.some((d) => d === null)) return null;
                const [, ...rest] = entries;
                return {
                    declaration: decls[0]!,
                    mediaBlocks: rest.map(([, w], i) => ({ min: w, declaration: decls[i + 1]! })),
                };
            },
        });
    },
};

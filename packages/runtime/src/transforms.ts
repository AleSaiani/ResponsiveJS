/**
 * Transform helpers: wrap a numeric ResponsiveValue into a CSS transform
 * function template with its conventional default unit.
 *
 * They compile to static CSS whenever their parts do — CSS math functions
 * nest, so `translateX(clamp(…))` is a perfectly good declaration.
 */

import { makeValue, isResponsiveValue, type ResponsiveValue, type StaticContext } from './value.js';

type NumberLike = ResponsiveValue | number;

const round = (n: number): number => Math.round(n * 10000) / 10000;

function describe(v: NumberLike): unknown {
    return isResponsiveValue(v) ? (v.meta ?? { value: v.kind }) : v;
}

function wrap(
    fn: string,
    template: (parts: string[]) => string,
    values: NumberLike[],
    defaultUnit: string,
): ResponsiveValue {
    // One driving width per value (same rule as combine()).
    const sourced = values.filter(isResponsiveValue).filter((v) => v.source);
    if (new Set(sourced.map((v) => v.source!.target)).size > 1) {
        throw new Error(`r$: ${fn}() parts follow different elements — a transform has one driving width.`);
    }

    return makeValue({
        kind: 'string',
        container: values.some((v) => isResponsiveValue(v) && v.container),
        source: sourced[0]?.source,
        meta: { value: 'transform', fn, parts: values.map(describe) },
        resolve(width) {
            const parts = values.map((v) => {
                const resolved = isResponsiveValue(v) ? v.resolve(width) : v;
                return typeof resolved === 'number' ? `${round(resolved)}${defaultUnit}` : String(resolved);
            });
            return template(parts);
        },
        toStatic(ctx: StaticContext) {
            const parts: string[] = [];
            for (const v of values) {
                if (!isResponsiveValue(v)) {
                    parts.push(typeof v === 'number' ? `${round(v)}${defaultUnit}` : String(v));
                    continue;
                }
                // The transform's own unit governs its arguments, not the property's.
                const emission = v.toStatic({ ...ctx, unit: v.unit ?? defaultUnit });
                // A nested @media block cannot live inside a declaration.
                if (!emission?.declaration || emission.mediaBlocks?.length) return null;
                parts.push(emission.declaration);
            }
            return { declaration: template(parts) };
        },
    });
}

/** scale(v) — unitless. */
export function scale(v: NumberLike): ResponsiveValue {
    return wrap('scale', (p) => `scale(${p[0]})`, [v], '');
}

/** rotate(v) — degrees. */
export function rotate(v: NumberLike): ResponsiveValue {
    return wrap('rotate', (p) => `rotate(${p[0]})`, [v], 'deg');
}

/** translate(x, y) — px. */
export function translate(x: NumberLike, y: NumberLike): ResponsiveValue {
    return wrap('translate', (p) => `translate(${p[0]}, ${p[1]})`, [x, y], 'px');
}

export function translateX(v: NumberLike): ResponsiveValue {
    return wrap('translateX', (p) => `translateX(${p[0]})`, [v], 'px');
}

export function translateY(v: NumberLike): ResponsiveValue {
    return wrap('translateY', (p) => `translateY(${p[0]})`, [v], 'px');
}

/** skew(x, y?) — degrees. */
export function skew(x: NumberLike, y?: NumberLike): ResponsiveValue {
    return y === undefined
        ? wrap('skew', (p) => `skew(${p[0]})`, [x], 'deg')
        : wrap('skew', (p) => `skew(${p[0]}, ${p[1]})`, [x, y], 'deg');
}

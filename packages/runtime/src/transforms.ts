/**
 * Transform helpers: wrap a numeric ResponsiveValue into a CSS transform
 * function template with its conventional default unit.
 */

import { makeValue, isResponsiveValue, type ResponsiveValue } from './value.js';

type NumberLike = ResponsiveValue | number;

function wrap(template: (parts: string[]) => string, values: NumberLike[], defaultUnit: string): ResponsiveValue {
    return makeValue({
        kind: 'string',
        container: values.some((v) => isResponsiveValue(v) && v.container),
        resolve(width) {
            const parts = values.map((v) => {
                const resolved = isResponsiveValue(v) ? v.resolve(width) : v;
                return typeof resolved === 'number'
                    ? `${Math.round(resolved * 10000) / 10000}${defaultUnit}`
                    : String(resolved);
            });
            return template(parts);
        },
        toStatic: () => null,
    });
}

/** scale(v) — unitless. */
export function scale(v: NumberLike): ResponsiveValue {
    return wrap((p) => `scale(${p[0]})`, [v], '');
}

/** rotate(v) — degrees. */
export function rotate(v: NumberLike): ResponsiveValue {
    return wrap((p) => `rotate(${p[0]})`, [v], 'deg');
}

/** translate(x, y) — px. */
export function translate(x: NumberLike, y: NumberLike): ResponsiveValue {
    return wrap((p) => `translate(${p[0]}, ${p[1]})`, [x, y], 'px');
}

export function translateX(v: NumberLike): ResponsiveValue {
    return wrap((p) => `translateX(${p[0]})`, [v], 'px');
}

export function translateY(v: NumberLike): ResponsiveValue {
    return wrap((p) => `translateY(${p[0]})`, [v], 'px');
}

/** skew(x, y?) — degrees. */
export function skew(x: NumberLike, y?: NumberLike): ResponsiveValue {
    return y === undefined
        ? wrap((p) => `skew(${p[0]})`, [x], 'deg')
        : wrap((p) => `skew(${p[0]}, ${p[1]})`, [x, y], 'deg');
}

/**
 * Curve authoring — the inverse concern of curve.ts analysis.
 *
 * curve.ts answers "does this measured page behave well?"; this module answers
 * "given the control points I want, what is the value at any width?". Together
 * they close the model: author a function, sample it, analyze the samples.
 * Pure math, no DOM.
 */

import type { Curve } from './curve.js';
import { DEFAULT_WIDTHS } from './types.js';

/** A value as a function of (viewport or container) width. */
export type WidthFn = (width: number) => number;

/** Cubic-bezier control points, as in CSS `cubic-bezier(x1, y1, x2, y2)`. */
export type Bezier = [x1: number, y1: number, x2: number, y2: number];

export type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** The width range an interpolator operates over. Values clamp outside it. */
export interface Domain {
    min: number;
    max: number;
}

/** CSS-spec control points for the named easings. */
export const EASINGS: Record<EasingName, Bezier> = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
};

/** Normalized progress of a width inside a domain, clamped to 0..1. */
export function progress(width: number, domain: Domain): number {
    if (domain.max <= domain.min) return width < domain.min ? 0 : 1;
    const t = (width - domain.min) / (domain.max - domain.min);
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Solve a CSS cubic-bezier: for a given x (time/progress) return y (eased
 * progress). Newton-Raphson with bisection fallback, ~1e-6 precision.
 */
export function cubicBezier(bezier: Bezier): (t: number) => number {
    if (!Array.isArray(bezier) || bezier.length !== 4) {
        // Reached mainly through a misspelled easing name, where the lookup
        // yields undefined — say which names exist instead of failing deep
        // inside the maths with "undefined is not iterable".
        throw new Error(
            `r$: invalid easing — expected one of ${Object.keys(EASINGS).map((n) => `'${n}'`).join(', ')} ` +
                `or a 4-number bezier [x1, y1, x2, y2], got ${JSON.stringify(bezier)}`,
        );
    }
    const [x1, y1, x2, y2] = bezier;
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
    const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

    return (t: number): number => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;

        let u = t;
        for (let i = 0; i < 8; i++) {
            const err = sampleX(u) - t;
            if (Math.abs(err) < 1e-7) return sampleY(u);
            const d = sampleDX(u);
            if (Math.abs(d) < 1e-6) break;
            u -= err / d;
        }

        let lo = 0;
        let hi = 1;
        while (hi - lo > 1e-7) {
            u = (lo + hi) / 2;
            if (sampleX(u) < t) lo = u;
            else hi = u;
        }
        return sampleY(u);
    };
}

function fromT(min: number, max: number, domain: Domain, tMap: (t: number) => number): WidthFn {
    return (width) => min + (max - min) * tMap(progress(width, domain));
}

/** Linear interpolation from min (at domain.min) to max (at domain.max). */
export function linear(min: number, max: number, domain: Domain): WidthFn {
    return fromT(min, max, domain, (t) => t);
}

/**
 * Exponential growth: slow start, fast finish.
 *
 * Defined as a normalized easing on t — `min + (max-min)·(base^t − 1)/(base − 1)`
 * — rather than geometric interpolation, so zero/negative endpoints are valid
 * and the function is the exact inverse of logarithmic() with the same base.
 */
export function exponential(min: number, max: number, domain: Domain, base = 4): WidthFn {
    if (base <= 0 || base === 1) throw new Error(`exponential(): base must be > 0 and ≠ 1, got ${base}`);
    return fromT(min, max, domain, (t) => (Math.pow(base, t) - 1) / (base - 1));
}

/** Logarithmic growth: fast start, slow finish. Exact inverse of exponential(). */
export function logarithmic(min: number, max: number, domain: Domain, base = 4): WidthFn {
    if (base <= 0 || base === 1) throw new Error(`logarithmic(): base must be > 0 and ≠ 1, got ${base}`);
    return fromT(min, max, domain, (t) => Math.log(1 + t * (base - 1)) / Math.log(base));
}

/** Interpolation shaped by a CSS easing (named or custom bezier). */
export function eased(min: number, max: number, easing: EasingName | Bezier, domain: Domain): WidthFn {
    const fn = cubicBezier(typeof easing === 'string' ? EASINGS[easing] : easing);
    return fromT(min, max, domain, fn);
}

/**
 * Discrete switch: values[i] applies for width in [breakpoints[i], breakpoints[i+1])
 * (right-open intervals). Below the first breakpoint the first value applies.
 */
export function stepped(values: number[], breakpoints: number[]): WidthFn {
    if (values.length === 0) throw new Error('stepped(): values must not be empty');
    if (values.length !== breakpoints.length) {
        throw new Error(`stepped(): ${values.length} values for ${breakpoints.length} breakpoints — counts must match`);
    }
    const bps = [...breakpoints].sort((a, b) => a - b);
    return (width) => {
        let value = values[0];
        for (let i = 0; i < bps.length; i++) {
            if (width >= bps[i]) value = values[i];
            else break;
        }
        return value;
    };
}

/**
 * Multi-segment interpolation through [width, value] control points, linear
 * per segment (or eased, applied per segment). Clamps to first/last value.
 */
export function piecewise(points: [width: number, value: number][], easing?: EasingName | Bezier): WidthFn {
    if (points.length === 0) throw new Error('piecewise(): points must not be empty');
    const pts = [...points].sort((a, b) => a[0] - b[0]);
    const ease = easing
        ? cubicBezier(typeof easing === 'string' ? EASINGS[easing] : easing)
        : (t: number) => t;
    const last = pts.length - 1;
    return (width) => {
        if (width <= pts[0][0]) return pts[0][1];
        if (width >= pts[last][0]) return pts[last][1];
        for (let i = 1; i <= last; i++) {
            if (width <= pts[i][0]) {
                const [w0, v0] = pts[i - 1];
                const [w1, v1] = pts[i];
                const t = (width - w0) / (w1 - w0);
                return v0 + (v1 - v0) * ease(t);
            }
        }
        return pts[last][1];
    };
}

/** Sample an authored function into a Curve consumable by the analysis half. */
export function sample(f: WidthFn, widths: readonly number[] = DEFAULT_WIDTHS): Curve {
    const curve: Curve = new Map();
    for (const w of widths) curve.set(w, f(w));
    return curve;
}

/**
 * Find the width at which f produces `value` (bisection over the domain).
 * Returns undefined when f is not monotone over the domain or the value is
 * out of f's range there.
 */
export function inverse(f: WidthFn, value: number, domain: Domain, tolerance = 1e-6): number | undefined {
    const lo = f(domain.min);
    const mid = f((domain.min + domain.max) / 2);
    const hi = f(domain.max);
    const up = hi >= lo;

    const eps = 1e-9;
    if (up ? mid < lo - eps || mid > hi + eps : mid > lo + eps || mid < hi - eps) return undefined;

    const minV = Math.min(lo, hi);
    const maxV = Math.max(lo, hi);
    if (value < minV - tolerance || value > maxV + tolerance) return undefined;

    let a = domain.min;
    let b = domain.max;
    for (let i = 0; i < 60; i++) {
        const m = (a + b) / 2;
        if (f(m) < value === up) a = m;
        else b = m;
    }
    return (a + b) / 2;
}

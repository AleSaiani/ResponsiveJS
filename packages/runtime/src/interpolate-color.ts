/**
 * Perceptual color interpolation in OKLab.
 *
 * Why OKLab: sRGB lerp desaturates midpoints (red→blue passes through muddy
 * gray-purple); OKLCH needs a hue-path policy and has undefined hue at
 * achromatic endpoints. OKLab is perceptually uniform and unambiguous; out of
 * gamut mixes are clamped per channel (slight hue shift on very vivid pairs —
 * accepted and documented).
 */

import { parseColor, mixOklab, formatRgb, type RGBA } from '@responsivejs/core/color';
import { cubicBezier, EASINGS, progress, type EasingName, type Bezier } from '@responsivejs/core/interpolate';
import { makeValue, domainOf, type ResponsiveValue, type FluidOpts } from './value.js';

const COLOR_RE =
    /^(#[0-9a-f]{3,8}|rgba?\(.*\)|hsla?\(.*\)|oklch\(.*\)|transparent)$/i;

/** Guard: parseColor falls back to black for arbitrary strings, so a regex decides. */
export function looksLikeColor(s: string): boolean {
    return COLOR_RE.test(s.trim());
}

function tMapOf(curve?: FluidOpts['curve']): (t: number) => number {
    if (!curve || curve === 'linear') return (t) => t;
    if (curve === 'exponential') return (t) => (Math.pow(4, t) - 1) / 3;
    if (curve === 'logarithmic') return (t) => Math.log(1 + 3 * t) / Math.log(4);
    return cubicBezier(typeof curve === 'string' ? EASINGS[curve as EasingName] : (curve as Bezier));
}

export function colorFluid(from: string, to: string, opts?: FluidOpts): ResponsiveValue {
    const a: RGBA = parseColor(from);
    const b: RGBA = parseColor(to);
    const tMap = tMapOf(opts?.curve);

    return makeValue({
        kind: 'color',
        container: opts?.container,
        source: opts?.domain,
        meta: {
            value: 'fluid',
            from,
            to,
            ...(opts?.curve && opts.curve !== 'linear' ? { curve: opts.curve } : {}),
            ...(opts?.domain && typeof opts.domain.target === 'string' ? { follows: opts.domain.target } : {}),
        },
        resolve(width) {
            const t = tMap(progress(width, domainOf(opts)));
            return formatRgb(mixOklab(a, b, t));
        },
        toStatic: () => null,
    });
}

/** Mix two CSS colors at t in OKLab (utility, used by string interpolation too). */
export function mixColors(from: string, to: string, t: number): string {
    return formatRgb(mixOklab(parseColor(from), parseColor(to), t));
}

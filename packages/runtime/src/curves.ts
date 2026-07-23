/**
 * Curve sugar over fluid(): explicit interpolation shapes.
 */

import type { Bezier } from '@responsivejs/core/interpolate';
import { fluid, type ResponsiveValue, type FluidOpts } from './value.js';

type Opts = Omit<FluidOpts, 'curve'>;

export function linear(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'linear' });
}

export function exponential(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'exponential' });
}

export function logarithmic(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'logarithmic' });
}

export function easeIn(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'ease-in' });
}

export function easeOut(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'ease-out' });
}

export function easeInOut(min: number, max: number, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: 'ease-in-out' });
}

/** Custom cubic-bezier curve. */
export function cubic(min: number, max: number, bezier: Bezier, opts?: Opts): ResponsiveValue {
    return fluid(min, max, { ...opts, curve: bezier });
}

/**
 * The value model. A ResponsiveValue is a pure description: resolve(width)
 * computes it, toStatic() emits CSS when the value can live without JS
 * (the CSS-first contract). No signals here — callers supply the width.
 */

import type { Domain, EasingName, Bezier } from '@responsivejs/core/interpolate';
import * as interp from '@responsivejs/core/interpolate';
import { domain as configDomain, configState } from './config.js';
import { colorFluid, looksLikeColor } from './interpolate-color.js';
import { stringFluid } from './interpolate-string.js';

export const RESPONSIVE_VALUE: unique symbol = Symbol.for('responsivejs.value');

export type CurveSpec = 'linear' | 'exponential' | 'logarithmic' | EasingName | Bezier;

export interface StaticContext {
    selector: string;
    property: string;
    domain: Domain;
    breakpoints: number[];
    container: boolean;
    unit: string;
}

/** CSS emitted for a value that needs no JS. */
export interface StaticEmission {
    /** Base (unscoped) declaration value, e.g. a clamp() expression. */
    declaration?: string;
    /** Additional @media-scoped declaration values (min/max in px). */
    mediaBlocks?: { min?: number; max?: number; declaration: string }[];
}

/** Cross-element domain: the value follows ANOTHER element's width. */
export interface ElementSource {
    readonly kind: 'element';
    readonly target: string | Element;
}

export interface ResponsiveValue {
    readonly [RESPONSIVE_VALUE]: true;
    readonly kind: 'fluid' | 'stepped' | 'conditional' | 'custom' | 'combined' | 'color' | 'string';
    /** Bind to the nearest observed container instead of the viewport. */
    readonly container?: boolean;
    /** Bind to a specific element's width (fromElement) — always JS-driven. */
    readonly source?: ElementSource;
    readonly unit?: string;
    resolve(width: number): string | number;
    /** null → the value must stay JS-driven. */
    toStatic(ctx: StaticContext): StaticEmission | null;
}

export type StyleValue = ResponsiveValue | ((width: number) => string | number) | string | number;
export type StyleMap = Record<string, StyleValue>;

export function isResponsiveValue(v: unknown): v is ResponsiveValue {
    return typeof v === 'object' && v !== null && RESPONSIVE_VALUE in v;
}

/** Internal helper: brand a value description. */
export function makeValue(
    desc: Omit<ResponsiveValue, typeof RESPONSIVE_VALUE>,
): ResponsiveValue {
    return { ...desc, [RESPONSIVE_VALUE]: true } as ResponsiveValue;
}

export interface FluidOpts {
    curve?: CurveSpec;
    unit?: string;
    container?: boolean;
    /** Cross-element domain: fluid(14, 18, { domain: fromElement('.sidebar') }). */
    domain?: ElementSource;
    /** Domain override (defaults to the configured breakpoint range). */
    from?: number;
    to?: number;
}

export function domainOf(opts?: FluidOpts): Domain {
    const d = configDomain();
    if (opts?.from === undefined && opts?.to === undefined) return d;
    return { min: opts.from ?? d.min, max: opts.to ?? d.max };
}

export function buildWidthFn(min: number, max: number, curve: CurveSpec, d: Domain): interp.WidthFn {
    if (curve === 'linear') return interp.linear(min, max, d);
    if (curve === 'exponential') return interp.exponential(min, max, d);
    if (curve === 'logarithmic') return interp.logarithmic(min, max, d);
    return interp.eased(min, max, curve, d);
}

/** The Utopia fluid formula: clamp(lo, calc(intercept + slope·100vw), hi). */
export function fluidClamp(min: number, max: number, d: Domain, unit: string, container: boolean): string {
    const slope = (max - min) / (d.max - d.min);
    const intercept = min - slope * d.min;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const rel = container ? 'cqi' : 'vw';
    const fmt = (n: number) => {
        const rounded = Math.round(n * 10000) / 10000;
        return Object.is(rounded, -0) ? 0 : rounded;
    };
    return `clamp(${fmt(lo)}${unit}, calc(${fmt(intercept)}${unit} + ${fmt(slope * 100)}${rel}), ${fmt(hi)}${unit})`;
}

// ─── fluid() — the polymorphic entry ────────────────────────────────────

export function fluid(min: number, max: number, unit?: string): ResponsiveValue;
export function fluid(min: number, max: number, opts: FluidOpts): ResponsiveValue;
export function fluid(values: number[], opts?: FluidOpts): ResponsiveValue;
export function fluid(from: string, to: string, opts?: FluidOpts): ResponsiveValue;
export function fluid(
    a: number | string | number[],
    b?: number | string | FluidOpts,
    c?: string | FluidOpts,
): ResponsiveValue {
    // fluid([8, 16, 24, 32], opts?)
    if (Array.isArray(a)) {
        return arrayFluid(a, b as FluidOpts | undefined);
    }

    const opts: FluidOpts = typeof c === 'string' ? { unit: c } : (c ?? {});

    // fluid('#f00', '#00f') — color or structural string track
    if (typeof a === 'string' || typeof b === 'string') {
        if (typeof a !== 'string' || typeof b !== 'string') {
            throw new Error(`fluid(): endpoints must both be numbers or both strings, got ${typeof a} and ${typeof b}`);
        }
        if (looksLikeColor(a) && looksLikeColor(b)) return colorFluid(a, b, opts);
        return stringFluid(a, b, opts);
    }

    return numericFluid(a, b as number, opts);
}

function numericFluid(min: number, max: number, opts: FluidOpts): ResponsiveValue {
    const curve = opts.curve ?? 'linear';
    return makeValue({
        kind: 'fluid',
        container: opts.container,
        source: opts.domain,
        unit: opts.unit,
        resolve(width) {
            return buildWidthFn(min, max, curve, domainOf(opts))(width);
        },
        toStatic(ctx) {
            if (curve !== 'linear' || opts.domain) return null; // element-driven ⇒ JS
            const d = opts.from !== undefined || opts.to !== undefined ? domainOf(opts) : ctx.domain;
            return { declaration: fluidClamp(min, max, d, opts.unit ?? ctx.unit, opts.container ?? ctx.container) };
        },
    });
}

/**
 * Per-breakpoint values: n values over the first n configured breakpoints
 * (when counts match) or distributed evenly across the full domain otherwise.
 */
function arrayFluid(values: number[], opts?: FluidOpts): ResponsiveValue {
    if (values.length === 0) throw new Error('fluid(): values array must not be empty');
    if (values.some((v) => typeof v !== 'number')) {
        throw new Error('fluid(): per-breakpoint arrays support numbers only');
    }

    const points = (): [number, number][] => {
        const bps = configState.get().breakpoints;
        if (values.length === 1) return [[bps[0], values[0]]];
        if (values.length <= bps.length) {
            return values.map((v, i) => [bps[i], v]);
        }
        const d = domainOf(opts);
        const step = (d.max - d.min) / (values.length - 1);
        return values.map((v, i) => [d.min + step * i, v]);
    };

    const easing = opts?.curve && opts.curve !== 'linear' && opts.curve !== 'exponential' && opts.curve !== 'logarithmic'
        ? opts.curve
        : undefined;

    return makeValue({
        kind: 'fluid',
        container: opts?.container,
        unit: opts?.unit,
        resolve(width) {
            return interp.piecewise(points(), easing)(width);
        },
        toStatic(ctx) {
            if (easing) return null;
            const pts = points();
            const unit = opts?.unit ?? ctx.unit;
            const container = opts?.container ?? ctx.container;
            if (pts.length === 1) return { declaration: `${pts[0][1]}${unit}` };
            const blocks: { min?: number; declaration: string }[] = [];
            for (let i = 1; i < pts.length; i++) {
                const [w0, v0] = pts[i - 1];
                const [w1, v1] = pts[i];
                const decl = v0 === v1 ? `${v0}${unit}` : fluidClamp(v0, v1, { min: w0, max: w1 }, unit, container);
                if (i === 1) blocks.push({ declaration: decl });
                else blocks.push({ min: w0, declaration: decl });
            }
            const [base, ...media] = blocks;
            return { declaration: base.declaration, mediaBlocks: media as { min: number; declaration: string }[] };
        },
    });
}

/** Wrap a custom (width) => value function. Always JS-driven. */
export function custom(fn: (width: number) => string | number, opts?: Pick<FluidOpts, 'container' | 'unit'>): ResponsiveValue {
    return makeValue({
        kind: 'custom',
        container: opts?.container,
        unit: opts?.unit,
        resolve: (width) => fn(width),
        toStatic: () => null,
    });
}

/** Space-join multiple responsive values (e.g. transform parts). */
export function combine(parts: (ResponsiveValue | string | number)[]): ResponsiveValue {
    return makeValue({
        kind: 'combined',
        container: parts.some((p) => isResponsiveValue(p) && p.container),
        resolve(width) {
            return parts.map((p) => (isResponsiveValue(p) ? p.resolve(width) : p)).join(' ');
        },
        toStatic: () => null,
    });
}

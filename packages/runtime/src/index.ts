/**
 * @responsivejs/runtime — the authoring half of r$.
 *
 * value = f(width), reactive, viewport and container aware. CSS-first: what
 * can be expressed as clamp()/@media is emitted as static CSS; JS drives only
 * what CSS cannot (non-linear curves, measured values, logic).
 */

import { applyResponsive, staticCSS, flush, type Target, type ResponsiveHandle } from './apply.js';
import { configure, type RuntimeConfig } from './config.js';
import { defineBreakpoints } from './breakpoints.js';
import { template, applyUtilities } from './template.js';
import { lazy, memo, batch, debug } from './perf.js';
import { tokens } from './tokens.js';
import { manifest } from './provenance.js';
import { fluid, custom, combine, type StyleMap } from './value.js';
import { when, whenInRange, breakpoint } from './conditionals.js';
import { fromElement, sync, ratio } from './cross.js';
import { geometry, whenWraps, whenOverflows, whenTruncated, whenStuck, linesOf, whenCollides } from './geometry.js';

// ─── r$ — the whole authoring surface behind one autocompletable name ───

interface ResponsiveFn {
    /** Apply a responsive style map to elements (CSS-first split). */
    (target: Target, map: StyleMap): ResponsiveHandle;
    /** Tagged template form: r$`.el { font-size: ${fluid(14, 24)}px }` */
    (strings: TemplateStringsArray, ...values: unknown[]): { dispose(): void };

    // values
    fluid: typeof fluid;
    custom: typeof custom;
    combine: typeof combine;
    when: typeof when;
    whenInRange: typeof whenInRange;
    breakpoint: typeof breakpoint;

    // geometry — JS detects, CSS styles
    geometry: typeof geometry;
    whenWraps: typeof whenWraps;
    whenOverflows: typeof whenOverflows;
    whenTruncated: typeof whenTruncated;
    whenStuck: typeof whenStuck;
    linesOf: typeof linesOf;
    whenCollides: typeof whenCollides;

    // cross-element
    fromElement: typeof fromElement;
    sync: typeof sync;
    ratio: typeof ratio;

    // configuration & emission
    config(partial: Partial<RuntimeConfig>): void;
    breakpoints: typeof defineBreakpoints;
    /** Static-only compilation; throws if anything requires JS. */
    static(selector: string, map: StyleMap): string;
    /** Apply without the static-CSS split (everything JS-driven). */
    dynamic(target: Target, map: StyleMap): ResponsiveHandle;
    /** Token bridge: fluid values as custom properties on :root (clamp where linear). */
    tokens: typeof tokens;

    // performance & tooling
    lazy: typeof lazy;
    batch: typeof batch;
    memo: typeof memo;
    debug: typeof debug;
    /** Synchronously drain pending style writes (tests, imperative code). */
    flush(): void;
    /** Utility grammar: r$.apply('.el', 'text-fluid-sm-xl p-fluid-2-8'). */
    apply(target: string | Element, spec: string): ResponsiveHandle;
    /** The live provenance manifest of every active construct (also on window.__rjs_manifest). */
    manifest: typeof manifest;
}

function responsiveBase(
    first: Target | TemplateStringsArray,
    ...rest: unknown[]
): ResponsiveHandle | { dispose(): void } {
    if (Array.isArray(first) && Object.hasOwn(first, 'raw')) {
        return template(first as unknown as TemplateStringsArray, rest);
    }
    return applyResponsive(first as Target, rest[0] as StyleMap);
}

/**
 * The r$ namespace — type `r$.` and discover the whole surface. Named exports
 * remain available for tree-shaking-sensitive code; they are the same
 * functions.
 */
export const r$: ResponsiveFn = Object.assign(responsiveBase as ResponsiveFn, {
    fluid,
    custom,
    combine,
    when,
    whenInRange,
    breakpoint,
    geometry,
    whenWraps,
    whenOverflows,
    whenTruncated,
    whenStuck,
    linesOf,
    whenCollides,
    fromElement,
    sync,
    ratio,
    config: configure,
    breakpoints: defineBreakpoints,
    static: staticCSS,
    dynamic: (target: Target, map: StyleMap) => applyResponsive(target, map, { cssFirst: false }),
    tokens,
    lazy,
    batch,
    memo,
    debug,
    flush,
    apply: applyUtilities,
    manifest,
});

/** Alias of r$ — the historical name. */
export const responsive: ResponsiveFn = r$;

// ─── values ─────────────────────────────────────────────────────────────

export { fluid, custom, combine, isResponsiveValue } from './value.js';
export type { ResponsiveValue, StyleValue, StyleMap, FluidOpts, StaticContext, StaticEmission } from './value.js';
export { when, whenInRange, breakpoint } from './conditionals.js';
export { fromElement, sync, ratio } from './cross.js';
export type { CrossHandle, RatioBounds } from './cross.js';
export type { ElementSource } from './value.js';
export { scale, rotate, translate, translateX, translateY, skew } from './transforms.js';

// ─── curves (also under ./curves) ───────────────────────────────────────

export { linear, exponential, logarithmic, easeIn, easeOut, easeInOut, cubic } from './curves.js';

// ─── layout & typography (also under ./layout, ./typography) ────────────

export { grid, space } from './layout.js';
export { typography } from './typography.js';
export type { TypeScale, TypeScaleOptions } from './typography.js';

// ─── provenance (the closed loop's authoring side) ──────────────────────

export { manifest, registerProvenance } from './provenance.js';
export type { ProvenanceEntry } from '@responsivejs/core/types';

// ─── token bridge ───────────────────────────────────────────────────────

export { tokens } from './tokens.js';
export type { TokensMap, TokensHandle, TokenName, DTCGToken } from './tokens.js';

// ─── geometry predicates (also under ./geometry) ────────────────────────

export { geometry, whenWraps, whenOverflows, whenTruncated, whenStuck, linesOf, whenCollides } from './geometry.js';
export type { GeometryPredicate, GeometryHandle, GeometryOptions, PredicateInput } from './geometry.js';

// ─── reactivity (also under ./signals) ──────────────────────────────────

export { state, computed, effect, subscribe, untrack } from './signals.js';
export type { State, Computed, Signal, Disposer } from './signals.js';
export { viewportWidth, mediaQuery, breakpointSignal, containerWidth, elementSize, scrollTick } from './viewport.js';
export type { ElementSize } from './viewport.js';

// ─── config & emission ──────────────────────────────────────────────────

export { configure, domain, bpWidth } from './config.js';
export { defineBreakpoints } from './breakpoints.js';
export type { TypedBreakpoints } from './breakpoints.js';
export type { RuntimeConfig } from './config.js';
export { emitCSS, injectStyle, removeStyle } from './static.js';
export type { ResponsiveHandle, Target } from './apply.js';

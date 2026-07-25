/**
 * @responsivejs/runtime — the authoring half of r$.
 *
 * value = f(width), reactive, viewport and container aware. CSS-first: what
 * can be expressed as clamp()/@media is emitted as static CSS; JS drives only
 * what CSS cannot (non-linear curves, measured values, logic).
 */

import { applyResponsive, applyDynamic, staticCSS, flush, type Target, type ResponsiveHandle } from './apply.js';
import { configure, config } from './config.js';
import { defineBreakpoints } from './breakpoints.js';
import { template, applyUtilities } from './template.js';
import { lazy, memo, batch, debug } from './perf.js';
import { tokens } from './tokens.js';
import { manifest } from './provenance.js';
import { fluid, custom, combine, type StyleMap } from './value.js';
import { when, whenInRange, breakpoint } from './conditionals.js';
import { fromElement, sync, ratio } from './cross.js';
import { observe } from './observe.js';
import { scope } from './scope.js';
import { geometry, whenWraps, whenOverflows, whenTruncated, whenStuck, linesOf, whenCollides } from './geometry.js';
import { scale, rotate, translate, translateX, translateY, skew } from './transforms.js';
import { linear, exponential, logarithmic, easeIn, easeOut, easeInOut, cubic } from './curves.js';
import { grid, space } from './layout.js';
import { typography } from './typography.js';
import { renderStatic } from './static.js';
import { viewportWidth, containerWidth, elementSize, mediaQuery, breakpointSignal, scrollTick, releaseViewportHub } from './viewport.js';

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
    /** Change the config — both halves of every construct react. */
    configure: typeof configure;
    /** Read the config in force (the getter half). */
    config: typeof config;
    breakpoints: typeof defineBreakpoints;
    /** Static-only compilation; throws if anything requires JS. Each call owns
     *  its own stylesheet: `{ css, dispose }`. */
    static: typeof staticCSS;
    /** Apply without the static-CSS split (everything JS-driven). */
    dynamic: typeof applyDynamic;
    /** Token bridge: fluid values as custom properties on :root (clamp where linear). */
    tokens: typeof tokens;
    /** Selector stays bound as elements come and go (SPA). */
    observe: typeof observe;
    /** Group handles and dispose them together. */
    scope: typeof scope;

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

    // composition helpers — transforms, curves, layout, typography
    scale: typeof scale;
    rotate: typeof rotate;
    translate: typeof translate;
    translateX: typeof translateX;
    translateY: typeof translateY;
    skew: typeof skew;
    linear: typeof linear;
    exponential: typeof exponential;
    logarithmic: typeof logarithmic;
    easeIn: typeof easeIn;
    easeOut: typeof easeOut;
    easeInOut: typeof easeInOut;
    cubic: typeof cubic;
    grid: typeof grid;
    space: typeof space;
    typography: typeof typography;

    // measurement signals + SSR
    viewportWidth: typeof viewportWidth;
    containerWidth: typeof containerWidth;
    elementSize: typeof elementSize;
    mediaQuery: typeof mediaQuery;
    breakpointSignal: typeof breakpointSignal;
    scrollTick: typeof scrollTick;
    /** Release every listener and observer (embedded hosts, SPA teardown). */
    releaseViewportHub: typeof releaseViewportHub;
    /** Every stylesheet emitted so far — what a server inlines into <head>. */
    renderStatic: typeof renderStatic;
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
    configure,
    config,
    breakpoints: defineBreakpoints,
    static: staticCSS,
    dynamic: applyDynamic,
    tokens,
    observe,
    scope,
    lazy,
    batch,
    memo,
    debug,
    flush,
    apply: applyUtilities,
    manifest,
    scale,
    rotate,
    translate,
    translateX,
    translateY,
    skew,
    linear,
    exponential,
    logarithmic,
    easeIn,
    easeOut,
    easeInOut,
    cubic,
    grid,
    space,
    typography,
    viewportWidth,
    containerWidth,
    elementSize,
    mediaQuery,
    breakpointSignal,
    scrollTick,
    releaseViewportHub,
    renderStatic,
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
export { viewportWidth, mediaQuery, breakpointSignal, containerWidth, elementSize, scrollTick, releaseViewportHub } from './viewport.js';
export type { ElementSize } from './viewport.js';

// ─── config & emission ──────────────────────────────────────────────────

export { configure, config, domain, bpWidth } from './config.js';
export { defineBreakpoints } from './breakpoints.js';
export type { TypedBreakpoints } from './breakpoints.js';
export type { RuntimeConfig, ResolvedConfig } from './config.js';
export type { CurveSpec } from './value.js';
export type { AdaptiveGridOptions, SpaceConfig } from './layout.js';
export type { Equals } from './signals.js';
export { emitCSS, injectStyle, removeStyle, renderStatic, emittedStyles } from './static.js';
export { observe } from './observe.js';
export type { ObserveHandle } from './observe.js';
export { scope } from './scope.js';
export type { Scope, Disposable } from './scope.js';
export type { EmitResult } from './static.js';
export type { ResponsiveHandle, Target, StaticHandle } from './apply.js';

// ─── performance & tooling ──────────────────────────────────────────────
// Every namespace member has an importable name: `r$.lazy` IS `lazy`. The
// perf batch (signal batch + style flush) is `batchWrites` so it never
// collides with the pure `batch` of ./signals.

export { flush, staticCSS, applyDynamic } from './apply.js';
export { lazy, memo, debug, batch as batchWrites } from './perf.js';
export { applyUtilities, parseUtilities } from './template.js';

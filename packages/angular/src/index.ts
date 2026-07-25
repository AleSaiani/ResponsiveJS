/**
 * @responsivejs/angular — the lifecycle, handled.
 *
 * Deliberately **decorator-free**: this package ships plain functions and
 * signals, so it needs no Angular compilation step (no ng-packagr, no
 * partial-ivy artifacts) and works from any Angular ≥ 16 app as-is. The
 * two-line directive that wraps `bindResponsive` lives in YOUR app, where
 * your own compiler handles it — the README shows it.
 *
 * Every `inject*` helper must be called in an injection context (a
 * constructor or a factory); each has a DI-free `create*` twin returning an
 * explicit disposer, for code that owns its own teardown.
 */

import { DestroyRef, ElementRef, inject, signal, type Signal } from '@angular/core';
import {
    r$,
    geometry,
    tokens,
    scope,
    subscribe,
    viewportWidth,
    breakpointSignal,
    config,
    type StyleMap,
    type ResponsiveHandle,
    type GeometryHandle,
    type TokensHandle,
    type PredicateInput,
    type Scope,
} from '@responsivejs/runtime';

type ElementLike = ElementRef<HTMLElement> | HTMLElement;

const nativeOf = (target: ElementLike): HTMLElement =>
    target instanceof ElementRef ? target.nativeElement : target;

// ─── constructs ─────────────────────────────────────────────────────────

export interface Binding<T> {
    /** Replace the declaration on the live handle (dropped props restored). */
    update(next: T): void;
    /** Release the construct and everything it owned. */
    destroy(): void;
}

/** Apply a style map to an element; update or destroy through the binding. */
export function createResponsive(target: ElementLike, map: StyleMap): Binding<StyleMap> {
    let handle: ResponsiveHandle | null = r$(nativeOf(target), map);
    return {
        update: (next) => handle?.update(next),
        destroy: () => {
            handle?.dispose();
            handle = null;
        },
    };
}

/** Same, tied to the injection context: destroyed with the component. */
export function injectResponsive(target: ElementLike, map: StyleMap): Binding<StyleMap> {
    const binding = createResponsive(target, map);
    inject(DestroyRef).onDestroy(() => binding.destroy());
    return binding;
}

/** Keep geometry data-attributes in sync on an element. */
export function createGeometry(target: ElementLike, states: Record<string, PredicateInput>): Binding<never> {
    let handle: GeometryHandle | null = geometry(nativeOf(target), states);
    return {
        update: () => {
            throw new Error('r$: geometry states are fixed for the binding — destroy and re-create to change them.');
        },
        destroy: () => {
            handle?.dispose();
            handle = null;
        },
    };
}

export function injectGeometry(target: ElementLike, states: Record<string, PredicateInput>): Binding<never> {
    const binding = createGeometry(target, states);
    inject(DestroyRef).onDestroy(() => binding.destroy());
    return binding;
}

/** Install a token scale; released with the injection context. */
export function injectTokens(map: Parameters<typeof tokens>[0]): TokensHandle {
    const handle = tokens(map);
    inject(DestroyRef).onDestroy(() => handle.dispose());
    return handle;
}

/** A scope tied to the component: add handles, all disposed on destroy. */
export function injectScope(): Scope {
    const s = scope();
    inject(DestroyRef).onDestroy(() => s.dispose());
    return s;
}

// ─── reactive readers (Angular signals) ─────────────────────────────────

export interface SignalBinding<T> {
    value: Signal<T>;
    destroy(): void;
}

/** The viewport width as an Angular signal. SSR-safe (`config().ssrWidth`). */
export function createViewportWidth(): SignalBinding<number> {
    const hub = viewportWidth();
    const width = signal(typeof window === 'undefined' ? config().ssrWidth : hub.get());
    const stop = subscribe(hub, () => width.set(hub.get()));
    return { value: width.asReadonly(), destroy: stop };
}

export function injectViewportWidth(): Signal<number> {
    const binding = createViewportWidth();
    inject(DestroyRef).onDestroy(() => binding.destroy());
    return binding.value;
}

/** A `min-width` match as an Angular signal. */
export function createBreakpoint(ref: string | number): SignalBinding<boolean> {
    const { signal: matches, dispose } = breakpointSignal(ref);
    const state = signal(matches.get());
    const stop = subscribe(matches, () => state.set(matches.get()));
    return {
        value: state.asReadonly(),
        destroy: () => {
            stop();
            dispose();
        },
    };
}

export function injectBreakpoint(ref: string | number): Signal<boolean> {
    const binding = createBreakpoint(ref);
    inject(DestroyRef).onDestroy(() => binding.destroy());
    return binding.value;
}

export type { StyleMap };

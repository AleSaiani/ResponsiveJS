/**
 * The centralized width hub: one resize listener, one shared ResizeObserver,
 * refcounted matchMedia registry. Every acquisition has a matching dispose —
 * no listener outlives its last consumer. SSR-safe: no window access at
 * module level; deterministic fallbacks from config.ssrWidth.
 */

import { state, computed, type State, type Computed, type Disposer } from './signals.js';
import { configState, bpWidth } from './config.js';

const hasWindow = () => typeof window !== 'undefined';

// ─── viewport width (singleton) ─────────────────────────────────────────

let vwState: State<number> | null = null;
let vwCleanup: Disposer | null = null;

/** Reactive viewport width. Lazy singleton; ONE passive resize listener. */
export function viewportWidth(): State<number> {
    if (!vwState) {
        vwState = state(hasWindow() ? window.innerWidth : configState.get().ssrWidth);
        if (hasWindow()) {
            const onResize = () => vwState!.set(window.innerWidth);
            window.addEventListener('resize', onResize, { passive: true });
            vwCleanup = () => window.removeEventListener('resize', onResize);
        }
    }
    return vwState;
}

// ─── matchMedia registry (refcounted) ───────────────────────────────────

interface MqEntry {
    signal: State<boolean>;
    refs: number;
    cleanup: Disposer | null;
}

const mqRegistry = new Map<string, MqEntry>();

/** Reactive media-query match. Refcounted: dispose removes the native listener at zero. */
export function mediaQuery(query: string): { signal: Computed<boolean>; dispose: Disposer } {
    let entry = mqRegistry.get(query);
    if (!entry) {
        if (hasWindow() && typeof window.matchMedia === 'function') {
            const mql = window.matchMedia(query);
            const sig = state(mql.matches);
            const onChange = (e: MediaQueryListEvent) => sig.set(e.matches);
            mql.addEventListener('change', onChange);
            entry = { signal: sig, refs: 0, cleanup: () => mql.removeEventListener('change', onChange) };
        } else {
            entry = { signal: state(false), refs: 0, cleanup: null }; // SSR: never matches
        }
        mqRegistry.set(query, entry);
    }
    entry.refs++;

    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        entry!.refs--;
        if (entry!.refs <= 0) {
            entry!.cleanup?.();
            mqRegistry.delete(query);
        }
    };
    const readonly = computed(() => entry!.signal.get());
    return { signal: readonly, dispose };
}

/** Reactive min-width match for a named or numeric breakpoint. */
export function breakpointSignal(ref: string | number): { signal: Computed<boolean>; dispose: Disposer } {
    return mediaQuery(`(min-width: ${bpWidth(ref)}px)`);
}

// ─── container width (shared ResizeObserver) ────────────────────────────

export interface ElementSize {
    width: number;
    height: number;
}

interface ContainerEntry {
    signal: State<number>;
    /** Created on demand by elementSize(); same observer, same refcount. */
    size: State<ElementSize> | null;
    refs: number;
}

let sharedObserver: ResizeObserver | null = null;
const observedElements = new Map<Element, ContainerEntry>();

function ensureObserver(): ResizeObserver | null {
    if (sharedObserver) return sharedObserver;
    if (!hasWindow() || typeof ResizeObserver === 'undefined') return null;
    sharedObserver = new ResizeObserver((entries) => {
        for (const e of entries) {
            const tracked = observedElements.get(e.target);
            if (!tracked) continue;
            const width = e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect.width;
            tracked.signal.set(Math.round(width));
            if (tracked.size) {
                const height = e.contentBoxSize?.[0]?.blockSize ?? e.contentRect.height ?? 0;
                tracked.size.set({ width: Math.round(width), height: Math.round(height) });
            }
        }
    });
    return sharedObserver;
}

function acquireEntry(el: Element): ContainerEntry {
    let entry = observedElements.get(el);
    if (!entry) {
        const initial = hasWindow() ? el.getBoundingClientRect() : { width: 0, height: 0 };
        entry = { signal: state(Math.round(initial.width)), size: null, refs: 0 };
        observedElements.set(el, entry);
        ensureObserver()?.observe(el);
    }
    entry.refs++;
    return entry;
}

function releaseEntry(el: Element, entry: ContainerEntry): Disposer {
    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        entry.refs--;
        if (entry.refs <= 0) {
            sharedObserver?.unobserve(el);
            observedElements.delete(el);
        }
    };
}

/** Reactive width of an element (container queries in JS). Refcounted dispose. */
export function containerWidth(el: Element): { signal: State<number>; dispose: Disposer } {
    const entry = acquireEntry(el);
    return { signal: entry.signal, dispose: releaseEntry(el, entry) };
}

/** Reactive {width, height} of an element — same shared observer and refcount. */
export function elementSize(el: Element): { signal: State<ElementSize>; dispose: Disposer } {
    const entry = acquireEntry(el);
    if (!entry.size) {
        const initial = hasWindow() ? el.getBoundingClientRect() : { width: 0, height: 0 };
        entry.size = state({ width: Math.round(initial.width), height: Math.round(initial.height) });
    }
    return { signal: entry.size, dispose: releaseEntry(el, entry) };
}

// ─── scroll tick (singleton) ────────────────────────────────────────────

let scrollState: State<number> | null = null;
let scrollCleanup: Disposer | null = null;

/** Monotonic counter bumped on every scroll (capture: nested containers too).
 *  Scroll-sensitive geometry (sticky, collisions) re-measures off this. */
export function scrollTick(): State<number> {
    if (!scrollState) {
        scrollState = state(0);
        if (hasWindow()) {
            const onScroll = () => scrollState!.set(scrollState!.get() + 1);
            document.addEventListener('scroll', onScroll, { capture: true, passive: true });
            scrollCleanup = () => document.removeEventListener('scroll', onScroll, { capture: true });
        }
    }
    return scrollState;
}

// ─── test-only teardown ─────────────────────────────────────────────────

/** Test-only: remove every listener/observer and reset all registries. */
export function __resetViewportHub(): void {
    vwCleanup?.();
    vwCleanup = null;
    vwState = null;
    for (const entry of mqRegistry.values()) entry.cleanup?.();
    mqRegistry.clear();
    sharedObserver?.disconnect();
    sharedObserver = null;
    observedElements.clear();
    scrollCleanup?.();
    scrollCleanup = null;
    scrollState = null;
}

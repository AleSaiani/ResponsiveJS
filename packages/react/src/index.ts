/**
 * @responsivejs/react — the lifecycle, handled.
 *
 * r$ constructs bind to elements and return a handle you must dispose. In
 * React the element arrives after render and leaves on unmount, so these
 * hooks do exactly that: apply on mount, `update()` when your declaration
 * changes, dispose on unmount. Nothing else is wrapped — `r$.fluid(…)` and
 * friends are the same values you already know.
 */

import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
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
    type Target,
} from '@responsivejs/runtime';

type ElementRef = RefObject<Element | null>;

/** Apply a style map to a ref'd element for the lifetime of the component.
 *  `deps` follows the useEffect convention: change them and the map updates
 *  in place (dropped properties are restored). */
export function useResponsive(ref: ElementRef, map: StyleMap, deps: unknown[] = []): void {
    const handle = useRef<ResponsiveHandle | null>(null);
    const latest = useRef(map);
    latest.current = map;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        handle.current = r$(el as HTMLElement, latest.current);
        return () => {
            handle.current?.dispose();
            handle.current = null;
        };
        // deps are the caller's contract, deliberately not inferred
    }, [ref]);

    // A declaration change updates the live handle instead of recreating it.
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        handle.current?.update(latest.current);
        // deps are the caller's contract, deliberately not inferred
    }, deps);
}

/** Keep geometry data-attributes in sync on a ref'd element. */
export function useGeometry(ref: ElementRef, states: Record<string, PredicateInput>, deps: unknown[] = []): void {
    const latest = useRef(states);
    latest.current = states;
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handle: GeometryHandle = geometry(el as HTMLElement, latest.current);
        return () => handle.dispose();
        // deps are the caller's contract, deliberately not inferred
    }, [ref, ...deps]);
}

/** Install a token scale for the lifetime of the component. */
export function useTokens(map: Parameters<typeof tokens>[0], deps: unknown[] = []): void {
    const latest = useRef(map);
    latest.current = map;
    useEffect(() => {
        const handle: TokensHandle = tokens(latest.current);
        return () => handle.dispose();
        // deps are the caller's contract, deliberately not inferred
    }, deps);
}

/** A scope tied to the component: add handles, they all dispose on unmount. */
export function useScope(): ReturnType<typeof scope> {
    const holder = useRef<ReturnType<typeof scope> | null>(null);
    holder.current ??= scope();
    useEffect(() => {
        const current = holder.current!;
        return () => current.dispose();
    }, []);
    return holder.current;
}

/** The reactive viewport width, SSR-safe (falls back to `config().ssrWidth`). */
export function useViewportWidth(): number {
    return useSyncExternalStore(
        (onChange) => subscribe(viewportWidth(), onChange),
        () => viewportWidth().get(),
        () => config().ssrWidth,
    );
}

/** Reactive `min-width` match for a named or numeric breakpoint. */
export function useBreakpoint(ref: string | number): boolean {
    const entry = useRef<{ key: string | number; signal: ReturnType<typeof breakpointSignal> } | null>(null);
    if (entry.current?.key !== ref) {
        entry.current?.signal.dispose();
        entry.current = { key: ref, signal: breakpointSignal(ref) };
    }
    const current = entry.current;
    useEffect(() => () => current.signal.dispose(), [current]);

    return useSyncExternalStore(
        (onChange) => subscribe(current.signal.signal, onChange),
        () => current.signal.signal.get(),
        () => false,
    );
}

export type { StyleMap, Target };

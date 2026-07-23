/**
 * Runtime configuration — itself a signal, so anything resolving breakpoint
 * names (breakpoint.below('tablet', …)) reacts if breakpoints are redefined.
 */

import type { Domain } from '@responsivejs/core/interpolate';
import { state, type State } from './signals.js';

export interface RuntimeConfig {
    /** Plain widths or named map ({mobile: 320, …}). Normalized internally. */
    breakpoints: number[] | Record<string, number>;
    defaultUnit: string;
    /** CSS-first: when true responsive() emits static CSS where possible. */
    useMediaQueries: boolean;
    debug: boolean;
    /** Width assumed when no window exists (SSR). */
    ssrWidth: number;
}

export interface ResolvedConfig {
    breakpoints: number[];
    breakpointNames: Readonly<Record<string, number>>;
    defaultUnit: string;
    useMediaQueries: boolean;
    debug: boolean;
    ssrWidth: number;
}

const DEFAULT_BREAKPOINTS = [320, 768, 1024, 1440, 1920];

function resolveConfig(partial: Partial<RuntimeConfig>, base?: ResolvedConfig): ResolvedConfig {
    let breakpoints = base?.breakpoints ?? DEFAULT_BREAKPOINTS;
    let breakpointNames = base?.breakpointNames ?? {};

    if (partial.breakpoints) {
        if (Array.isArray(partial.breakpoints)) {
            breakpoints = [...partial.breakpoints].sort((a, b) => a - b);
            breakpointNames = {};
        } else {
            breakpointNames = { ...partial.breakpoints };
            breakpoints = Object.values(partial.breakpoints).sort((a, b) => a - b);
        }
        if (breakpoints.length === 0) throw new Error('configure(): breakpoints must not be empty');
    }

    return {
        breakpoints,
        breakpointNames,
        defaultUnit: partial.defaultUnit ?? base?.defaultUnit ?? 'px',
        useMediaQueries: partial.useMediaQueries ?? base?.useMediaQueries ?? true,
        debug: partial.debug ?? base?.debug ?? false,
        ssrWidth: partial.ssrWidth ?? base?.ssrWidth ?? 1024,
    };
}

export const configState: State<ResolvedConfig> = state(resolveConfig({}));

export function configure(partial: Partial<RuntimeConfig>): void {
    configState.set(resolveConfig(partial, configState.get()));
}

/** Define (or replace) named breakpoints: responsive.breakpoints({mobile: 320, …}). */
export function defineBreakpoints(map: Record<string, number>): void {
    configure({ breakpoints: map });
}

/** Resolve a breakpoint reference (name or raw px) to a width. */
export function bpWidth(ref: string | number): number {
    if (typeof ref === 'number') return ref;
    const names = configState.get().breakpointNames;
    const width = names[ref];
    if (width === undefined) {
        const known = Object.keys(names);
        throw new Error(
            `Unknown breakpoint '${ref}'. ${
                known.length > 0
                    ? `Known: ${known.join(', ')}.`
                    : 'No named breakpoints defined — call responsive.breakpoints({name: width}) first.'
            }`,
        );
    }
    return width;
}

/** The default fluid() domain: first to last configured breakpoint. */
export function domain(): Domain {
    const bps = configState.get().breakpoints;
    return { min: bps[0], max: bps[bps.length - 1] };
}

/** Test-only: restore defaults. */
export function __resetConfig(): void {
    configState.set(resolveConfig({}));
}

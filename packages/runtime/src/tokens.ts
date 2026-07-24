/**
 * Token bridge — fluid values as CSS custom properties on :root.
 *
 *     responsive.tokens({ '--space-md': fluid(8, 16), '--font-hero': fluid(24, 48) });
 *
 * One write point instead of N styled elements: linear values compile to a
 * static clamp() stylesheet (zero JS at runtime), everything else updates its
 * variable from ONE viewport effect. The page consumes var(--space-md)
 * anywhere — themable, inspectable in devtools, SSR-friendly (ship `css`).
 */

import { effect, type Disposer } from './signals.js';
import { viewportWidth } from './viewport.js';
import { configState } from './config.js';
import { emitCSS, injectStyle, removeStyle, declarationValue } from './static.js';
import { isResponsiveValue, type StyleMap, type StyleValue } from './value.js';
import { registerProvenance, describeMap } from './provenance.js';

export type TokenName = `--${string}`;
export type TokensMap = Record<TokenName, StyleValue>;

export interface TokensHandle {
    /** The static stylesheet (clamp/@media on :root) — also what SSR should ship. */
    readonly css: string;
    /** Token names that stay JS-driven (non-linear curves, conditionals, colors). */
    readonly dynamic: readonly TokenName[];
    /** Design Tokens Community Group export (static values verbatim, dynamic sampled). */
    toDTCG(): Record<string, DTCGToken>;
    /** Remove the stylesheet, the JS-driven variables, and the effect. */
    dispose(): void;
}

export interface DTCGToken {
    $type: 'dimension' | 'color' | 'number' | 'string';
    $value: string | number;
    $extensions?: {
        'design.responsivejs': { curve: [number, string | number][] };
    };
}

let tokenCounter = 0;

export function tokens(map: TokensMap): TokensHandle {
    for (const name of Object.keys(map)) {
        if (!name.startsWith('--')) {
            throw new Error(`responsive.tokens(): '${name}' is not a custom property — token names start with '--'`);
        }
    }

    const styleKey = `r$:tokens:#${++tokenCounter}`;
    const { css, dynamicRest } = emitCSS(':root', map as StyleMap);
    if (css.length > 0) injectStyle(css, styleKey);

    const dynamicNames = Object.keys(dynamicRest) as TokenName[];
    const disposers: Disposer[] = [];
    disposers.push(
        registerProvenance({
            construct: 'tokens',
            target: ':root',
            behavior: (Object.keys(map) as TokenName[]).map(
                (n) => `${n}: ${dynamicNames.includes(n) ? 'dynamic' : 'static clamp'}`,
            ),
            config: describeMap(map as StyleMap),
        }),
    );
    /** Inline :root values present before our first write — restored on dispose. */
    const savedVars = new Map<string, string>();

    if (dynamicNames.length > 0 && typeof document !== 'undefined') {
        const root = document.documentElement;
        for (const name of dynamicNames) savedVars.set(name, root.style.getPropertyValue(name));
        const vw = viewportWidth();
        disposers.push(
            effect(() => {
                const width = vw.get();
                const unit = configState.get().defaultUnit;
                for (const name of dynamicNames) {
                    root.style.setProperty(name, resolveToken(dynamicRest[name], width, unit));
                }
            }),
        );
    }

    return {
        css,
        dynamic: dynamicNames,
        toDTCG() {
            const out: Record<string, DTCGToken> = {};
            const cfg = configState.get();
            const sampleWidths = cfg.breakpoints;
            const currentWidth = typeof window !== 'undefined' ? window.innerWidth : cfg.ssrWidth;

            for (const [name, value] of Object.entries(map) as [TokenName, StyleValue][]) {
                const resolved = resolveToken(value, currentWidth, cfg.defaultUnit);
                const token: DTCGToken = { $type: dtcgType(resolved), $value: resolved };
                if (dynamicNames.includes(name) || isResponsiveValue(value)) {
                    token.$extensions = {
                        'design.responsivejs': {
                            curve: sampleWidths.map((w) => [w, resolveToken(value, w, cfg.defaultUnit)]),
                        },
                    };
                }
                out[name.slice(2)] = token;
            }
            return out;
        },
        dispose() {
            for (const d of disposers) d();
            if (css.length > 0) removeStyle(styleKey);
            if (typeof document !== 'undefined') {
                const root = document.documentElement;
                for (const name of dynamicNames) {
                    const saved = savedVars.get(name);
                    if (saved) root.style.setProperty(name, saved);
                    else root.style.removeProperty(name);
                }
            }
        },
    };
}

function resolveToken(value: StyleValue, width: number, unit: string): string {
    const resolved = isResponsiveValue(value) ? value.resolve(width) : typeof value === 'function' ? value(width) : value;
    // Custom properties carry no intrinsic unit — numbers get the default unit.
    return typeof resolved === 'number' ? declarationValue(resolved, '', unit) : String(resolved);
}

function dtcgType(resolved: string | number): DTCGToken['$type'] {
    if (typeof resolved === 'number') return 'number';
    if (/^(rgb|hsl|oklab|oklch|#)/.test(resolved)) return 'color';
    if (/^-?[\d.]+(px|rem|em|vw|vh|cqi|%)$/.test(resolved) || /^clamp\(/.test(resolved)) return 'dimension';
    return 'string';
}

/**
 * Static CSS emission — the CSS-first contract. Values that can live without
 * JS (linear fluid → Utopia clamp, breakpoint switches → @media) are compiled
 * to a stylesheet; only the rest stays dynamic. Deterministic output.
 */

import { configState, domain } from './config.js';
import { isResponsiveValue, type StyleMap, type StaticContext, type StaticEmission } from './value.js';

/** CSS properties whose numeric values carry no unit. */
export const UNITLESS = new Set([
    'opacity',
    'z-index',
    'font-weight',
    'line-height',
    'flex',
    'flex-grow',
    'flex-shrink',
    'order',
    'zoom',
    'scale',
    'aspect-ratio',
    'column-count',
    'orphans',
    'widows',
]);

export function toKebab(prop: string): string {
    return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Format a resolved value as a CSS declaration value. */
export function declarationValue(value: string | number, kebabProp: string, unit: string): string {
    if (typeof value === 'string') return value;
    if (UNITLESS.has(kebabProp) || value === 0) return String(Math.round(value * 10000) / 10000);
    return `${Math.round(value * 10000) / 10000}${unit}`;
}

export interface EmitResult {
    css: string;
    dynamicRest: StyleMap;
}

/**
 * Compile a StyleMap: everything statically expressible becomes CSS for the
 * selector; the remainder is returned for JS-driven application.
 */
export function emitCSS(selector: string, map: StyleMap): EmitResult {
    const cfg = configState.get();
    const d = domain();
    const base: string[] = [];
    // key = `${min ?? ''}|${max ?? ''}` — grouped media blocks, sorted by min.
    const media = new Map<string, { min?: number; max?: number; decls: string[] }>();
    const dynamicRest: StyleMap = {};

    for (const [prop, value] of Object.entries(map)) {
        const kebab = toKebab(prop);

        if (typeof value === 'number' || typeof value === 'string') {
            base.push(`${kebab}: ${declarationValue(value, kebab, cfg.defaultUnit)};`);
            continue;
        }
        if (!isResponsiveValue(value)) {
            dynamicRest[prop] = value; // custom function
            continue;
        }

        // The value's own unit wins over the global default — otherwise a
        // rem-valued fluid would compile to px.
        const ctx: StaticContext = {
            selector,
            property: kebab,
            domain: d,
            breakpoints: cfg.breakpoints,
            container: value.container ?? false,
            unit: UNITLESS.has(kebab) ? '' : (value.unit ?? cfg.defaultUnit),
        };

        const emission: StaticEmission | null = value.toStatic(ctx);
        if (emission === null) {
            dynamicRest[prop] = value;
            continue;
        }

        if (emission.declaration !== undefined && emission.declaration !== '') {
            base.push(`${kebab}: ${emission.declaration};`);
        }
        for (const block of emission.mediaBlocks ?? []) {
            const key = `${block.min ?? ''}|${block.max ?? ''}`;
            let entry = media.get(key);
            if (!entry) {
                entry = { min: block.min, max: block.max, decls: [] };
                media.set(key, entry);
            }
            entry.decls.push(`${kebab}: ${block.declaration};`);
        }
    }

    const parts: string[] = [];
    if (base.length > 0) {
        parts.push(`${selector} {\n    ${base.join('\n    ')}\n}`);
    }
    const sortedMedia = [...media.values()].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
    for (const { min, max, decls } of sortedMedia) {
        const conditions = [
            min !== undefined ? `(min-width: ${min}px)` : null,
            max !== undefined ? `(max-width: ${max}px)` : null,
        ].filter(Boolean);
        parts.push(`@media ${conditions.join(' and ')} {\n    ${selector} {\n        ${decls.join('\n        ')}\n    }\n}`);
    }

    return { css: parts.join('\n'), dynamicRest };
}

// ─── injection ──────────────────────────────────────────────────────────

/**
 * Every stylesheet r$ has emitted, keyed by its owner. Injection is a browser
 * side effect; this registry is what makes the SAME css available on the
 * server, where there is no document to inject into.
 */
const emitted = new Map<string, string>();

/** One <style data-responsivejs="key"> per key, replaced on update.
 *  Under SSR it only records — `renderStatic()` then returns the sheet. */
export function injectStyle(css: string, key: string): void {
    emitted.set(key, css);
    if (typeof document === 'undefined') return;
    const attr = 'data-responsivejs';
    let el = document.head.querySelector<HTMLStyleElement>(`style[${attr}="${CSS.escape(key)}"]`);
    if (!el) {
        el = document.createElement('style');
        el.setAttribute(attr, key);
        const { nonce } = configState.get();
        if (nonce) el.setAttribute('nonce', nonce);
        document.head.appendChild(el);
    }
    el.textContent = css;
}

/** Remove an injected stylesheet. */
export function removeStyle(key: string): void {
    emitted.delete(key);
    if (typeof document === 'undefined') return;
    document.head.querySelector(`style[data-responsivejs="${CSS.escape(key)}"]`)?.remove();
}

/**
 * Every stylesheet emitted so far, concatenated — what a server should inline
 * into `<head>` so the page is correct BEFORE any JavaScript runs. Call it
 * after rendering (constructs emit as they are created).
 */
export function renderStatic(): string {
    return [...emitted.values()].filter((css) => css.length > 0).join('\n');
}

/** The emitted stylesheets, keyed by owner — for tooling that needs the parts. */
export function emittedStyles(): ReadonlyMap<string, string> {
    return new Map(emitted);
}

/** Test-only: forget every recorded emission. */
export function __resetEmitted(): void {
    emitted.clear();
}

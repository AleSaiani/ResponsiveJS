/**
 * Geometry predicates — state derived from measured geometry, reactively.
 *
 * CSS 2026 still has no selector for "did my children wrap", "is this sticky
 * element currently stuck", "is this text truncated". The pattern here is
 * **JS detects, CSS styles**: a predicate measures one fact off the live DOM;
 * geometry() keeps data-attributes in sync so stylesheets target
 * `.nav[data-wrapped]` instead of re-deriving layout in JS.
 *
 *     geometry('.nav', { wrapped: whenWraps, crowded: whenOverflows });
 *     // <nav data-wrapped> …  CSS: .nav[data-wrapped] { … }
 *
 * Re-measures on element resize (shared ResizeObserver), viewport resize,
 * and — for scroll-sensitive predicates (sticky, collisions) — scroll.
 */

import { effect, type Disposer } from './signals.js';
import { viewportWidth, elementSize, scrollTick } from './viewport.js';
import { resolveElements, type Target } from './apply.js';
import { toKebab } from './static.js';
import { registerProvenance } from './provenance.js';

export interface GeometryPredicate {
    /** Pure, synchronous measurement — also callable directly for one-shot checks. */
    measure(el: Element): boolean | number;
    /** True ⇒ re-measure on scroll as well (sticky, collisions). */
    scroll?: boolean;
}

// ─── the predicates ─────────────────────────────────────────────────────

/** Children flow on more than one row (a second child starts below the first's bottom). */
export function whenWraps(): GeometryPredicate {
    return {
        measure(el) {
            const children = el.children;
            if (children.length < 2) return false;
            const first = children[0].getBoundingClientRect();
            for (let i = 1; i < children.length; i++) {
                if (children[i].getBoundingClientRect().top >= first.bottom - 1) return true;
            }
            return false;
        },
    };
}

/** Content exceeds the box on the given axis (scroll size vs client size). */
export function whenOverflows(axis: 'x' | 'y' | 'both' = 'x'): GeometryPredicate {
    return {
        measure(el) {
            const x = el.scrollWidth > el.clientWidth + 1;
            const y = el.scrollHeight > el.clientHeight + 1;
            return axis === 'x' ? x : axis === 'y' ? y : x || y;
        },
    };
}

/** Text is actually cut: content overflows an axis whose overflow is hidden/clip
 *  (single-line ellipsis and -webkit-line-clamp both measure this way). */
export function whenTruncated(): GeometryPredicate {
    return {
        measure(el) {
            const cs = getComputedStyle(el);
            const clippedX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
            const clippedY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
            return (
                (clippedX && el.scrollWidth > el.clientWidth + 1) ||
                (clippedY && el.scrollHeight > el.clientHeight + 1)
            );
        },
    };
}

/** A position:sticky element currently pinned to its top/bottom offset
 *  (the IntersectionObserver-sentinel hack, without the sentinel). */
export function whenStuck(): GeometryPredicate {
    return {
        scroll: true,
        measure(el) {
            const cs = getComputedStyle(el);
            if (cs.position !== 'sticky') return false;
            const rect = el.getBoundingClientRect();
            const parent = el.parentElement?.getBoundingClientRect();

            const top = parseFloat(cs.top);
            if (!Number.isNaN(top)) {
                return rect.top <= top + 0.5 && (!parent || parent.top < rect.top - 0.5);
            }
            const bottom = parseFloat(cs.bottom);
            if (!Number.isNaN(bottom)) {
                const vh = window.innerHeight;
                return rect.bottom >= vh - bottom - 0.5 && (!parent || parent.bottom > rect.bottom + 0.5);
            }
            return false;
        },
    };
}

/** Number of rendered text lines (content height / line height). */
export function linesOf(): GeometryPredicate {
    return {
        measure(el) {
            const cs = getComputedStyle(el);
            let lineHeight = parseFloat(cs.lineHeight);
            if (Number.isNaN(lineHeight)) lineHeight = (parseFloat(cs.fontSize) || 16) * 1.2; // 'normal'
            if (lineHeight <= 0) return 0;
            const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            const contentHeight = el.getBoundingClientRect().height - padding;
            return Math.max(0, Math.round(contentHeight / lineHeight));
        },
    };
}

/** The element's rect overlaps another element's rect. */
export function whenCollides(other: string | Element): GeometryPredicate {
    return {
        scroll: true,
        measure(el) {
            const target = typeof other === 'string' ? document.querySelector(other) : other;
            if (!target) return false;
            const a = el.getBoundingClientRect();
            const b = target.getBoundingClientRect();
            return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        },
    };
}

// ─── geometry(): predicates → data-attributes ───────────────────────────

/** Accepts a built predicate ({measure}) or its factory (whenWraps vs whenWraps()). */
export type PredicateInput = GeometryPredicate | (() => GeometryPredicate);

export interface GeometryOptions {
    /** Attribute prefix. Default 'data-' → key 'wrapped' becomes data-wrapped. */
    prefix?: string;
}

export interface GeometryHandle {
    readonly elements: readonly HTMLElement[];
    /** Force a synchronous re-measure (after imperative DOM changes). */
    measure(): void;
    pause(): void;
    resume(): void;
    /** Remove observers and every attribute geometry() set. */
    dispose(): void;
}

export function geometry(
    target: Target,
    states: Record<string, PredicateInput>,
    opts: GeometryOptions = {},
): GeometryHandle {
    const prefix = opts.prefix ?? 'data-';
    const predicates: [string, GeometryPredicate][] = Object.entries(states).map(([key, input]) => [
        `${prefix}${toKebab(key)}`,
        typeof input === 'function' ? input() : input,
    ]);

    if (typeof window === 'undefined') {
        // SSR: geometry is progressive enhancement — an inert handle.
        return { elements: [], measure() {}, pause() {}, resume() {}, dispose() {} };
    }

    const elements = resolveElements(target);
    const needsScroll = predicates.some(([, p]) => p.scroll);
    let paused = false;
    const disposers: Disposer[] = [];
    disposers.push(
        registerProvenance({
            construct: 'geometry',
            target: typeof target === 'string' ? target : `${elements.length} element(s)`,
            behavior: predicates.map(([attr]) => attr),
        }),
    );

    const measureElement = (el: HTMLElement): void => {
        for (const [attr, predicate] of predicates) {
            const value = predicate.measure(el);
            if (typeof value === 'boolean') {
                if (value) el.setAttribute(attr, '');
                else el.removeAttribute(attr);
            } else {
                el.setAttribute(attr, String(value));
            }
        }
    };

    const vw = viewportWidth();
    const st = needsScroll ? scrollTick() : null;
    for (const el of elements) {
        const { signal: size, dispose } = elementSize(el);
        disposers.push(dispose);
        disposers.push(
            effect(() => {
                vw.get();
                size.get();
                st?.get();
                if (paused) return;
                measureElement(el);
            }),
        );
    }

    return {
        elements,
        measure() {
            for (const el of elements) measureElement(el);
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
            this.measure();
        },
        dispose() {
            for (const d of disposers) d();
            for (const el of elements) {
                for (const [attr] of predicates) el.removeAttribute(attr);
            }
        },
    };
}

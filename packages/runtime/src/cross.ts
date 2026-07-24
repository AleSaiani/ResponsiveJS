/**
 * Cross-element dependencies — the layout relations CSS cannot declare:
 * a value driven by ANOTHER element's width (fromElement), equal sizes
 * across unrelated containers (sync), and an actively-enforced width ratio
 * (ratio — the design constraint, promoted from assertion to enforcement).
 *
 * sync()/ratio() re-run on viewport resizes and via handle.measure(); they
 * deliberately do NOT observe their own targets (writing a size from a size
 * observation loops).
 */

import { effect } from './signals.js';
import { viewportWidth } from './viewport.js';
import { resolveElements, type Target } from './apply.js';
import type { ElementSource } from './value.js';

/** Cross-element domain for fluid(): the value follows this element's width. */
export function fromElement(target: string | Element): ElementSource {
    return { kind: 'element', target };
}

export interface CrossHandle {
    /** Force a synchronous re-measure (after content changes). */
    measure(): void;
    dispose(): void;
}

const inert: CrossHandle = { measure() {}, dispose() {} };

/** Equalize a property across all matched elements (max natural size wins).
 *  The grid/flex-independent "equal heights" — works across containers. */
export function sync(target: Target, prop: 'height' | 'width' = 'height'): CrossHandle {
    if (typeof window === 'undefined') return inert;
    const elements = resolveElements(target);
    if (elements.length < 2) return inert;

    // Pre-existing inline values are overridden while the sync is active
    // (that is the construct's job) but restored on dispose.
    const saved = new Map(elements.map((el) => [el, el.style.getPropertyValue(prop)]));

    const measure = (): void => {
        // Natural size: measure with our own constraint lifted.
        for (const el of elements) el.style.removeProperty(prop);
        const sizes = elements.map((el) => el.getBoundingClientRect()[prop]);
        const max = Math.max(...sizes);
        for (const el of elements) el.style.setProperty(prop, `${Math.round(max * 100) / 100}px`);
    };

    const vw = viewportWidth();
    const stop = effect(() => {
        vw.get();
        measure();
    });

    return {
        measure,
        dispose() {
            stop();
            for (const el of elements) {
                const previous = saved.get(el);
                if (previous) el.style.setProperty(prop, previous);
                else el.style.removeProperty(prop);
            }
        },
    };
}

export interface RatioBounds {
    min?: number;
    max?: number;
}

/** Keep width(a)/width(b) within bounds by constraining a's width.
 *  Inside the bounds the layout flows free (our constraint is removed). */
export function ratio(a: string | Element, b: string | Element, bounds: RatioBounds): CrossHandle {
    if (typeof window === 'undefined') return inert;
    const [elA] = resolveElements(a);
    const [elB] = resolveElements(b);
    if (!elA || !elB) return inert;

    const savedWidth = elA.style.getPropertyValue('width');

    const measure = (): void => {
        elA.style.removeProperty('width');
        const wa = elA.getBoundingClientRect().width;
        const wb = elB.getBoundingClientRect().width;
        if (wb <= 0) return;
        const r = wa / wb;
        if (bounds.min !== undefined && r < bounds.min) {
            elA.style.setProperty('width', `${Math.round(bounds.min * wb * 100) / 100}px`);
        } else if (bounds.max !== undefined && r > bounds.max) {
            elA.style.setProperty('width', `${Math.round(bounds.max * wb * 100) / 100}px`);
        }
    };

    const vw = viewportWidth();
    const stop = effect(() => {
        vw.get();
        measure();
    });

    return {
        measure,
        dispose() {
            stop();
            if (savedWidth) elA.style.setProperty('width', savedWidth);
            else elA.style.removeProperty('width');
        },
    };
}

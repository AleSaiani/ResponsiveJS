/**
 * Snapshot query API: access measured data at specific widths and build curves.
 */

import type { Rect } from './rect.js';
import type { Curve } from './curve.js';
import type { SnapshotStore, ElementSnapshot, ViewportSnapshot, ChildRelation } from './types.js';

/** Query interface for a specific viewport width */
export class WidthQuery {
    constructor(
        private readonly snapshot: ViewportSnapshot,
    ) {}

    /** Get the first element matching selector */
    element(selector: string): ElementSnapshot | undefined {
        return this.snapshot.elements.get(selector)?.[0];
    }

    /** Get all elements matching selector */
    elements(selector: string): ElementSnapshot[] {
        return this.snapshot.elements.get(selector) || [];
    }

    /** Get rect of first matching element */
    rect(selector: string): Rect | undefined {
        return this.element(selector)?.rect;
    }

    /** Get rects of all matching elements */
    rects(selector: string): Rect[] {
        return this.elements(selector).map(e => e.rect);
    }

    /** Get a computed style value (in px) */
    style(selector: string, prop: keyof ElementSnapshot['styles']): number | undefined {
        return this.element(selector)?.styles[prop];
    }

    /** Get direct children rects of a container */
    children(selector: string): Rect[] {
        const relations = this.snapshot.childRelations?.get(selector);
        if (!relations || relations.length === 0) return [];
        return relations[0].childRects;
    }

    /** Get child relation (parent + children) */
    childRelation(selector: string): ChildRelation | undefined {
        return this.snapshot.childRelations?.get(selector)?.[0];
    }

    /** Get a computed string property (display, color, etc.) */
    computedProp(selector: string, prop: keyof ElementSnapshot['computed']): string | undefined {
        const value = this.element(selector)?.computed[prop];
        return value === undefined ? undefined : String(value);
    }

    /** Get all rects from all selectors at this width */
    allRects(): { selector: string; index: number; rect: Rect }[] {
        const result: { selector: string; index: number; rect: Rect }[] = [];
        for (const [selector, elements] of this.snapshot.elements) {
            for (const el of elements) {
                result.push({ selector, index: el.index, rect: el.rect });
            }
        }
        return result;
    }

    /** Get viewport dimensions */
    get viewport() {
        return { width: this.snapshot.width, height: this.snapshot.height };
    }
}

/** Query API across all viewport widths */
export class StoreQuery {
    constructor(
        private readonly store: SnapshotStore,
    ) {}

    /** Get query for a specific viewport width (nearest if exact not found) */
    at(width: number): WidthQuery {
        const snapshot = this.store.snapshots.get(width);
        if (snapshot) return new WidthQuery(snapshot);

        // Find nearest width
        let nearest = this.store.widths[0];
        let minDist = Math.abs(width - nearest);
        for (const w of this.store.widths) {
            const dist = Math.abs(width - w);
            if (dist < minDist) { nearest = w; minDist = dist; }
        }
        return new WidthQuery(this.store.snapshots.get(nearest)!);
    }

    /** Build a curve: one property across all viewport widths */
    curve(selector: string, prop: keyof ElementSnapshot['styles'] | 'width' | 'height' | 'x' | 'y'): Curve {
        const curve: Curve = new Map();

        for (const [w, snapshot] of this.store.snapshots) {
            const el = snapshot.elements.get(selector)?.[0];
            if (!el) continue;

            let value: number;
            if (prop === 'width' || prop === 'height' || prop === 'x' || prop === 'y') {
                value = el.rect[prop];
            } else {
                value = el.styles[prop];
            }

            curve.set(w, value);
        }

        return curve;
    }

    /** Build a curve for a rect property */
    rectCurve(selector: string, prop: keyof Rect): Curve {
        const curve: Curve = new Map();
        for (const [w, snapshot] of this.store.snapshots) {
            const el = snapshot.elements.get(selector)?.[0];
            if (!el) continue;
            curve.set(w, el.rect[prop]);
        }
        return curve;
    }

    /** Get all measured widths */
    get widths(): number[] {
        return this.store.widths;
    }

    /** Get all selectors */
    get selectors(): string[] {
        return this.store.selectors;
    }

    /** Build a curve for any style property (numeric) across all widths */
    styleCurve(selector: string, prop: keyof ElementSnapshot['styles']): Curve {
        const curve: Curve = new Map();
        for (const [w, snapshot] of this.store.snapshots) {
            const el = snapshot.elements.get(selector)?.[0];
            if (!el) continue;
            curve.set(w, el.styles[prop]);
        }
        return curve;
    }

    /** Build a curve for a computed string property across all widths */
    computedCurve(selector: string, prop: keyof ElementSnapshot['computed']): Map<number, string> {
        const curve = new Map<number, string>();
        for (const [w, snapshot] of this.store.snapshots) {
            const el = snapshot.elements.get(selector)?.[0];
            if (!el) continue;
            const value = el.computed[prop];
            if (value === undefined) continue;
            curve.set(w, String(value));
        }
        return curve;
    }

    /** Get all rects from all selectors at a given width */
    allRectsAt(width: number): { selector: string; index: number; rect: Rect }[] {
        return this.at(width).allRects();
    }

    /** Get the raw store */
    get raw(): SnapshotStore {
        return this.store;
    }
}

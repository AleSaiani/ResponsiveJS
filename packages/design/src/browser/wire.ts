/**
 * Wire format — the serialization boundary of measurements.
 *
 * ViewportSnapshot/SnapshotStore carry `Map`s, which do not survive
 * page.evaluate / CDP Runtime.evaluate (returnByValue) / JSON.stringify.
 * The wire types are the arrays-of-entries mirror; hydrate/dehydrate live
 * here and nowhere else.
 */

import type { ElementSnapshot, ViewportSnapshot, ChildRelation, SnapshotStore } from '@responsivejs/core/types';
import { fromDOMRect, type Rect } from '@responsivejs/core/rect';

export interface RawRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ElementSnapshotWire {
    selector: string;
    index: number;
    rect: RawRect;
    styles: ElementSnapshot['styles'];
    computed: ElementSnapshot['computed'];
}

export interface ChildRelationWire {
    parentSelector: string;
    parentRect: RawRect;
    childRects: RawRect[];
}

export interface ViewportSnapshotWire {
    width: number;
    height: number;
    scrollY?: number;
    timestamp: number;
    elements: [selector: string, snapshots: ElementSnapshotWire[]][];
    childRelations: [selector: string, relations: ChildRelationWire[]][];
}

export interface SerializedStore {
    widths: number[];
    selectors: string[];
    snapshots: [width: number, snapshot: ViewportSnapshotWire][];
}

/** Rebuild the derived Rect fields (right/bottom/center/area) from a raw rect. */
export function expandRect(r: RawRect): Rect {
    return fromDOMRect(r);
}

/** Hydrate a wire snapshot into the full in-memory ViewportSnapshot. */
export function fromWire(wire: ViewportSnapshotWire): ViewportSnapshot {
    const elements = new Map<string, ElementSnapshot[]>();
    for (const [selector, snaps] of wire.elements) {
        elements.set(
            selector,
            snaps.map((s) => ({
                selector: s.selector,
                index: s.index,
                rect: expandRect(s.rect),
                styles: s.styles,
                computed: s.computed,
            })),
        );
    }

    const childRelations = new Map<string, ChildRelation[]>();
    for (const [selector, relations] of wire.childRelations) {
        childRelations.set(
            selector,
            relations.map((r) => ({
                parentSelector: r.parentSelector,
                parentRect: expandRect(r.parentRect),
                childRects: r.childRects.map(expandRect),
            })),
        );
    }

    return {
        width: wire.width,
        height: wire.height,
        ...(wire.scrollY !== undefined ? { scrollY: wire.scrollY } : {}),
        elements,
        childRelations,
        timestamp: wire.timestamp,
    };
}

/** Dehydrate a snapshot back to the wire shape (JSON transport of stores). */
export function toWire(snapshot: ViewportSnapshot): ViewportSnapshotWire {
    const trim = (r: Rect): RawRect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    return {
        width: snapshot.width,
        height: snapshot.height,
        ...(snapshot.scrollY !== undefined ? { scrollY: snapshot.scrollY } : {}),
        timestamp: snapshot.timestamp,
        elements: [...snapshot.elements].map(([sel, snaps]) => [
            sel,
            snaps.map((s) => ({
                selector: s.selector,
                index: s.index,
                rect: trim(s.rect),
                styles: s.styles,
                computed: s.computed,
            })),
        ]),
        childRelations: [...snapshot.childRelations].map(([sel, relations]) => [
            sel,
            relations.map((r) => ({
                parentSelector: r.parentSelector,
                parentRect: trim(r.parentRect),
                childRects: r.childRects.map(trim),
            })),
        ]),
    };
}

/** Serialize a SnapshotStore to a JSON-safe object. */
export function storeToJSON(store: SnapshotStore): SerializedStore {
    return {
        widths: [...store.widths],
        selectors: [...store.selectors],
        snapshots: [...store.snapshots].map(([w, snap]) => [w, toWire(snap)]),
    };
}

/** Rebuild a SnapshotStore from its serialized form. */
export function storeFromJSON(json: SerializedStore): SnapshotStore {
    return {
        widths: [...json.widths],
        selectors: [...json.selectors],
        snapshots: new Map(json.snapshots.map(([w, wire]) => [w, fromWire(wire)])),
    };
}

/**
 * Browser-native collector — the ZERO-DRIVER measurement source (RESPONSIVE-STRATEGY §3).
 *
 * Mirrors `core/measurer.ts`'s in-page `page.evaluate` body, but runs directly
 * in a browser (no Playwright). Produces the same `ViewportSnapshot` /
 * `SnapshotStore` that the pure scoring core consumes. Use it in-page (theme
 * builder) or inject via any driver's eval (Playwright `page.evaluate`,
 * agent-browser `eval`, CDP `Runtime.evaluate`).
 */

import type { ElementSnapshot, ViewportSnapshot, ChildRelation, SnapshotStore } from '@responsivejs/core/types';
import { fromDOMRect } from '@responsivejs/core/rect';

export interface CollectOptions {
    /** Scope the query to a subtree (default: `document`). */
    root?: ParentNode;
    /** Override the measured viewport (default: `window.innerWidth`/`Height`). */
    width?: number;
    height?: number;
}

/** Measure all elements matching `selectors` from the LIVE DOM. Browser-only. */
export function collectViewport(selectors: string[], opts: CollectOptions = {}): ViewportSnapshot {
    const root: ParentNode = opts.root ?? document;
    const width = opts.width ?? window.innerWidth;
    const height = opts.height ?? window.innerHeight;

    const elements = new Map<string, ElementSnapshot[]>();
    const childRelations = new Map<string, ChildRelation[]>();

    for (const selector of selectors) {
        root.querySelectorAll(selector).forEach((el, index) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);

            const snap: ElementSnapshot = {
                selector,
                index,
                rect: {
                    x: r.x, y: r.y, width: r.width, height: r.height,
                    right: r.x + r.width, bottom: r.y + r.height,
                    centerX: r.x + r.width / 2, centerY: r.y + r.height / 2,
                    area: r.width * r.height,
                },
                styles: {
                    fontSize: parseFloat(cs.fontSize) || 0,
                    lineHeight: parseFloat(cs.lineHeight) || 0,
                    fontWeight: parseFloat(cs.fontWeight) || 400,
                    gap: parseFloat(cs.gap) || 0,
                    paddingTop: parseFloat(cs.paddingTop) || 0,
                    paddingRight: parseFloat(cs.paddingRight) || 0,
                    paddingBottom: parseFloat(cs.paddingBottom) || 0,
                    paddingLeft: parseFloat(cs.paddingLeft) || 0,
                    marginTop: parseFloat(cs.marginTop) || 0,
                    marginRight: parseFloat(cs.marginRight) || 0,
                    marginBottom: parseFloat(cs.marginBottom) || 0,
                    marginLeft: parseFloat(cs.marginLeft) || 0,
                    borderRadiusTL: parseFloat(cs.borderTopLeftRadius) || 0,
                    borderRadiusTR: parseFloat(cs.borderTopRightRadius) || 0,
                    borderRadiusBR: parseFloat(cs.borderBottomRightRadius) || 0,
                    borderRadiusBL: parseFloat(cs.borderBottomLeftRadius) || 0,
                    minWidth: parseFloat(cs.minWidth) || 0,
                    maxWidth: cs.maxWidth === 'none' ? Infinity : (parseFloat(cs.maxWidth) || 0),
                    minHeight: parseFloat(cs.minHeight) || 0,
                    maxHeight: cs.maxHeight === 'none' ? Infinity : (parseFloat(cs.maxHeight) || 0),
                    zIndex: cs.zIndex === 'auto' ? 0 : (parseInt(cs.zIndex) || 0),
                    opacity: parseFloat(cs.opacity) ?? 1,
                    outlineWidth: parseFloat(cs.outlineWidth) || 0,
                    outlineOffset: parseFloat(cs.outlineOffset) || 0,
                },
                computed: {
                    display: cs.display, overflow: cs.overflow, position: cs.position,
                    visibility: cs.visibility, pointerEvents: cs.pointerEvents,
                    backgroundColor: cs.backgroundColor, color: cs.color,
                    boxSizing: cs.boxSizing, textAlign: cs.textAlign,
                    whiteSpace: cs.whiteSpace, cursor: cs.cursor,
                },
            };
            (elements.get(selector) ?? elements.set(selector, []).get(selector)!).push(snap);

            const childRects = Array.from(el.children).map((c) => fromDOMRect(c.getBoundingClientRect()));
            if (childRects.length > 0) {
                const relation: ChildRelation = { parentSelector: selector, parentRect: snap.rect, childRects };
                (childRelations.get(selector) ?? childRelations.set(selector, []).get(selector)!).push(relation);
            }
        });
    }

    return { width, height, elements, childRelations, timestamp: Date.now() };
}

/** Wrap a single live-DOM measurement into a `SnapshotStore` for the scoring core. */
export function collectStore(selectors: string[], opts: CollectOptions = {}): SnapshotStore {
    const snap = collectViewport(selectors, opts);
    return { snapshots: new Map([[snap.width, snap]]), widths: [snap.width], selectors };
}

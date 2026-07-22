/**
 * Rectangle mathematics on the Cartesian plane.
 * Pure functions — no browser dependency.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
    area: number;
}

/** Create a Rect with derived properties from basic dimensions */
export function rect(x: number, y: number, width: number, height: number): Rect {
    return {
        x, y, width, height,
        right: x + width,
        bottom: y + height,
        centerX: x + width / 2,
        centerY: y + height / 2,
        area: width * height,
    };
}

/** Create a Rect from a DOMRect-like object */
export function fromDOMRect(r: { x: number; y: number; width: number; height: number }): Rect {
    return rect(r.x, r.y, r.width, r.height);
}

/** Is child fully contained within parent? */
export function contains(parent: Rect, child: Rect, tolerance = 1): boolean {
    return child.x >= parent.x - tolerance
        && child.y >= parent.y - tolerance
        && child.right <= parent.right + tolerance
        && child.bottom <= parent.bottom + tolerance;
}

/** Do two rects overlap horizontally (share vertical space = same visual row)? */
export function overlapsVertically(a: Rect, b: Rect): boolean {
    const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    const minH = Math.min(a.height, b.height);
    return minH > 0 && overlap >= minH * 0.5;
}

/** Do two rects overlap at all? */
export function overlaps(a: Rect, b: Rect): boolean {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

/** Euclidean distance between centers */
export function distance(a: Rect, b: Rect): number {
    return Math.sqrt((a.centerX - b.centerX) ** 2 + (a.centerY - b.centerY) ** 2);
}

/** Horizontal gap between two rects (negative if overlapping) */
export function horizontalGap(a: Rect, b: Rect): number {
    if (a.right <= b.x) return b.x - a.right;
    if (b.right <= a.x) return a.x - b.right;
    return -(Math.min(a.right, b.right) - Math.max(a.x, b.x));
}

/** Vertical gap between two rects */
export function verticalGap(a: Rect, b: Rect): number {
    if (a.bottom <= b.y) return b.y - a.bottom;
    if (b.bottom <= a.y) return a.y - b.bottom;
    return -(Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
}

/** Are two rects the same height within tolerance? */
export function sameHeight(a: Rect, b: Rect, tolerance = 2): boolean {
    return Math.abs(a.height - b.height) <= tolerance;
}

/** Are two rects the same width within tolerance? */
export function sameWidth(a: Rect, b: Rect, tolerance = 2): boolean {
    return Math.abs(a.width - b.width) <= tolerance;
}

/** Are two rects left-aligned? */
export function alignedLeft(a: Rect, b: Rect, tolerance = 1): boolean {
    return Math.abs(a.x - b.x) <= tolerance;
}

/** Are two rects top-aligned? */
export function alignedTop(a: Rect, b: Rect, tolerance = 1): boolean {
    return Math.abs(a.y - b.y) <= tolerance;
}

/** Is rect fully within viewport bounds? */
export function inViewport(r: Rect, viewportWidth: number, viewportHeight?: number): boolean {
    if (r.right > viewportWidth + 1) return false;
    if (r.x < -1) return false;
    if (viewportHeight !== undefined) {
        if (r.bottom > viewportHeight + 1) return false;
        if (r.y < -1) return false;
    }
    return true;
}

/** Width ratio between two rects */
export function widthRatio(a: Rect, b: Rect): number {
    return b.width > 0 ? a.width / b.width : Infinity;
}

/**
 * Curve analysis: property values as functions of viewport width.
 * A curve is a Map<viewportWidth, value>.
 * Pure functions — no browser dependency.
 */

export type Curve = Map<number, number>;

/** Get sorted entries from a curve */
export function entries(curve: Curve): [number, number][] {
    return [...curve.entries()].sort((a, b) => a[0] - b[0]);
}

/** Is the curve monotonically non-decreasing? (value never goes down as width increases) */
export function isMonotonicUp(curve: Curve, tolerance = 0.5): boolean {
    const e = entries(curve);
    for (let i = 1; i < e.length; i++) {
        if (e[i][1] < e[i - 1][1] - tolerance) return false;
    }
    return true;
}

/** Is the curve monotonically non-increasing? */
export function isMonotonicDown(curve: Curve, tolerance = 0.5): boolean {
    const e = entries(curve);
    for (let i = 1; i < e.length; i++) {
        if (e[i][1] > e[i - 1][1] + tolerance) return false;
    }
    return true;
}

/** Find the maximum jump (discontinuity) in the curve */
export function maxJump(curve: Curve): { fromWidth: number; toWidth: number; jump: number } {
    const e = entries(curve);
    let result = { fromWidth: 0, toWidth: 0, jump: 0 };
    for (let i = 1; i < e.length; i++) {
        const jump = Math.abs(e[i][1] - e[i - 1][1]);
        if (jump > result.jump) {
            result = { fromWidth: e[i - 1][0], toWidth: e[i][0], jump };
        }
    }
    return result;
}

/** Is the curve continuous? (no jumps larger than maxAllowed) */
export function isContinuous(curve: Curve, maxAllowed: number): boolean {
    return maxJump(curve).jump <= maxAllowed;
}

/** Find all discontinuities (jumps > threshold) */
export function discontinuities(curve: Curve, threshold: number): { fromWidth: number; toWidth: number; jump: number }[] {
    const e = entries(curve);
    const result: { fromWidth: number; toWidth: number; jump: number }[] = [];
    for (let i = 1; i < e.length; i++) {
        const jump = Math.abs(e[i][1] - e[i - 1][1]);
        if (jump > threshold) {
            result.push({ fromWidth: e[i - 1][0], toWidth: e[i][0], jump });
        }
    }
    return result;
}

/** Get the value range of the curve */
export function valueRange(curve: Curve): { min: number; max: number; range: number } {
    const values = [...curve.values()];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max, range: max - min };
}

/** Compute the ratio curve between two curves (a/b at each width) */
export function ratio(a: Curve, b: Curve): Curve {
    const result: Curve = new Map();
    for (const [w, va] of a) {
        const vb = b.get(w);
        if (vb !== undefined && vb > 0) {
            result.set(w, va / vb);
        }
    }
    return result;
}

/** Is the ratio between two curves within bounds at all widths? */
export function ratioInRange(a: Curve, b: Curve, min: number, max: number): boolean {
    const r = ratio(a, b);
    for (const [, v] of r) {
        if (v < min || v > max) return false;
    }
    return true;
}

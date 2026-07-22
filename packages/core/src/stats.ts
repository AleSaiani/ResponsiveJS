/**
 * Statistical functions for layout analysis.
 * Pure functions — no browser dependency.
 */

/** Arithmetic mean */
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Standard deviation (population) */
export function stddev(values: number[]): number {
    if (values.length <= 1) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

/** Coefficient of variation: stddev / mean. Lower = more uniform. */
export function cv(values: number[]): number {
    const m = mean(values);
    if (m === 0) return 0;
    return stddev(values) / m;
}

/** Are values uniform? (cv < threshold) */
export function isUniform(values: number[], threshold = 0.1): boolean {
    return cv(values) <= threshold;
}

/** Compute gaps between consecutive values */
export function gaps(positions: number[]): number[] {
    const sorted = [...positions].sort((a, b) => a - b);
    const result: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        result.push(sorted[i] - sorted[i - 1]);
    }
    return result;
}

/** Min value */
export function min(values: number[]): number {
    return Math.min(...values);
}

/** Max value */
export function max(values: number[]): number {
    return Math.max(...values);
}

/** Range (max - min) */
export function range(values: number[]): number {
    return max(values) - min(values);
}

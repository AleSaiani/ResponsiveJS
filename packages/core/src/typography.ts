/**
 * Typography math — modular scale detection and analysis.
 * Pure math, no DOM dependency.
 */

/** Known typographic scales (musical intervals). */
export const SCALES: Record<string, number> = {
    minorSecond: 1.067,
    majorSecond: 1.125,
    minorThird: 1.200,
    majorThird: 1.250,
    perfectFourth: 1.333,
    augmentedFourth: 1.414,  // sqrt(2)
    perfectFifth: 1.500,
    goldenRatio: 1.618,
};

export interface ScaleResult {
    base: number;
    ratio: number;
    deviation: number;  // average deviation from ideal (lower = better fit)
}

export interface ScaleFit {
    fits: boolean;
    closest: string;
    ratio: number;
    deviation: number;
}

/**
 * Detect the best-fit modular scale for a set of font sizes.
 * Assumes sizes are sorted ascending.
 */
export function detectScale(sizes: number[]): ScaleResult {
    if (sizes.length < 2) return { base: sizes[0] || 16, ratio: 1, deviation: 0 };

    const sorted = [...sizes].sort((a, b) => a - b);
    const base = sorted[0];

    // Compute ratios between consecutive sizes
    const ratios: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1] > 0) {
            ratios.push(sorted[i] / sorted[i - 1]);
        }
    }

    if (ratios.length === 0) return { base, ratio: 1, deviation: 0 };

    // Average ratio
    const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;

    // Compute deviation: how much each size deviates from ideal base * ratio^n
    let totalDeviation = 0;
    for (let i = 0; i < sorted.length; i++) {
        const ideal = base * Math.pow(avgRatio, i);
        totalDeviation += Math.abs(sorted[i] - ideal) / ideal;
    }
    const deviation = totalDeviation / sorted.length;

    return { base, ratio: avgRatio, deviation };
}

/**
 * Check if font sizes follow a known typographic scale.
 * @param tolerance Max average deviation (default 0.05 = 5%)
 */
export function fitsScale(sizes: number[], tolerance = 0.05): ScaleFit {
    if (sizes.length < 2) return { fits: true, closest: 'majorSecond', ratio: 1.125, deviation: 0 };

    const sorted = [...sizes].sort((a, b) => a - b);
    const base = sorted[0];

    let bestName = '';
    let bestDeviation = Infinity;
    let bestRatio = 1;

    for (const [name, scaleRatio] of Object.entries(SCALES)) {
        let totalDev = 0;
        for (let i = 0; i < sorted.length; i++) {
            const ideal = base * Math.pow(scaleRatio, i);
            totalDev += Math.abs(sorted[i] - ideal) / ideal;
        }
        const avgDev = totalDev / sorted.length;

        if (avgDev < bestDeviation) {
            bestDeviation = avgDev;
            bestName = name;
            bestRatio = scaleRatio;
        }
    }

    return {
        fits: bestDeviation <= tolerance,
        closest: bestName,
        ratio: bestRatio,
        deviation: bestDeviation,
    };
}

/** Check if a set of values uses only allowed token values (within tolerance). */
export function usesTokens(values: number[], tokens: number[], tolerance = 1): { valid: boolean; outliers: number[] } {
    const outliers: number[] = [];
    for (const v of values) {
        if (v === 0) continue; // zero is always valid
        const closest = tokens.reduce((best, t) => Math.abs(t - v) < Math.abs(best - v) ? t : best, tokens[0]);
        if (Math.abs(closest - v) > tolerance) {
            outliers.push(v);
        }
    }
    return { valid: outliers.length === 0, outliers };
}

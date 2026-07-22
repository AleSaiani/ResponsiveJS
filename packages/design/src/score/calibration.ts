/**
 * Score calibration — compute optimal metric weights from human ratings.
 * Uses Pearson correlation to find which metrics best predict human scores,
 * then normalizes correlations into weights that sum to 1.
 */

import type { Rect } from '@responsivejs/core/rect';
import type { Viewport } from '@responsivejs/core/aesthetics';
import { score as computeAestheticScore } from '@responsivejs/core/aesthetics';

export interface CalibrationSample {
    rects: Rect[];
    viewport: Viewport;
    humanScore: number; // 0-1
}

export interface CalibrationResult {
    weights: Record<string, number>;
    r2: number; // coefficient of determination (0-1, higher = better fit)
    mse: number; // mean squared error
}

/** Default metric weights (same as aesthetics.ts). Exported for reference. */
export const DEFAULT_WEIGHTS: Record<string, number> = {
    balance: 0.15,
    equilibrium: 0.10,
    symmetry: 0.10,
    proportion: 0.10,
    rhythm: 0.15,
    density: 0.10,
    regularity: 0.10,
    simplicity: 0.05,
    unity: 0.10,
    homogeneity: 0.05,
};

const METRIC_KEYS = [
    'balance', 'equilibrium', 'symmetry', 'proportion', 'rhythm',
    'density', 'regularity', 'simplicity', 'unity', 'homogeneity',
] as const;

type MetricKey = typeof METRIC_KEYS[number];

/**
 * Calibrate metric weights from human-rated samples.
 *
 * Strategy: compute Pearson correlation of each metric with humanScore,
 * take absolute values, clamp negatives to a small epsilon, then normalize
 * so weights sum to 1. This is robust even with small sample sizes and
 * avoids the numerical instability of full OLS matrix inversion for 10x10.
 */
export function calibrate(samples: CalibrationSample[]): CalibrationResult {
    if (samples.length < 2) {
        return { weights: { ...DEFAULT_WEIGHTS }, r2: 0, mse: 0 };
    }

    // Step 1: compute all metric scores for each sample
    const metricMatrix = {} as Record<MetricKey, number[]>;
    for (const key of METRIC_KEYS) {
        metricMatrix[key] = [];
    }
    const humanScores: number[] = [];

    for (const sample of samples) {
        const aestheticScore = computeAestheticScore(sample.rects, sample.viewport);
        for (const key of METRIC_KEYS) {
            metricMatrix[key].push(aestheticScore[key]);
        }
        humanScores.push(sample.humanScore);
    }

    // Step 2: compute Pearson correlation of each metric with humanScore
    const correlations: Record<string, number> = {};
    for (const key of METRIC_KEYS) {
        correlations[key] = pearsonCorrelation(metricMatrix[key], humanScores);
    }

    // Step 3: use absolute correlations as raw weights, with minimum epsilon
    const epsilon = 0.01;
    const rawWeights: Record<string, number> = {};
    let totalRaw = 0;
    for (const key of METRIC_KEYS) {
        const raw = Math.max(Math.abs(correlations[key]), epsilon);
        rawWeights[key] = raw;
        totalRaw += raw;
    }

    // Step 4: normalize to sum to 1
    const weights: Record<string, number> = {};
    for (const key of METRIC_KEYS) {
        weights[key] = rawWeights[key] / totalRaw;
    }

    // Step 5: compute predicted scores with calibrated weights, then R2 and MSE
    const predicted: number[] = [];
    for (let i = 0; i < samples.length; i++) {
        let p = 0;
        for (const key of METRIC_KEYS) {
            p += metricMatrix[key][i] * weights[key];
        }
        predicted.push(p);
    }

    const mse = meanSquaredError(predicted, humanScores);
    const r2 = rSquared(predicted, humanScores);

    return { weights, r2, mse };
}

/** Pearson correlation coefficient between two equal-length arrays. */
function pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((s, v) => s + v, 0) / n;
    const meanY = y.reduce((s, v) => s + v, 0) / n;

    let covXY = 0;
    let varX = 0;
    let varY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        covXY += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
    }

    const denom = Math.sqrt(varX * varY);
    if (denom === 0) return 0;

    return covXY / denom;
}

/** Mean squared error between predicted and actual. */
function meanSquaredError(predicted: number[], actual: number[]): number {
    let sum = 0;
    for (let i = 0; i < predicted.length; i++) {
        sum += (predicted[i] - actual[i]) ** 2;
    }
    return sum / predicted.length;
}

/** Coefficient of determination R^2. */
function rSquared(predicted: number[], actual: number[]): number {
    const meanActual = actual.reduce((s, v) => s + v, 0) / actual.length;

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < actual.length; i++) {
        ssRes += (actual[i] - predicted[i]) ** 2;
        ssTot += (actual[i] - meanActual) ** 2;
    }

    if (ssTot === 0) return 1; // all actual values identical = perfect prediction
    return 1 - ssRes / ssTot;
}

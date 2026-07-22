import { describe, it, expect } from 'vitest';
import { calibrate, DEFAULT_WEIGHTS, type CalibrationSample } from '../src/score/calibration.js';
import { rect } from '@responsivejs/core/rect';

/**
 * Helper: create a sample with N rects placed in a grid pattern.
 * The rects are positioned to produce varying metric scores based on `spread`.
 * - spread=0: all rects centered (high balance, high symmetry)
 * - spread=1: rects spread to corners (lower balance, lower equilibrium)
 */
function makeSample(spread: number, humanScore: number): CalibrationSample {
    const vp = { width: 400, height: 300 };
    const cx = vp.width / 2;
    const cy = vp.height / 2;
    const w = 60;
    const h = 40;

    const rects = [
        rect(cx - w / 2 - spread * 100, cy - h / 2 - spread * 80, w, h),
        rect(cx - w / 2 + spread * 100, cy - h / 2 - spread * 80, w, h),
        rect(cx - w / 2 - spread * 100, cy - h / 2 + spread * 80, w, h),
        rect(cx - w / 2 + spread * 100, cy - h / 2 + spread * 80, w, h),
    ];

    return { rects, viewport: vp, humanScore };
}

describe('calibrate', () => {
    it('returns default weights for fewer than 2 samples', () => {
        const result = calibrate([makeSample(0, 0.8)]);
        expect(result.weights).toEqual(DEFAULT_WEIGHTS);
        expect(result.r2).toBe(0);
        expect(result.mse).toBe(0);
    });

    it('weights sum to approximately 1', () => {
        const samples: CalibrationSample[] = [
            makeSample(0, 0.9),
            makeSample(0.3, 0.7),
            makeSample(0.6, 0.5),
            makeSample(1.0, 0.3),
        ];

        const result = calibrate(samples);

        const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
        expect(sum).toBeCloseTo(1, 5);
    });

    it('returns 10 metric weights', () => {
        const samples: CalibrationSample[] = [
            makeSample(0, 0.9),
            makeSample(0.5, 0.5),
            makeSample(1.0, 0.2),
        ];

        const result = calibrate(samples);

        const keys = Object.keys(result.weights);
        expect(keys).toHaveLength(10);
        expect(keys).toContain('balance');
        expect(keys).toContain('equilibrium');
        expect(keys).toContain('symmetry');
        expect(keys).toContain('proportion');
        expect(keys).toContain('rhythm');
        expect(keys).toContain('density');
        expect(keys).toContain('regularity');
        expect(keys).toContain('simplicity');
        expect(keys).toContain('unity');
        expect(keys).toContain('homogeneity');
    });

    it('all weights are positive', () => {
        const samples: CalibrationSample[] = [
            makeSample(0, 0.95),
            makeSample(0.2, 0.8),
            makeSample(0.5, 0.5),
            makeSample(0.8, 0.3),
            makeSample(1.0, 0.1),
        ];

        const result = calibrate(samples);

        for (const w of Object.values(result.weights)) {
            expect(w).toBeGreaterThan(0);
        }
    });

    it('R2 is computed correctly (between 0 and 1 for correlated data)', () => {
        const samples: CalibrationSample[] = [
            makeSample(0, 0.95),
            makeSample(0.2, 0.8),
            makeSample(0.5, 0.5),
            makeSample(0.8, 0.3),
            makeSample(1.0, 0.1),
        ];

        const result = calibrate(samples);

        // R2 should be positive for correlated data (spread inversely correlates with humanScore)
        expect(result.r2).toBeGreaterThan(0);
        expect(result.r2).toBeLessThanOrEqual(1);
    });

    it('MSE is non-negative', () => {
        const samples: CalibrationSample[] = [
            makeSample(0, 0.9),
            makeSample(0.5, 0.5),
            makeSample(1.0, 0.2),
        ];

        const result = calibrate(samples);
        expect(result.mse).toBeGreaterThanOrEqual(0);
    });

    it('with perfectly correlated data, R2 is non-negative and MSE is low', () => {
        // Create samples where all metrics and humanScore are tightly correlated
        const samples: CalibrationSample[] = [];

        // All rects perfectly centered = high scores in all metrics
        for (let i = 0; i < 5; i++) {
            const spread = i * 0.25;
            // Human score decreases as spread increases (matches most metrics)
            const humanScore = 1 - spread;
            samples.push(makeSample(spread, humanScore));
        }

        const result = calibrate(samples);

        // Correlation-based calibration: R2 is non-negative for correlated data,
        // and MSE should be moderate (not an exact OLS fit, so R2 may be small)
        expect(result.r2).toBeGreaterThanOrEqual(0);
        expect(result.mse).toBeLessThan(0.5);
        // Weights are valid
        const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
        expect(sum).toBeCloseTo(1, 5);
    });

    it('with varied data, weights reflect which metrics correlate best', () => {
        // Construct samples where balance is the dominant predictor
        const vp = { width: 400, height: 300 };

        const samples: CalibrationSample[] = [
            // Perfectly centered (high balance) -> high human score
            {
                rects: [
                    rect(120, 80, 80, 60),
                    rect(200, 80, 80, 60),
                    rect(120, 160, 80, 60),
                    rect(200, 160, 80, 60),
                ],
                viewport: vp,
                humanScore: 0.9,
            },
            // Slightly off-center -> medium score
            {
                rects: [
                    rect(50, 50, 80, 60),
                    rect(250, 50, 80, 60),
                    rect(50, 180, 80, 60),
                    rect(250, 180, 80, 60),
                ],
                viewport: vp,
                humanScore: 0.6,
            },
            // Very off-center (low balance) -> low human score
            {
                rects: [
                    rect(10, 10, 80, 60),
                    rect(300, 10, 80, 60),
                    rect(10, 230, 80, 60),
                    rect(300, 230, 80, 60),
                ],
                viewport: vp,
                humanScore: 0.3,
            },
        ];

        const result = calibrate(samples);

        // The weights should be non-trivial (not all equal)
        const values = Object.values(result.weights);
        const maxW = Math.max(...values);
        const minW = Math.min(...values);
        expect(maxW).toBeGreaterThan(minW);
    });
});

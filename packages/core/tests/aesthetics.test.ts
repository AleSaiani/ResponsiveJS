import { describe, it, expect } from 'vitest';
import {
    balance, equilibrium, symmetry, proportion, rhythm,
    density, regularity, simplicity, unity, homogeneity,
    sequence, cohesion, economy, colorHarmony, typographyHarmony,
    birkhoff, score,
} from '../src/aesthetics.js';
import { rect } from '../src/rect.js';

const vp = { width: 1280, height: 900 };

// Helper: create a Rect
function r(x: number, y: number, w: number, h: number) {
    return rect(x, y, w, h);
}

describe('balance', () => {
    it('scores 1 for perfectly centered single element', () => {
        const rects = [r(540, 350, 200, 200)]; // centered in 1280x900
        expect(balance(rects, vp)).toBeGreaterThan(0.9);
    });

    it('scores 1 for symmetric pair', () => {
        const rects = [r(100, 400, 200, 100), r(980, 400, 200, 100)];
        expect(balance(rects, vp)).toBeGreaterThan(0.9);
    });

    it('scores low for all-left elements', () => {
        const rects = [r(10, 10, 100, 100), r(10, 200, 100, 100)];
        expect(balance(rects, vp)).toBeLessThan(0.5);
    });

    it('returns 1 for empty', () => {
        expect(balance([], vp)).toBe(1);
    });
});

describe('equilibrium', () => {
    it('scores high for centered mass', () => {
        const rects = [r(540, 350, 200, 200)];
        expect(equilibrium(rects, vp)).toBeGreaterThan(0.9);
    });

    it('scores low for corner-heavy layout', () => {
        const rects = [r(0, 0, 50, 50)];
        expect(equilibrium(rects, vp)).toBeLessThan(0.5);
    });
});

describe('symmetry', () => {
    it('scores high for mirror layout', () => {
        const rects = [r(100, 400, 200, 100), r(980, 400, 200, 100)];
        expect(symmetry(rects, vp)).toBeGreaterThan(0.7);
    });

    it('scores lower for asymmetric layout', () => {
        const rects = [r(50, 50, 100, 100), r(800, 600, 300, 200)];
        expect(symmetry(rects, vp)).toBeLessThan(0.8);
    });

    it('returns 1 for single element', () => {
        expect(symmetry([r(100, 100, 50, 50)], vp)).toBe(1);
    });
});

describe('proportion', () => {
    it('scores high for square elements (1:1)', () => {
        const rects = [r(0, 0, 100, 100), r(200, 0, 100, 100)];
        expect(proportion(rects)).toBeGreaterThan(0.9);
    });

    it('scores high for golden ratio element', () => {
        const phi = (1 + Math.sqrt(5)) / 2;
        const rects = [r(0, 0, 100 * phi, 100)];
        expect(proportion(rects)).toBeGreaterThan(0.9);
    });

    it('scores lower for extreme aspect ratio', () => {
        const rects = [r(0, 0, 1000, 10)]; // 100:1 ratio
        expect(proportion(rects)).toBeLessThan(0.3);
    });
});

describe('rhythm', () => {
    it('scores high for uniform spacing', () => {
        const rects = [
            r(0, 0, 100, 50),
            r(0, 70, 100, 50),   // gap 20
            r(0, 140, 100, 50),  // gap 20
            r(0, 210, 100, 50),  // gap 20
        ];
        expect(rhythm(rects)).toBeGreaterThan(0.9);
    });

    it('scores low for chaotic spacing', () => {
        const rects = [
            r(0, 0, 100, 50),
            r(0, 55, 100, 50),    // gap 5
            r(0, 200, 100, 50),   // gap 95
            r(0, 260, 100, 50),   // gap 10
        ];
        expect(rhythm(rects)).toBeLessThan(0.5);
    });
});

describe('density', () => {
    it('scores highest around 50% fill', () => {
        // ~50% of 1280*900 = 576000
        const rects = [r(0, 0, 800, 700)]; // 560000 area ≈ 49%
        expect(density(rects, vp)).toBeGreaterThan(0.9);
    });

    it('scores low for sparse layout', () => {
        const rects = [r(0, 0, 50, 50)]; // tiny
        expect(density(rects, vp)).toBeLessThan(0.2);
    });

    it('scores low for completely full layout', () => {
        const rects = [r(0, 0, 1280, 900)]; // 100%
        expect(density(rects, vp)).toBeLessThan(0.3);
    });
});

describe('regularity', () => {
    it('scores high for aligned elements', () => {
        const rects = [
            r(100, 0, 200, 50),
            r(100, 100, 200, 50),
            r(100, 200, 200, 50),
        ]; // all same x, same width
        expect(regularity(rects)).toBeGreaterThan(0.6);
    });

    it('scores lower for misaligned elements', () => {
        const rects = [
            r(10, 5, 200, 50),
            r(120, 100, 180, 60),
            r(230, 210, 150, 40),
        ];
        expect(regularity(rects)).toBeLessThan(0.5);
    });
});

describe('simplicity', () => {
    it('scores high for same-size elements', () => {
        const rects = [r(0, 0, 100, 50), r(200, 0, 100, 50), r(400, 0, 100, 50)];
        expect(simplicity(rects)).toBeGreaterThan(0.8);
    });

    it('scores lower for varied sizes', () => {
        const rects = [r(0, 0, 50, 30), r(100, 0, 200, 100), r(400, 0, 80, 60)];
        expect(simplicity(rects)).toBeLessThan(0.6);
    });
});

describe('unity', () => {
    it('scores high for tightly packed elements', () => {
        const rects = [r(100, 100, 100, 100), r(200, 100, 100, 100)];
        expect(unity(rects, vp)).toBeGreaterThan(0.8);
    });

    it('scores lower for scattered elements', () => {
        const rects = [r(0, 0, 50, 50), r(1000, 800, 50, 50)];
        expect(unity(rects, vp)).toBeLessThan(0.1);
    });
});

describe('homogeneity', () => {
    it('scores high for evenly distributed elements', () => {
        const rects = [
            r(200, 200, 50, 50),   // TL
            r(900, 200, 50, 50),   // TR
            r(200, 600, 50, 50),   // BL
            r(900, 600, 50, 50),   // BR
        ];
        expect(homogeneity(rects, vp)).toBeGreaterThan(0.9);
    });

    it('scores low for all in one quadrant', () => {
        const rects = [
            r(10, 10, 50, 50),
            r(70, 10, 50, 50),
            r(10, 70, 50, 50),
            r(70, 70, 50, 50),
        ]; // all in TL
        expect(homogeneity(rects, vp)).toBeLessThan(0.3);
    });
});

describe('sequence', () => {
    it('scores high for top-to-bottom flow', () => {
        const rects = [
            r(100, 0, 400, 100),   // biggest → top
            r(100, 120, 300, 80),  // medium → middle
            r(100, 220, 200, 60),  // smallest → bottom
        ];
        expect(sequence(rects)).toBeGreaterThan(0.5);
    });

    it('returns 1 for single element', () => {
        expect(sequence([r(0, 0, 100, 100)])).toBe(1);
    });
});

describe('cohesion', () => {
    it('scores high for tightly clustered same-size elements', () => {
        const rects = [
            r(100, 100, 100, 100),
            r(210, 100, 100, 100),
            r(100, 210, 100, 100),
            r(210, 210, 100, 100),
        ];
        expect(cohesion(rects)).toBeGreaterThan(0.5);
    });

    it('scores lower for scattered different-size elements', () => {
        // Different sizes → no groups → returns 1 (no clustering to measure)
        // Use same-size but far apart with a third element to force a group
        const rects = [
            r(0, 0, 100, 100),
            r(1000, 800, 100, 100),
            r(500, 400, 100, 100), // third to form group
        ];
        const s = cohesion(rects);
        expect(s).toBeLessThan(0.8);
    });
});

describe('economy', () => {
    it('scores high for moderate element count (~10)', () => {
        const rects = Array.from({ length: 10 }, (_, i) =>
            r(100, i * 80, 200, 60)
        );
        expect(economy(rects, vp)).toBeGreaterThan(0.8);
    });

    it('scores low for too many tiny elements', () => {
        const rects = Array.from({ length: 50 }, (_, i) =>
            r((i % 10) * 12, Math.floor(i / 10) * 12, 10, 10)
        );
        expect(economy(rects, vp)).toBeLessThan(0.4);
    });

    it('scores low for empty layout', () => {
        expect(economy([], vp)).toBe(0);
    });
});

describe('colorHarmony', () => {
    it('scores high for monochrome palette', () => {
        expect(colorHarmony(['rgb(100, 100, 100)', 'rgb(150, 150, 150)'])).toBe(1);
    });

    it('scores high for complementary colors', () => {
        // Red and cyan (approximately complementary)
        const s = colorHarmony(['rgb(255, 0, 0)', 'rgb(0, 255, 255)']);
        expect(s).toBeGreaterThan(0.5);
    });

    it('returns 1 for single color', () => {
        expect(colorHarmony(['rgb(255, 0, 0)'])).toBe(1);
    });

    it('returns 1 for empty input', () => {
        expect(colorHarmony([])).toBe(1);
    });
});

describe('typographyHarmony', () => {
    it('scores high for perfect modular scale', () => {
        const base = 16;
        const ratio = 1.25;
        const sizes = [base, base * ratio, base * ratio ** 2, base * ratio ** 3];
        expect(typographyHarmony(sizes)).toBeGreaterThan(0.9);
    });

    it('scores low for random sizes', () => {
        expect(typographyHarmony([8, 13, 29, 47, 11])).toBeLessThan(0.6);
    });

    it('returns 1 for single size', () => {
        expect(typographyHarmony([16])).toBe(1);
    });
});

describe('birkhoff', () => {
    it('returns a value between 0 and 1', () => {
        const rects = [r(100, 100, 200, 100), r(980, 100, 200, 100)];
        const m = birkhoff(rects, vp);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(1);
    });
});

describe('score (overall)', () => {
    it('returns all metrics', () => {
        const rects = [r(100, 100, 200, 100), r(500, 300, 300, 200)];
        const s = score(rects, vp);

        expect(s.balance).toBeDefined();
        expect(s.equilibrium).toBeDefined();
        expect(s.symmetry).toBeDefined();
        expect(s.proportion).toBeDefined();
        expect(s.rhythm).toBeDefined();
        expect(s.density).toBeDefined();
        expect(s.regularity).toBeDefined();
        expect(s.simplicity).toBeDefined();
        expect(s.unity).toBeDefined();
        expect(s.homogeneity).toBeDefined();
        expect(s.sequence).toBeDefined();
        expect(s.cohesion).toBeDefined();
        expect(s.economy).toBeDefined();
        expect(s.colorHarmony).toBeDefined();
        expect(s.typographyHarmony).toBeDefined();
        expect(s.birkhoff).toBeDefined();
        expect(s.overall).toBeDefined();
    });

    it('overall is weighted average in 0-1 range', () => {
        const rects = [r(100, 100, 200, 100), r(500, 300, 300, 200)];
        const s = score(rects, vp);

        expect(s.overall).toBeGreaterThanOrEqual(0);
        expect(s.overall).toBeLessThanOrEqual(1);
    });

    it('well-designed layout scores higher than chaotic', () => {
        // Centered, aligned, consistent
        const good = [
            r(340, 100, 600, 80),
            r(340, 200, 600, 300),
            r(340, 520, 600, 80),
        ];

        // Scattered, misaligned
        const bad = [
            r(5, 3, 47, 800),
            r(1200, 850, 70, 12),
            r(600, 400, 10, 10),
        ];

        const goodScore = score(good, vp).overall;
        const badScore = score(bad, vp).overall;

        expect(goodScore).toBeGreaterThan(badScore);
    });
});

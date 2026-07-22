/**
 * Aesthetic metrics — Ngo, Teo, Byrne (2003) + Birkhoff (1933).
 * Pure math on Rect arrays. No DOM dependency.
 *
 * Each metric returns a score 0–1 where 1 = maximum aesthetic quality.
 * Reference: "Modelling interface aesthetics" (Ngo et al., 2003)
 */

import type { Rect } from './rect.js';

export interface Viewport {
    width: number;
    height: number;
}

/** Weighted area of an element (visual weight proxy). */
function weight(r: Rect): number {
    return r.area;
}

// ─── 1. Balance (BM) ───────────────────────────────────────────────────

/** Measures how evenly visual weight is distributed around the center.
 *  1 = perfectly balanced, 0 = all weight on one side. */
export function balance(rects: Rect[], vp: Viewport): number {
    if (rects.length === 0) return 1;

    const cx = vp.width / 2;
    const cy = vp.height / 2;

    let leftW = 0, rightW = 0, topW = 0, bottomW = 0;

    for (const r of rects) {
        const w = weight(r);
        // Continuous split: proportion of element on each side of center
        const hLeftFrac = Math.max(0, Math.min(cx - r.x, r.width)) / (r.width || 1);
        const hRightFrac = 1 - hLeftFrac;
        leftW += w * hLeftFrac;
        rightW += w * hRightFrac;

        const vTopFrac = Math.max(0, Math.min(cy - r.y, r.height)) / (r.height || 1);
        const vBottomFrac = 1 - vTopFrac;
        topW += w * vTopFrac;
        bottomW += w * vBottomFrac;
    }

    const hTotal = leftW + rightW;
    const vTotal = topW + bottomW;
    if (hTotal === 0 && vTotal === 0) return 1;

    const hBalance = hTotal > 0 ? 1 - Math.abs(leftW - rightW) / hTotal : 1;
    const vBalance = vTotal > 0 ? 1 - Math.abs(topW - bottomW) / vTotal : 1;

    return (hBalance + vBalance) / 2;
}

// ─── 2. Equilibrium (EM) ────────────────────────────────────────────────

/** Measures how close the center of mass is to the frame center.
 *  1 = centered, 0 = at the edge. */
export function equilibrium(rects: Rect[], vp: Viewport): number {
    if (rects.length === 0) return 1;

    let totalW = 0, wCx = 0, wCy = 0;
    for (const r of rects) {
        const w = weight(r);
        totalW += w;
        wCx += r.centerX * w;
        wCy += r.centerY * w;
    }

    if (totalW === 0) return 1;

    const massCx = wCx / totalW;
    const massCy = wCy / totalW;

    const maxDist = Math.sqrt((vp.width / 2) ** 2 + (vp.height / 2) ** 2);
    const dist = Math.sqrt((massCx - vp.width / 2) ** 2 + (massCy - vp.height / 2) ** 2);

    return 1 - Math.min(dist / maxDist, 1);
}

// ─── 3. Symmetry (SYM) ─────────────────────────────────────────────────

/** Measures vertical + horizontal symmetry.
 *  For each element, finds nearest mirror across axis; closer = more symmetric. */
export function symmetry(rects: Rect[], vp: Viewport): number {
    if (rects.length <= 1) return 1;

    const vSym = axisMirrorScore(rects, vp.width / 2, 'vertical', vp.width);
    const hSym = axisMirrorScore(rects, vp.height / 2, 'horizontal', vp.height);

    return (vSym + hSym) / 2;
}

function axisMirrorScore(rects: Rect[], axis: number, dir: 'vertical' | 'horizontal', maxDim: number): number {
    let totalScore = 0;

    for (const r of rects) {
        const pos = dir === 'vertical' ? r.centerX : r.centerY;
        const mirrored = 2 * axis - pos;

        // Find nearest element to the mirrored position
        let minDist = maxDim;
        for (const other of rects) {
            if (other === r) continue;
            const otherPos = dir === 'vertical' ? other.centerX : other.centerY;
            const dist = Math.abs(otherPos - mirrored);
            if (dist < minDist) minDist = dist;
        }

        totalScore += 1 - Math.min(minDist / (maxDim / 2), 1);
    }

    return totalScore / rects.length;
}

// ─── 4. Proportion (PM) ────────────────────────────────────────────────

/** Measures how close element aspect ratios are to harmonic references.
 *  References: 1:1, 1:√2, 1:φ, 1:√3, 1:2. */
const HARMONIC_RATIOS = [1, Math.SQRT2, (1 + Math.sqrt(5)) / 2, Math.sqrt(3), 2];

export function proportion(rects: Rect[]): number {
    if (rects.length === 0) return 1;

    let totalScore = 0;
    for (const r of rects) {
        if (r.width === 0 || r.height === 0) continue;
        const ratio = Math.max(r.width, r.height) / Math.min(r.width, r.height);

        // Distance to nearest harmonic ratio
        let minDist = Infinity;
        for (const hr of HARMONIC_RATIOS) {
            minDist = Math.min(minDist, Math.abs(ratio - hr));
        }
        // Normalize: 0 distance = 1 score, distance > 1 = 0 score
        totalScore += Math.max(0, 1 - minDist);
    }

    return totalScore / rects.length;
}

// ─── 5. Rhythm (RHM) ───────────────────────────────────────────────────

/** Measures uniformity of gaps between consecutive elements.
 *  1 = perfectly uniform spacing, 0 = chaotic. */
export function rhythm(rects: Rect[]): number {
    if (rects.length < 3) return 1;

    // Sort by Y then X (reading order)
    const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);

    // Compute vertical gaps between consecutive elements
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].y - sorted[i - 1].bottom;
        if (gap > 0) gaps.push(gap);
    }

    if (gaps.length < 2) return 1;

    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (mean === 0) return 1;
    const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
    const cv = Math.sqrt(variance) / mean;

    // cv = 0 → perfectly uniform → score 1. cv >= 1 → score 0
    return Math.max(0, 1 - cv);
}

// ─── 6. Density (DM) ───────────────────────────────────────────────────

/** Measures how much of the viewport is occupied by elements.
 *  Optimal density is ~0.5; both extremes (empty/cramped) score low. */
export function density(rects: Rect[], vp: Viewport): number {
    if (rects.length === 0) return 0;

    const totalArea = rects.reduce((s, r) => s + r.area, 0);
    const vpArea = vp.width * vp.height;
    if (vpArea === 0) return 0;

    const d = totalArea / vpArea;
    // Bell curve centered at 0.5: score = 1 - 4*(d-0.5)^2, clamped to [0,1]
    return Math.max(0, 1 - 4 * (d - 0.5) ** 2);
}

// ─── 7. Regularity (RM) ────────────────────────────────────────────────

/** Measures alignment consistency — how many distinct alignment axes elements share.
 *  Fewer = more regular. */
export function regularity(rects: Rect[]): number {
    if (rects.length <= 1) return 1;

    const tolerance = 2; // px
    const leftEdges = uniqueValues(rects.map(r => r.x), tolerance);
    const topEdges = uniqueValues(rects.map(r => r.y), tolerance);
    const rightEdges = uniqueValues(rects.map(r => r.right), tolerance);

    const totalAxes = leftEdges + topEdges + rightEdges;
    // Minimum possible axes = 1 each = 3. Max = rects.length * 3.
    const maxAxes = rects.length * 3;
    const minAxes = 3;

    if (maxAxes <= minAxes) return 1;
    return 1 - (totalAxes - minAxes) / (maxAxes - minAxes);
}

function uniqueValues(values: number[], tolerance: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > tolerance) count++;
    }
    return count;
}

// ─── 8. Simplicity (SMM) ───────────────────────────────────────────────

/** Measures simplicity — fewer distinct element sizes = simpler.
 *  1 = all same size, 0 = all different sizes. */
export function simplicity(rects: Rect[]): number {
    if (rects.length <= 1) return 1;

    const tolerance = 5; // px for width/height grouping
    const distinctWidths = uniqueValues(rects.map(r => r.width), tolerance);
    const distinctHeights = uniqueValues(rects.map(r => r.height), tolerance);

    const totalDistinct = distinctWidths + distinctHeights;
    const maxDistinct = rects.length * 2;
    const minDistinct = 2;

    if (maxDistinct <= minDistinct) return 1;
    return 1 - (totalDistinct - minDistinct) / (maxDistinct - minDistinct);
}

// ─── 9. Unity (UM) ─────────────────────────────────────────────────────

/** Measures unity — elements form a cohesive group.
 *  Based on how tightly elements are clustered relative to viewport. */
export function unity(rects: Rect[], _vp: Viewport): number {
    if (rects.length <= 1) return 1;

    // Bounding box of all elements
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.right));
    const maxY = Math.max(...rects.map(r => r.bottom));

    const groupArea = (maxX - minX) * (maxY - minY);
    const elementArea = rects.reduce((s, r) => s + r.area, 0);

    if (groupArea === 0) return 1;

    // Unity = element area / group bounding box area
    // Higher means elements are tightly packed
    const packing = Math.min(elementArea / groupArea, 1);

    return packing;
}

// ─── 10. Homogeneity (HM) ──────────────────────────────────────────────

/** Measures how uniformly elements are distributed across the viewport.
 *  Divides viewport into quadrants and measures element count variance. */
export function homogeneity(rects: Rect[], vp: Viewport): number {
    if (rects.length <= 1) return 1;

    const cx = vp.width / 2;
    const cy = vp.height / 2;

    const quadrants = [0, 0, 0, 0]; // TL, TR, BL, BR
    for (const r of rects) {
        const qi = (r.centerX >= cx ? 1 : 0) + (r.centerY >= cy ? 2 : 0);
        quadrants[qi]++;
    }

    const mean = rects.length / 4;
    if (mean === 0) return 1;
    const variance = quadrants.reduce((s, q) => s + (q - mean) ** 2, 0) / 4;
    const cv = Math.sqrt(variance) / mean;

    return Math.max(0, 1 - cv);
}

// ─── 11. Sequence (SQM) ─────────────────────────────────────────────────

/** Measures how well the layout follows natural reading order (top-left → bottom-right).
 *  Elements should flow top-to-bottom, left-to-right (Z/F-pattern).
 *  1 = perfect reading flow, 0 = chaotic order. */
export function sequence(rects: Rect[]): number {
    if (rects.length <= 1) return 1;

    // Sort by visual weight (larger = more important = should come first in reading order)
    const byWeight = [...rects].sort((a, b) => b.area - a.area);

    // Sort by reading order (top-to-bottom, left-to-right)
    const byReading = [...rects].sort((a, b) => {
        const rowA = Math.floor(a.y / 50); // group into ~50px rows
        const rowB = Math.floor(b.y / 50);
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
    });

    // Measure how well weight order matches reading order
    // Kendall tau-like: count concordant pairs
    let concordant = 0;
    let total = 0;
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const weightOrder = byWeight.indexOf(rects[i]) - byWeight.indexOf(rects[j]);
            const readOrder = byReading.indexOf(rects[i]) - byReading.indexOf(rects[j]);
            if ((weightOrder > 0 && readOrder > 0) || (weightOrder < 0 && readOrder < 0) || weightOrder === 0) {
                concordant++;
            }
            total++;
        }
    }

    return total > 0 ? concordant / total : 1;
}

// ─── 12. Cohesion (CM) ─────────────────────────────────────────────────

/** Measures spatial clustering — similar-sized elements should be near each other.
 *  Groups by size similarity, then checks if groups are spatially clustered.
 *  1 = well-clustered, 0 = scattered randomly. */
export function cohesion(rects: Rect[]): number {
    if (rects.length <= 2) return 1;

    // Group elements by similar area (within 30% tolerance)
    const groups: Rect[][] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < rects.length; i++) {
        if (assigned.has(i)) continue;
        const group = [rects[i]];
        assigned.add(i);

        for (let j = i + 1; j < rects.length; j++) {
            if (assigned.has(j)) continue;
            const ratio = Math.min(rects[i].area, rects[j].area) / (Math.max(rects[i].area, rects[j].area) || 1);
            if (ratio > 0.7) { // similar size
                group.push(rects[j]);
                assigned.add(j);
            }
        }
        if (group.length > 1) groups.push(group);
    }

    if (groups.length === 0) return 1;

    // For each group, measure compactness: average distance between members / max possible distance
    let totalCompactness = 0;
    for (const group of groups) {
        let totalDist = 0;
        let pairs = 0;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const dx = group[i].centerX - group[j].centerX;
                const dy = group[i].centerY - group[j].centerY;
                totalDist += Math.sqrt(dx * dx + dy * dy);
                pairs++;
            }
        }
        if (pairs === 0) continue;
        const avgDist = totalDist / pairs;
        // Normalize: avg distance relative to max possible (diagonal of bounding box of all rects)
        const allMinX = Math.min(...rects.map(r => r.x));
        const allMaxX = Math.max(...rects.map(r => r.right));
        const allMinY = Math.min(...rects.map(r => r.y));
        const allMaxY = Math.max(...rects.map(r => r.bottom));
        const maxDist = Math.sqrt((allMaxX - allMinX) ** 2 + (allMaxY - allMinY) ** 2) || 1;
        totalCompactness += 1 - Math.min(avgDist / maxDist, 1);
    }

    return totalCompactness / groups.length;
}

// ─── 13. Economy (ECM) ──────────────────────────────────────────────────

/** Measures visual economy — fewest elements for the information density.
 *  Penalizes layouts with many tiny elements that could be consolidated.
 *  Optimal: moderate element count (5-15 for a typical screen).
 *  1 = optimal economy, 0 = too many or too few elements. */
export function economy(rects: Rect[], vp: Viewport): number {
    if (rects.length === 0) return 0;

    // Optimal element density: 5-15 major elements per viewport
    const count = rects.length;

    // Bell curve centered at 10: score = 1 at 10, decays toward 0/50+
    const optimal = 10;
    const sigma = 8;
    const countScore = Math.exp(-((count - optimal) ** 2) / (2 * sigma ** 2));

    // Penalize if many elements are tiny (area < 1% of viewport)
    const vpArea = vp.width * vp.height;
    const tinyCount = rects.filter(r => r.area < vpArea * 0.01).length;
    const tinyPenalty = count > 0 ? 1 - (tinyCount / count) * 0.5 : 1;

    return countScore * tinyPenalty;
}

// ─── 14. Color Harmony (CHM) ────────────────────────────────────────────

/** Measures color harmony from background colors of elements.
 *  Input: array of CSS color strings (from computed backgroundColor).
 *  Groups colors by hue and checks if they follow harmonic relationships
 *  (complementary, analogous, triadic, split-complementary).
 *  1 = harmonious palette, 0 = random colors. */
export function colorHarmony(colors: string[]): number {
    // Parse colors and extract hues
    const hues: number[] = [];
    for (const c of colors) {
        const rgb = parseColorSimple(c);
        if (!rgb || (rgb.r === 0 && rgb.g === 0 && rgb.b === 0)) continue; // skip black/transparent
        if (rgb.r === rgb.g && rgb.g === rgb.b) continue; // skip grays
        const hue = rgbToHue(rgb.r, rgb.g, rgb.b);
        if (hue >= 0) hues.push(hue);
    }

    if (hues.length <= 1) return 1; // monochrome = harmonious

    // Get unique hues (within 15° tolerance)
    const uniqueHues = clusterHues(hues, 15);
    if (uniqueHues.length <= 1) return 1;

    // Score based on harmonic relationships between unique hues
    return harmonicScore(uniqueHues);
}

function parseColorSimple(css: string): { r: number; g: number; b: number } | null {
    const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) return { r: parseFloat(m[1]) / 255, g: parseFloat(m[2]) / 255, b: parseFloat(m[3]) / 255 };
    return null;
}

function rgbToHue(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return -1; // achromatic

    let h: number;
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    return h * 60; // degrees
}

function clusterHues(hues: number[], tolerance: number): number[] {
    const sorted = [...hues].sort((a, b) => a - b);
    const clusters: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const dist = Math.min(
            Math.abs(sorted[i] - clusters[clusters.length - 1]),
            360 - Math.abs(sorted[i] - clusters[clusters.length - 1])
        );
        if (dist > tolerance) clusters.push(sorted[i]);
    }
    return clusters;
}

function harmonicScore(hues: number[]): number {
    // Check against harmonic patterns
    const patterns = [
        { name: 'complementary', angles: [180], tolerance: 30 },
        { name: 'analogous', angles: [30], tolerance: 15 },
        { name: 'triadic', angles: [120, 240], tolerance: 30 },
        { name: 'split-complementary', angles: [150, 210], tolerance: 30 },
    ];

    let bestScore = 0;
    const baseHue = hues[0];
    const otherHues = hues.slice(1);

    for (const pattern of patterns) {
        let matchCount = 0;
        for (const other of otherHues) {
            const diff = ((other - baseHue) + 360) % 360;
            for (const angle of pattern.angles) {
                if (Math.abs(diff - angle) <= pattern.tolerance || Math.abs(diff - (360 - angle)) <= pattern.tolerance) {
                    matchCount++;
                    break;
                }
            }
        }
        const patternScore = otherHues.length > 0 ? matchCount / otherHues.length : 0;
        bestScore = Math.max(bestScore, patternScore);
    }

    // Also reward small number of distinct hues (simpler palette)
    const huePenalty = Math.max(0, 1 - (hues.length - 2) * 0.15);
    return bestScore * 0.7 + huePenalty * 0.3;
}

// ─── 15. Typography Harmony (THM) ───────────────────────────────────────

/** Measures if font sizes follow a consistent modular scale.
 *  Input: array of font sizes in px.
 *  1 = perfect scale adherence, 0 = random sizes. */
export function typographyHarmony(fontSizes: number[]): number {
    const unique = [...new Set(fontSizes.filter(s => s > 0))].sort((a, b) => a - b);
    if (unique.length <= 1) return 1;

    // Compute ratios between consecutive sizes
    const ratios: number[] = [];
    for (let i = 1; i < unique.length; i++) {
        ratios.push(unique[i] / unique[i - 1]);
    }

    if (ratios.length === 0) return 1;

    // Check if ratios are consistent (low variance = modular scale)
    const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    if (mean === 0) return 1;
    const variance = ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length;
    const cv = Math.sqrt(variance) / mean;

    // cv = 0 → perfect scale → 1, cv >= 0.5 → score 0
    return Math.max(0, 1 - cv * 2);
}

// ─── Birkhoff M = O/C ──────────────────────────────────────────────────

/** Birkhoff's Aesthetic Measure: M = O / C.
 *  O = order (alignment + symmetry), C = complexity (element count + size variety). */
export function birkhoff(rects: Rect[], vp: Viewport): number {
    if (rects.length === 0) return 1;

    // Order: symmetry + regularity
    const O = (symmetry(rects, vp) + regularity(rects)) / 2;

    // Complexity: normalized element count + size variety
    const elementComplexity = Math.min(rects.length / 20, 1); // 20 elements = max complexity
    const sizeVariety = 1 - simplicity(rects);
    const C = (elementComplexity + sizeVariety) / 2;

    if (C === 0) return 1;
    // Normalize to 0-1 range: M can exceed 1, cap it
    return Math.min(O / C, 1);
}

// ─── Overall Score ──────────────────────────────────────────────────────

export interface AestheticScore {
    balance: number;
    equilibrium: number;
    symmetry: number;
    proportion: number;
    rhythm: number;
    density: number;
    regularity: number;
    simplicity: number;
    unity: number;
    homogeneity: number;
    sequence: number;
    cohesion: number;
    economy: number;
    colorHarmony: number;
    typographyHarmony: number;
    birkhoff: number;
    overall: number;
}

/** Optional input for color/typography metrics (not derivable from Rect alone). */
export interface ScoreInput {
    rects: Rect[];
    viewport: Viewport;
    /** Background colors (CSS strings, e.g. from computed.backgroundColor). */
    colors?: string[];
    /** Font sizes in px (e.g. from styles.fontSize). */
    fontSizes?: number[];
}

/** Default weights for overall score (sum = 1). */
const DEFAULT_WEIGHTS: Record<keyof Omit<AestheticScore, 'overall' | 'birkhoff'>, number> = {
    balance: 0.12,
    equilibrium: 0.08,
    symmetry: 0.08,
    proportion: 0.08,
    rhythm: 0.12,
    density: 0.06,
    regularity: 0.08,
    simplicity: 0.04,
    unity: 0.06,
    homogeneity: 0.04,
    sequence: 0.06,
    cohesion: 0.06,
    economy: 0.04,
    colorHarmony: 0.04,
    typographyHarmony: 0.04,
};

/** Compute all aesthetic metrics. Accepts rects + optional colors/fontSizes. */
export function score(input: ScoreInput, weights?: Partial<typeof DEFAULT_WEIGHTS>): AestheticScore;
/** @deprecated Use ScoreInput overload. Kept for backward compat. */
export function score(rects: Rect[], vp: Viewport, weights?: Partial<typeof DEFAULT_WEIGHTS>): AestheticScore;
export function score(
    rectsOrInput: Rect[] | ScoreInput,
    vpOrWeights?: Viewport | Partial<typeof DEFAULT_WEIGHTS>,
    maybeWeights?: Partial<typeof DEFAULT_WEIGHTS>
): AestheticScore {
    let rects: Rect[];
    let vp: Viewport;
    let colors: string[] | undefined;
    let fontSizes: number[] | undefined;
    let weights: Partial<typeof DEFAULT_WEIGHTS> | undefined;

    if (Array.isArray(rectsOrInput)) {
        // Old API: score(rects, viewport, weights?)
        rects = rectsOrInput;
        vp = vpOrWeights as Viewport;
        weights = maybeWeights;
    } else {
        // New API: score(input, weights?)
        rects = rectsOrInput.rects;
        vp = rectsOrInput.viewport;
        colors = rectsOrInput.colors;
        fontSizes = rectsOrInput.fontSizes;
        weights = vpOrWeights as Partial<typeof DEFAULT_WEIGHTS> | undefined;
    }

    const w = { ...DEFAULT_WEIGHTS, ...weights };

    const scores: Omit<AestheticScore, 'overall' | 'birkhoff'> = {
        balance: balance(rects, vp),
        equilibrium: equilibrium(rects, vp),
        symmetry: symmetry(rects, vp),
        proportion: proportion(rects),
        rhythm: rhythm(rects),
        density: density(rects, vp),
        regularity: regularity(rects),
        simplicity: simplicity(rects),
        unity: unity(rects, vp),
        homogeneity: homogeneity(rects, vp),
        sequence: sequence(rects),
        cohesion: cohesion(rects),
        economy: economy(rects, vp),
        colorHarmony: colorHarmony(colors ?? []),
        typographyHarmony: typographyHarmony(fontSizes ?? []),
    };

    let overall = 0;
    for (const [key, wt] of Object.entries(w)) {
        overall += (scores[key as keyof typeof scores] ?? 0) * wt;
    }

    return {
        ...scores,
        birkhoff: birkhoff(rects, vp),
        overall,
    };
}

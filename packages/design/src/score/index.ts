/**
 * Score module — integrates aesthetic metrics with r$ measurement data.
 * Reads from SnapshotStore and computes Ngo + Birkhoff scores.
 */

import type { SnapshotStore } from '@responsivejs/core/types';
import type { Rect } from '@responsivejs/core/rect';
import { score as computeScore, type AestheticScore } from '@responsivejs/core/aesthetics';
import { StoreQuery } from '@responsivejs/core/snapshot';
import { contains } from '@responsivejs/core/rect';

export interface ScoreResult {
    /** Score at each measured viewport width */
    perWidth: Map<number, AestheticScore>;
    /** Average score across all widths */
    average: AestheticScore;
    /** Suggestions for improvement */
    suggestions: string[];
}

/** Compute aesthetic scores from a SnapshotStore. */
export function scoreFromStore(store: SnapshotStore): ScoreResult {
    const query = new StoreQuery(store);
    const perWidth = new Map<number, AestheticScore>();

    for (const width of store.widths) {
        const wq = query.at(width);
        const allRects = wq.allRects();
        const rects: Rect[] = allRects.map(r => r.rect);
        const vp = wq.viewport;

        // Collect colors and font sizes for the new metrics
        const colors: string[] = [];
        const fontSizes: number[] = [];
        const snapshot = store.snapshots.get(width);
        if (snapshot) {
            for (const elements of snapshot.elements.values()) {
                for (const el of elements) {
                    if (el.computed.backgroundColor) colors.push(el.computed.backgroundColor);
                    if (el.styles.fontSize > 0) fontSizes.push(el.styles.fontSize);
                }
            }
        }

        perWidth.set(width, computeScore({ rects, viewport: vp, colors, fontSizes }));
    }

    // Average across widths
    const average = averageScores([...perWidth.values()]);
    const suggestions = generateSuggestions(average);

    return { perWidth, average, suggestions };
}

/**
 * Compute aesthetic scores for a subtree: use the parent element as the
 * "viewport" and score only its contained children.
 */
export function scoreSubtree(store: SnapshotStore, parentSelector: string): ScoreResult {
    const query = new StoreQuery(store);
    const perWidth = new Map<number, AestheticScore>();

    for (const width of store.widths) {
        const wq = query.at(width);
        const parentRect = wq.rect(parentSelector);
        if (!parentRect) continue;

        // Use the parent rect as the "viewport" for scoring
        const parentAsViewport = { width: parentRect.width, height: parentRect.height };

        // Collect all rects that are contained within the parent
        const allRects = wq.allRects();
        const childRects: Rect[] = [];
        for (const entry of allRects) {
            // Skip the parent itself
            if (entry.selector === parentSelector && entry.index === 0) continue;
            // Only include elements fully contained within the parent
            if (contains(parentRect, entry.rect)) {
                // Translate to parent-local coordinates
                childRects.push({
                    x: entry.rect.x - parentRect.x,
                    y: entry.rect.y - parentRect.y,
                    width: entry.rect.width,
                    height: entry.rect.height,
                    right: entry.rect.right - parentRect.x,
                    bottom: entry.rect.bottom - parentRect.y,
                    centerX: entry.rect.centerX - parentRect.x,
                    centerY: entry.rect.centerY - parentRect.y,
                    area: entry.rect.area,
                });
            }
        }

        perWidth.set(width, computeScore(childRects, parentAsViewport));
    }

    const average = averageScores([...perWidth.values()]);
    const suggestions = generateSuggestions(average);

    return { perWidth, average, suggestions };
}

function averageScores(scores: AestheticScore[]): AestheticScore {
    if (scores.length === 0) {
        return {
            balance: 0, equilibrium: 0, symmetry: 0, proportion: 0,
            rhythm: 0, density: 0, regularity: 0, simplicity: 0,
            unity: 0, homogeneity: 0, sequence: 0, cohesion: 0,
            economy: 0, colorHarmony: 0, typographyHarmony: 0,
            birkhoff: 0, overall: 0,
        };
    }

    const keys: (keyof AestheticScore)[] = [
        'balance', 'equilibrium', 'symmetry', 'proportion', 'rhythm',
        'density', 'regularity', 'simplicity', 'unity', 'homogeneity',
        'sequence', 'cohesion', 'economy', 'colorHarmony', 'typographyHarmony',
        'birkhoff', 'overall',
    ];

    const avg = {} as AestheticScore;
    for (const key of keys) {
        avg[key] = scores.reduce((s, sc) => s + sc[key], 0) / scores.length;
    }

    return avg;
}

function generateSuggestions(avg: AestheticScore): string[] {
    const suggestions: string[] = [];
    const threshold = 0.6;

    if (avg.balance < threshold)
        suggestions.push(`Low balance (${fmt(avg.balance)}) — distribute elements more evenly around the center`);
    if (avg.equilibrium < threshold)
        suggestions.push(`Low equilibrium (${fmt(avg.equilibrium)}) — move visual weight closer to the center`);
    if (avg.symmetry < threshold)
        suggestions.push(`Low symmetry (${fmt(avg.symmetry)}) — align elements across vertical/horizontal axis`);
    if (avg.proportion < threshold)
        suggestions.push(`Low proportion (${fmt(avg.proportion)}) — use harmonic ratios (1:1, 1:√2, 1:φ, 1:2)`);
    if (avg.rhythm < threshold)
        suggestions.push(`Low rhythm (${fmt(avg.rhythm)}) — make spacing between elements more consistent`);
    if (avg.density < 0.3)
        suggestions.push(`Low density (${fmt(avg.density)}) — the layout feels too sparse`);
    if (avg.density > 0.85)
        suggestions.push(`High density (${fmt(avg.density)}) — the layout feels too cramped, add whitespace`);
    if (avg.regularity < threshold)
        suggestions.push(`Low regularity (${fmt(avg.regularity)}) — align elements to fewer grid lines`);
    if (avg.homogeneity < threshold)
        suggestions.push(`Low homogeneity (${fmt(avg.homogeneity)}) — distribute elements more evenly across quadrants`);
    if (avg.sequence < threshold)
        suggestions.push(`Low sequence (${fmt(avg.sequence)}) — order elements to follow natural reading flow (top-left → bottom-right)`);
    if (avg.cohesion < threshold)
        suggestions.push(`Low cohesion (${fmt(avg.cohesion)}) — group related elements closer together`);
    if (avg.economy < 0.4)
        suggestions.push(`Low economy (${fmt(avg.economy)}) — simplify the layout, reduce element count or consolidate small items`);
    if (avg.colorHarmony < threshold)
        suggestions.push(`Low color harmony (${fmt(avg.colorHarmony)}) — use complementary, analogous, or triadic color schemes`);
    if (avg.typographyHarmony < threshold)
        suggestions.push(`Low typography harmony (${fmt(avg.typographyHarmony)}) — use a consistent modular type scale`);

    return suggestions;
}

function fmt(n: number): string {
    return n.toFixed(2);
}

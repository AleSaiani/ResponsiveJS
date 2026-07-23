/**
 * Layout helpers: adaptive grids and the spacing system.
 */

import { fluid, custom, isResponsiveValue, type StyleMap, type StyleValue, type ResponsiveValue } from './value.js';

// ─── grid ───────────────────────────────────────────────────────────────

export interface AdaptiveGridOptions {
    minColumnWidth: number;
    maxColumns?: number;
    gap?: StyleValue;
}

export const grid = {
    /**
     * Responsive grid. Without maxColumns it is pure CSS (auto-fit/minmax);
     * with maxColumns the column count needs JS.
     */
    adaptive({ minColumnWidth, maxColumns, gap }: AdaptiveGridOptions): StyleMap {
        const map: StyleMap = { display: 'grid' };
        if (maxColumns === undefined) {
            map.gridTemplateColumns = `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))`;
        } else {
            map.gridTemplateColumns = custom((width) => {
                const cols = Math.max(1, Math.min(Math.floor(width / minColumnWidth), maxColumns));
                return `repeat(${cols}, 1fr)`;
            });
        }
        if (gap !== undefined) map.gap = gap;
        return map;
    },
};

// ─── space ──────────────────────────────────────────────────────────────

export interface SpaceConfig {
    /** Base unit in px (level 1). */
    base: number;
    /** Geometric ratio between levels. */
    ratio: number;
    /** Baseline for space.rhythm(), in px. */
    lineHeight: number;
}

let spaceConfig: SpaceConfig = { base: 8, ratio: 1.5, lineHeight: 24 };

function level(n: number): number {
    const value = spaceConfig.base * Math.pow(spaceConfig.ratio, n - 1);
    return Math.round(value * 100) / 100;
}

export const space = {
    config(partial: Partial<SpaceConfig>): void {
        spaceConfig = { ...spaceConfig, ...partial };
    },

    /** Spacing value at a level (px number). */
    level,

    /** Uniform padding at a level; two levels → vertical/horizontal shorthand. */
    inset(vLevel: number, hLevel?: number): StyleMap {
        if (hLevel === undefined) return { padding: level(vLevel) };
        return { padding: `${level(vLevel)}px ${level(hLevel)}px` };
    },

    /** Vertical stacking margin (margin-bottom). */
    stack(n: number): StyleMap {
        return { marginBottom: level(n) };
    },

    /** Horizontal gap at a level, or fluid between two levels. */
    inline(fromLevel: number, toLevel?: number): StyleValue {
        if (toLevel === undefined) return level(fromLevel);
        return fluid(level(fromLevel), level(toLevel));
    },

    /** Fluid spacing between two levels of the scale. */
    fluid(fromLevel: number, toLevel: number): ResponsiveValue {
        return fluid(level(fromLevel), level(toLevel));
    },

    /** Vertical rhythm: n × baseline line-height. */
    rhythm(n: number): number {
        return Math.round(n * spaceConfig.lineHeight * 100) / 100;
    },

    /** Test-only reset. */
    __reset(): void {
        spaceConfig = { base: 8, ratio: 1.5, lineHeight: 24 };
    },
};

export function isSpaceValue(v: unknown): v is StyleValue {
    return typeof v === 'number' || typeof v === 'string' || isResponsiveValue(v);
}

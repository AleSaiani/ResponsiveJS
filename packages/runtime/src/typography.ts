/**
 * Typographic scales as fluid values. Reuses the ratio table from
 * @responsivejs/core (SCALES) — one source of truth for scale math.
 */

import { SCALES } from '@responsivejs/core/typography';
import { fluid, type ResponsiveValue } from './value.js';

export interface TypeScaleOptions {
    ratio: number;
    /** Fluid root size: [min, max] px at the domain edges. */
    base?: [number, number];
}

export interface TypeScale {
    ratio: number;
    /** Font size at a scale level (fluid). Level 0 = base. */
    size(level: number): ResponsiveValue;
    /** Line height for a level (fluid px). Headings tighten: 1.5 → 1.2. */
    lineHeight(level: number): ResponsiveValue;
    /** Vertical spacing after a block of this level (half-em heuristic). */
    spacing(level: number): ResponsiveValue;
}

/** kebab-case public names → core SCALES keys. */
const NAME_MAP: Record<string, keyof typeof SCALES> = {
    'minor-second': 'minorSecond',
    'major-second': 'majorSecond',
    'minor-third': 'minorThird',
    'major-third': 'majorThird',
    'perfect-fourth': 'perfectFourth',
    'augmented-fourth': 'augmentedFourth',
    'perfect-fifth': 'perfectFifth',
    'golden-ratio': 'goldenRatio',
};

/** Line-height ratio per level: 1.5 for body, easing down to 1.2 for display sizes. */
function lineHeightRatio(level: number): number {
    if (level <= 0) return 1.5;
    if (level >= 4) return 1.2;
    return 1.5 - (level / 4) * 0.3;
}

export const typography = {
    scale(nameOrOptions: string | TypeScaleOptions): TypeScale {
        let ratio: number;
        let base: [number, number];

        if (typeof nameOrOptions === 'string') {
            const key = NAME_MAP[nameOrOptions];
            if (!key) {
                throw new Error(
                    `Unknown type scale '${nameOrOptions}'. Known: ${Object.keys(NAME_MAP).join(', ')}.`,
                );
            }
            ratio = SCALES[key];
            base = [16, 18];
        } else {
            ratio = nameOrOptions.ratio;
            base = nameOrOptions.base ?? [16, 18];
        }

        const sizeAt = (level: number): [number, number] => {
            const factor = Math.pow(ratio, level);
            return [Math.round(base[0] * factor * 100) / 100, Math.round(base[1] * factor * 100) / 100];
        };

        return {
            ratio,
            size(level: number): ResponsiveValue {
                const [min, max] = sizeAt(level);
                return fluid(min, max);
            },
            lineHeight(level: number): ResponsiveValue {
                const [min, max] = sizeAt(level);
                const lh = lineHeightRatio(level);
                return fluid(Math.round(min * lh * 100) / 100, Math.round(max * lh * 100) / 100);
            },
            spacing(level: number): ResponsiveValue {
                const [min, max] = sizeAt(level);
                return fluid(Math.round(min * 0.5 * 100) / 100, Math.round(max * 0.5 * 100) / 100);
            },
        };
    },

    /** Unitless line-height value for body text rhythm. */
    rhythm(x: number): number {
        return x;
    },
};

/**
 * Design System constraint generator.
 * Reads a DS JSON config and applies all relevant constraints to the Asserter.
 *
 * This is the bridge between a design system definition and r$ validation:
 * the DS is the "what", r$ constraint chain is the "how".
 */

import type { Asserter } from './index.js';
import { applyDesignSystemRules } from '../contract/design-system-rules.js';

/** Minimal DS JSON shape — matches our design-systems/*.json schema. */
export interface DesignSystemConfig {
    name?: string;
    spacing?: {
        tokens?: number[];
    };
    shape?: Record<string, { radius: number }>;
    components?: {
        button?: { height?: number };
        input?: { height?: number };
        dialog?: { minWidth?: number; maxWidth?: number };
    };
    accessibility?: {
        touchTarget?: { min?: number };
        contrast?: string;  // 'AA' | 'AAA'
    };
}

/** Selectors to validate, grouped by category. */
export interface ValidationSelectors {
    /** Interactive elements (buttons, links). */
    interactive?: string[];
    /** Text elements for readability. */
    text?: string[];
    /** Form inputs. */
    inputs?: string[];
    /** Containers for spacing/layout checks. */
    containers?: string[];
    /** Cards and surfaces. */
    surfaces?: string[];
    /** Any additional selectors. */
    extra?: string[];
}

export const DEFAULT_SELECTORS: ValidationSelectors = {
    interactive: ['button', '.pdx-primary', '.pdx-secondary', '.pdx-ghost', '.pdx-danger'],
    text: ['h1', 'h2', 'h3', 'p'],
    inputs: ['.pdx-input', 'input', 'select', 'textarea'],
    containers: ['main', 'pdx-stack', 'pdx-row', 'pdx-grid'],
    surfaces: ['.pdx-surface-card'],
    extra: [],
};

/**
 * Apply all design system constraints to the asserter.
 * Returns the asserter for chaining.
 */
export function applyDesignSystem(
    asserter: Asserter,
    ds: DesignSystemConfig,
    selectors: ValidationSelectors = {}
): Asserter {
    return applyDesignSystemRules(asserter, ds, selectors);
}

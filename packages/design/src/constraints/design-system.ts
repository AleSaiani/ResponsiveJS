/**
 * Design System constraint generator.
 * Reads a DS JSON config and applies all relevant constraints to the Asserter.
 *
 * This is the bridge between a design system definition and r$ validation:
 * the DS is the "what", r$ constraint chain is the "how".
 */

import type { Asserter } from './index.js';

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

const DEFAULT_SELECTORS: ValidationSelectors = {
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
    const sel = { ...DEFAULT_SELECTORS, ...selectors };

    // ── Accessibility ──
    // TODO: ds.accessibility.touchTarget.min is not applied — Asserter.touchTarget()
    // has no min parameter and always checks the WCAG 44px default.
    const contrastLevel = (ds.accessibility?.contrast as 'AA' | 'AAA') || 'AA';

    for (const s of sel.interactive || []) {
        asserter.touchTarget(s);
    }
    for (const s of sel.inputs || []) {
        asserter.touchTarget(s);
    }

    for (const s of [...(sel.interactive || []), ...(sel.text || [])]) {
        asserter.contrastRatio(s, contrastLevel);
    }

    for (const s of sel.interactive || []) {
        asserter.focusVisible(s);
    }

    for (const s of sel.text || []) {
        asserter.textReadable(s);
    }

    // ── Spacing ──
    if (ds.spacing?.tokens) {
        for (const s of sel.containers || []) {
            asserter.spacingTokens(s, ds.spacing.tokens);
        }
    }

    for (const s of sel.containers || []) {
        asserter.gapUniform(s);
    }

    // ── Shape ──
    for (const s of [...(sel.interactive || []), ...(sel.surfaces || []), ...(sel.inputs || [])]) {
        asserter.borderRadiusValid(s);
    }

    // ── Layout ──
    asserter.noOverflow();

    if (sel.containers?.includes('main')) {
        asserter.childrenContained('main');
    }

    for (const s of sel.containers || []) {
        asserter.noZeroHeight(s);
    }

    // ── Component sizing ──
    if (ds.components?.button?.height) {
        for (const s of sel.interactive || []) {
            asserter.minSize(s, { height: ds.components.button.height });
        }
    }

    if (ds.components?.input?.height) {
        for (const s of sel.inputs || []) {
            asserter.minSize(s, { height: ds.components.input.height });
        }
    }

    // ── Interactive spacing ──
    for (const s of sel.interactive || []) {
        asserter.interactiveSpacing(s);
    }

    // ── Typography scale ──
    if (sel.text && sel.text.length > 0) {
        asserter.typographyScale(sel.text.join(', '));
    }

    return asserter;
}

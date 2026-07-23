/**
 * Design-system profiles as contract-rule GENERATORS — the unification of the
 * two declarative systems. applyDesignSystem() is reimplemented on top of
 * this (a parity test locks the equivalence), and contracts embed a profile
 * via `designSystem: { profile }` which expands through here at verify time.
 */

import type { ContractRule } from '@responsivejs/contract';
import type { Asserter } from '../constraints/index.js';
import { DEFAULT_SELECTORS, type DesignSystemConfig, type ValidationSelectors } from '../constraints/design-system.js';
import { compileRule } from './dispatch.js';

/** Generate the executable projection of a design-system profile. */
export function designSystemRules(ds: DesignSystemConfig, selectors: ValidationSelectors = {}): ContractRule[] {
    const sel = { ...DEFAULT_SELECTORS, ...selectors };
    const rules: ContractRule[] = [];
    const add = (id: string, assert: ContractRule['assert'], args?: Record<string, unknown>): void => {
        rules.push({ id, assert, ...(args ? { args } : {}) });
    };

    // ── Accessibility ──
    // TODO: ds.accessibility.touchTarget.min is not applied — touchTarget()
    // has no min parameter and always checks the WCAG 44px default.
    const contrastLevel = (ds.accessibility?.contrast as 'AA' | 'AAA') || 'AA';

    for (const s of sel.interactive || []) add(`ds.touchTarget.${s}`, 'touchTarget', { selector: s });
    for (const s of sel.inputs || []) add(`ds.touchTarget.${s}`, 'touchTarget', { selector: s });

    for (const s of [...(sel.interactive || []), ...(sel.text || [])]) {
        add(`ds.contrast.${s}`, 'contrastRatio', { selector: s, level: contrastLevel });
    }

    for (const s of sel.interactive || []) add(`ds.focusVisible.${s}`, 'focusVisible', { selector: s });
    for (const s of sel.text || []) add(`ds.textReadable.${s}`, 'textReadable', { selector: s });

    // ── Spacing ──
    if (ds.spacing?.tokens) {
        for (const s of sel.containers || []) {
            add(`ds.spacingTokens.${s}`, 'spacingTokens', { selector: s, tokens: ds.spacing.tokens });
        }
    }
    for (const s of sel.containers || []) add(`ds.gapUniform.${s}`, 'gapUniform', { selector: s });

    // ── Shape ──
    for (const s of [...(sel.interactive || []), ...(sel.surfaces || []), ...(sel.inputs || [])]) {
        add(`ds.borderRadius.${s}`, 'borderRadiusValid', { selector: s });
    }

    // ── Layout ──
    add('ds.noOverflow', 'noOverflow');
    if (sel.containers?.includes('main')) add('ds.childrenContained.main', 'childrenContained', { selector: 'main' });
    for (const s of sel.containers || []) add(`ds.noZeroHeight.${s}`, 'noZeroHeight', { selector: s });

    // ── Component sizing ──
    if (ds.components?.button?.height) {
        for (const s of sel.interactive || []) {
            add(`ds.minSize.button.${s}`, 'minSize', { selector: s, min: { height: ds.components.button.height } });
        }
    }
    if (ds.components?.input?.height) {
        for (const s of sel.inputs || []) {
            add(`ds.minSize.input.${s}`, 'minSize', { selector: s, min: { height: ds.components.input.height } });
        }
    }

    // ── Interactive spacing ──
    for (const s of sel.interactive || []) add(`ds.interactiveSpacing.${s}`, 'interactiveSpacing', { selector: s });

    // ── Typography scale ──
    if (sel.text && sel.text.length > 0) {
        add('ds.typographyScale', 'typographyScale', { selector: sel.text.join(', ') });
    }

    return rules;
}

/** Compile design-system rules straight onto an asserter (legacy path). */
export function applyDesignSystemRules(asserter: Asserter, ds: DesignSystemConfig, selectors?: ValidationSelectors): Asserter {
    for (const rule of designSystemRules(ds, selectors)) compileRule(asserter, rule);
    return asserter;
}

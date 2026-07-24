/**
 * Asserter: validates mathematical constraints across all viewport widths.
 * Every assert method checks the constraint at ALL measured widths.
 */

import type { SnapshotStore, Violation, Report } from '@responsivejs/core/types';
import { StoreQuery } from '@responsivejs/core/snapshot';
import * as rectMath from '@responsivejs/core/rect';
import * as curveMath from '@responsivejs/core/curve';
import * as statsMath from '@responsivejs/core/stats';
import * as colorMath from '@responsivejs/core/color';
import * as typoMath from '@responsivejs/core/typography';

export class Asserter {
    private violations: Violation[] = [];
    private totalChecks = 0;
    private query: StoreQuery;

    constructor(private readonly store: SnapshotStore) {
        this.query = new StoreQuery(store);
    }

    /** No element exceeds viewport width at any measured width */
    noOverflow(): this {
        for (const [w, snapshot] of this.store.snapshots) {
            for (const [selector, elements] of snapshot.elements) {
                for (const el of elements) {
                    this.totalChecks++;
                    if (!rectMath.inViewport(el.rect, snapshot.width)) {
                        this.violations.push({
                            rule: 'noOverflow',
                            element: `${selector}[${el.index}]`,
                            width: w,
                            detail: `right=${Math.round(el.rect.right)} > viewport=${snapshot.width}`,
                            expected: snapshot.width,
                            actual: Math.round(el.rect.right),
                            severity: 'error',
                        });
                    }
                }
            }
        }
        return this;
    }

    /** Child element is fully contained within parent at all widths */
    contains(parentSelector: string, childSelector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const parents = snapshot.elements.get(parentSelector) || [];
            const children = snapshot.elements.get(childSelector) || [];

            for (const child of children) {
                this.totalChecks++;
                // Find the parent that should contain this child
                const parent = parents.find(p => rectMath.contains(p.rect, child.rect, 5))
                    || parents[0]; // fallback to first parent

                if (parent && !rectMath.contains(parent.rect, child.rect)) {
                    this.violations.push({
                        rule: 'contains',
                        elements: [parentSelector, childSelector],
                        width: w,
                        detail: `child right=${Math.round(child.rect.right)} > parent right=${Math.round(parent.rect.right)}`,
                        severity: 'error',
                    });
                }
            }
        }
        return this;
    }

    /** Two elements have the same height at all widths */
    sameHeight(selectorA: string, selectorB: string, tolerance = 2): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const a = snapshot.elements.get(selectorA)?.[0];
            const b = snapshot.elements.get(selectorB)?.[0];
            if (!a || !b) continue;

            this.totalChecks++;
            if (!rectMath.sameHeight(a.rect, b.rect, tolerance)) {
                this.violations.push({
                    rule: 'sameHeight',
                    elements: [selectorA, selectorB],
                    width: w,
                    detail: `${selectorA}=${Math.round(a.rect.height)}px ${selectorB}=${Math.round(b.rect.height)}px`,
                    expected: Math.round(a.rect.height),
                    actual: Math.round(b.rect.height),
                    severity: 'warning',
                });
            }
        }
        return this;
    }

    /** Two elements are on the same visual line at all widths */
    sameLine(selectorA: string, selectorB: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const a = snapshot.elements.get(selectorA)?.[0];
            const b = snapshot.elements.get(selectorB)?.[0];
            if (!a || !b) continue;

            this.totalChecks++;
            if (!rectMath.overlapsVertically(a.rect, b.rect)) {
                this.violations.push({
                    rule: 'sameLine',
                    elements: [selectorA, selectorB],
                    width: w,
                    detail: `${selectorA} y=${Math.round(a.rect.y)}-${Math.round(a.rect.bottom)} ${selectorB} y=${Math.round(b.rect.y)}-${Math.round(b.rect.bottom)}`,
                    severity: 'warning',
                });
            }
        }
        return this;
    }

    /** Element has minimum size at all widths */
    minSize(selector: string, min: { width?: number; height?: number }): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                if (min.height && el.rect.height < min.height - 1) {
                    this.violations.push({
                        rule: 'minSize',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `height=${Math.round(el.rect.height)}px < min=${min.height}px`,
                        expected: min.height,
                        actual: Math.round(el.rect.height),
                        severity: 'error',
                    });
                }
                if (min.width && el.rect.width < min.width - 1) {
                    this.violations.push({
                        rule: 'minSize',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `width=${Math.round(el.rect.width)}px < min=${min.width}px`,
                        expected: min.width,
                        actual: Math.round(el.rect.width),
                        severity: 'error',
                    });
                }
            }
        }
        return this;
    }

    /** Gap between direct children of a container is uniform at each width.
     *  Detects the axis automatically: vertical if children are stacked, horizontal if in a row. */
    gapUniform(containerSelector: string, threshold = 0.15): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const relations = snapshot.childRelations?.get(containerSelector);
            if (!relations) continue;

            for (const rel of relations) {
                if (rel.childRects.length < 2) continue;
                this.totalChecks++;

                // Detect axis: if children share similar Y -> horizontal row, else vertical stack
                const yVariance = statsMath.cv(rel.childRects.map(r => r.y));
                const isHorizontal = yVariance < 0.1;

                let gapValues: number[];
                if (isHorizontal) {
                    // Horizontal: gaps between right edge of one and left edge of next
                    const sorted = [...rel.childRects].sort((a, b) => a.x - b.x);
                    gapValues = [];
                    for (let i = 1; i < sorted.length; i++) {
                        gapValues.push(sorted[i].x - sorted[i - 1].right);
                    }
                } else {
                    // Vertical: gaps between bottom of one and top of next
                    const sorted = [...rel.childRects].sort((a, b) => a.y - b.y);
                    gapValues = [];
                    for (let i = 1; i < sorted.length; i++) {
                        gapValues.push(sorted[i].y - sorted[i - 1].bottom);
                    }
                }

                // Filter out negative gaps (overlapping elements)
                const positiveGaps = gapValues.filter(g => g > 0);
                if (positiveGaps.length < 2) continue;

                if (!statsMath.isUniform(positiveGaps, threshold)) {
                    this.violations.push({
                        rule: 'gapUniform',
                        element: containerSelector,
                        width: w,
                        detail: `cv=${statsMath.cv(positiveGaps).toFixed(3)} > ${threshold} gaps=[${positiveGaps.map(g => Math.round(g)).join(',')}]`,
                        severity: 'warning',
                    });
                }
            }
        }
        return this;
    }

    /** A numeric property is monotonically non-decreasing across viewport widths */
    monotonic(selector: string, prop: 'fontSize' | 'width' | 'height', direction: 'up' | 'down' = 'up'): this {
        const curve = prop === 'width' || prop === 'height'
            ? this.query.rectCurve(selector, prop)
            : this.query.curve(selector, prop);

        this.totalChecks++;
        const check = direction === 'up'
            ? curveMath.isMonotonicUp(curve)
            : curveMath.isMonotonicDown(curve);

        if (!check) {
            const jump = curveMath.maxJump(curve);
            this.violations.push({
                rule: 'monotonic',
                element: selector,
                width: jump.toWidth,
                detail: `${prop} not monotonic ${direction}: jump=${Math.round(jump.jump)}px at ${jump.fromWidth}->${jump.toWidth}`,
                severity: 'warning',
            });
        }
        return this;
    }

    /** A property curve has no discontinuities (jumps) larger than maxJump */
    continuous(selector: string, prop: 'width' | 'height' | 'fontSize', maxAllowed: number): this {
        const curve = prop === 'fontSize'
            ? this.query.curve(selector, prop)
            : this.query.rectCurve(selector, prop);

        this.totalChecks++;
        if (!curveMath.isContinuous(curve, maxAllowed)) {
            const jump = curveMath.maxJump(curve);
            this.violations.push({
                rule: 'continuous',
                element: selector,
                width: jump.toWidth,
                detail: `${prop} jump=${Math.round(jump.jump)}px > max=${maxAllowed}px at ${jump.fromWidth}->${jump.toWidth}`,
                severity: 'warning',
            });
        }
        return this;
    }

    /** Width ratio between two elements stays within bounds */
    proportion(selectorA: string, selectorB: string, bounds: { min: number; max: number }): this {
        const curveA = this.query.rectCurve(selectorA, 'width');
        const curveB = this.query.rectCurve(selectorB, 'width');

        for (const [w, va] of curveA) {
            const vb = curveB.get(w);
            if (!vb || vb === 0) continue;

            this.totalChecks++;
            const ratio = va / vb;
            if (ratio < bounds.min || ratio > bounds.max) {
                this.violations.push({
                    rule: 'proportion',
                    elements: [selectorA, selectorB],
                    width: w,
                    detail: `ratio=${ratio.toFixed(3)} outside [${bounds.min}, ${bounds.max}]`,
                    expected: (bounds.min + bounds.max) / 2,
                    actual: ratio,
                    severity: 'warning',
                });
            }
        }
        return this;
    }

    /** All direct children of a container are fully contained within the parent at all widths */
    childrenContained(containerSelector: string, tolerance = 1): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const relations = snapshot.childRelations?.get(containerSelector);
            if (!relations) continue;

            for (const rel of relations) {
                for (let i = 0; i < rel.childRects.length; i++) {
                    this.totalChecks++;
                    if (!rectMath.contains(rel.parentRect, rel.childRects[i], tolerance)) {
                        const child = rel.childRects[i];
                        const parent = rel.parentRect;
                        const overflowR = Math.max(0, Math.round(child.right - parent.right));
                        const overflowB = Math.max(0, Math.round(child.bottom - parent.bottom));
                        const overflowL = Math.max(0, Math.round(parent.x - child.x));
                        this.violations.push({
                            rule: 'childrenContained',
                            element: `${containerSelector} > child[${i}]`,
                            width: w,
                            detail: `child overflows parent: right+${overflowR}px bottom+${overflowB}px left+${overflowL}px`,
                            severity: 'error',
                        });
                    }
                }
            }
        }
        return this;
    }

    /** Children of a container have similar widths (for grids) */
    childrenEqualWidth(containerSelector: string, tolerance = 0.2): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const relations = snapshot.childRelations?.get(containerSelector);
            if (!relations) continue;

            for (const rel of relations) {
                if (rel.childRects.length < 2) continue;
                this.totalChecks++;

                const widths = rel.childRects.map(r => r.width);
                if (!statsMath.isUniform(widths, tolerance)) {
                    this.violations.push({
                        rule: 'childrenEqualWidth',
                        element: containerSelector,
                        width: w,
                        detail: `cv=${statsMath.cv(widths).toFixed(3)} > ${tolerance} widths=[${widths.map(w => Math.round(w)).join(',')}]`,
                        severity: 'warning',
                    });
                }
            }
        }
        return this;
    }

    /** No element has zero height (detects display:inline bug on custom elements) */
    noZeroHeight(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                if (el.rect.height === 0 && el.rect.width > 0) {
                    this.violations.push({
                        rule: 'noZeroHeight',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `height=0 width=${Math.round(el.rect.width)} display=${el.computed.display}`,
                        severity: 'warning',
                    });
                }
            }
        }
        return this;
    }

    // ── New constraints ─────────────────────────────────────────────────

    /** At mobile widths (<=768), interactive elements meet a minimum size.
     *  Default 44px (platform/AAA guidance); WCAG 2.5.8 AA minimum is 24. */
    touchTarget(selector: string, min = 44): this {
        for (const [w, snapshot] of this.store.snapshots) {
            if (w > 768) continue;
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                if (el.computed.cursor !== 'pointer') continue;
                // WCAG 2.5.8 inline exception: targets that flow inside a line
                // of text (links in prose) are exempt from the size minimum.
                if (el.computed.display === 'inline') continue;
                this.totalChecks++;
                if (el.rect.width < min || el.rect.height < min) {
                    this.violations.push({
                        rule: 'touchTarget',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `${Math.round(el.rect.width)}x${Math.round(el.rect.height)}px < ${min}x${min}px`,
                        expected: min,
                        actual: Math.min(Math.round(el.rect.width), Math.round(el.rect.height)),
                        severity: 'error',
                        suggestion: `Add min-height: ${min}px and min-width: ${min}px, or increase padding`,
                        fix: { selector, property: 'min-height', value: `${min}px`, reason: 'touch target minimum' },
                    });
                }
            }
        }
        return this;
    }

    /** Text must be readable: fontSize >= 14 and lineHeight >= 1.3 at all widths */
    textReadable(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                const fs = el.styles.fontSize;
                // The measurer stores line-height in PX (getComputedStyle resolves it), so a raw
                // `lh < 1.3` never fired. Normalize to a unitless ratio before comparing. A `normal`
                // line-height resolves to 0 px in the measurer → treat as acceptable (skip), since
                // the browser default (~1.2) is font-dependent and not a real violation.
                const lhPx = el.styles.lineHeight;
                const lh = lhPx > 0 && fs > 0 ? lhPx / fs : null;
                if (fs < 14) {
                    this.violations.push({
                        rule: 'textReadable',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `fontSize=${fs}px < 14px`,
                        expected: 14,
                        actual: fs,
                        severity: 'warning',
                        suggestion: 'Increase font-size to at least 14px for readability',
                        fix: { selector, property: 'font-size', value: '14px', reason: 'Minimum readable font size' },
                    });
                }
                if (lh !== null && lh < 1.3) {
                    this.violations.push({
                        rule: 'textReadable',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `lineHeight=${lh.toFixed(2)} < 1.3`,
                        expected: 1.3,
                        actual: lh,
                        severity: 'warning',
                        suggestion: 'Increase line-height to at least 1.3 for readability',
                        fix: { selector, property: 'line-height', value: '1.4', reason: 'Minimum readable line height' },
                    });
                }
            }
        }
        return this;
    }

    /** WCAG contrast ratio between text color and background color */
    contrastRatio(selector: string, level: 'AA' | 'AAA' = 'AA'): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                const ratio = colorMath.contrastRatio(el.computed.color, el.computed.backgroundColor);
                const fs = el.styles.fontSize;
                // WCAG large text: >= 24px, OR >= 18.66px AND bold (fontWeight >= 700).
                // The previous `fs >= 24 || fs >= 18.66` ignored the bold requirement, wrongly
                // relaxing the contrast threshold for any 18.66px+ text (even regular weight).
                const isBold = el.styles.fontWeight >= 700;
                const isLargeText = fs >= 24 || (fs >= 18.66 && isBold);
                const passes = level === 'AAA'
                    ? colorMath.meetsAAA(ratio, isLargeText)
                    : colorMath.meetsAA(ratio, isLargeText);

                if (!passes) {
                    const required = level === 'AAA'
                        ? (isLargeText ? 4.5 : 7)
                        : (isLargeText ? 3 : 4.5);
                    this.violations.push({
                        rule: 'contrastRatio',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `contrast=${ratio.toFixed(2)}:1 < ${required}:1 (${level}${isLargeText ? ' large' : ''})`,
                        expected: required,
                        actual: ratio,
                        severity: 'error',
                        suggestion: `Increase contrast ratio to at least ${required}:1 for WCAG ${level} compliance`,
                        fix: { selector, property: 'color', value: '(increase contrast)', reason: `WCAG ${level} minimum ratio` },
                    });
                }
            }
        }
        return this;
    }

    /** Border radius must not exceed element dimensions (avoids visual clipping) */
    borderRadiusValid(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                const { borderRadiusTL, borderRadiusTR, borderRadiusBR, borderRadiusBL } = el.styles;
                // Skip pill shapes (9999px = border-radius: full) — intentional design pattern
                if (borderRadiusTL >= 9999 || borderRadiusTR >= 9999 || borderRadiusBR >= 9999 || borderRadiusBL >= 9999) continue;
                // Skip zero-size elements (hidden/collapsed)
                if (el.rect.width <= 0 || el.rect.height <= 0) continue;
                const topSum = borderRadiusTL + borderRadiusTR;
                const leftSum = borderRadiusTL + borderRadiusBL;
                const elW = el.rect.width;
                const elH = el.rect.height;

                if (topSum > elW) {
                    this.violations.push({
                        rule: 'borderRadiusValid',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `top radii sum=${topSum}px > width=${Math.round(elW)}px`,
                        expected: Math.round(elW),
                        actual: topSum,
                        severity: 'warning',
                        suggestion: 'Reduce border-radius so top-left + top-right does not exceed element width',
                        fix: { selector, property: 'border-radius', value: '(reduce to fit element)', reason: 'Sum of radii exceeds element dimension' },
                    });
                }
                if (leftSum > elH) {
                    this.violations.push({
                        rule: 'borderRadiusValid',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `left radii sum=${leftSum}px > height=${Math.round(elH)}px`,
                        expected: Math.round(elH),
                        actual: leftSum,
                        severity: 'warning',
                        suggestion: 'Reduce border-radius so top-left + bottom-left does not exceed element height',
                        fix: { selector, property: 'border-radius', value: '(reduce to fit element)', reason: 'Sum of radii exceeds element dimension' },
                    });
                }
            }
        }
        return this;
    }

    /** Z-index order: selectors[i] must have z-index <= selectors[i+1] at every width */
    zStackOrder(selectors: string[]): this {
        if (selectors.length < 2) return this;

        for (const [w, snapshot] of this.store.snapshots) {
            for (let i = 0; i < selectors.length - 1; i++) {
                const elA = snapshot.elements.get(selectors[i])?.[0];
                const elB = snapshot.elements.get(selectors[i + 1])?.[0];
                if (!elA || !elB) continue;

                this.totalChecks++;
                if (elA.styles.zIndex > elB.styles.zIndex) {
                    const expected = elA.styles.zIndex + 1;
                    this.violations.push({
                        rule: 'zStackOrder',
                        elements: [selectors[i], selectors[i + 1]],
                        width: w,
                        detail: `${selectors[i]} z-index=${elA.styles.zIndex} > ${selectors[i + 1]} z-index=${elB.styles.zIndex}`,
                        expected: elB.styles.zIndex,
                        actual: elA.styles.zIndex,
                        severity: 'warning',
                        suggestion: 'Adjust z-index values so stacking order matches visual intent',
                        fix: { selector: selectors[i + 1], property: 'z-index', value: String(expected), reason: 'Must be above previous in stack' },
                    });
                }
            }
        }
        return this;
    }

    /** Font sizes for matching elements follow a known typographic scale */
    typographyScale(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            if (elements.length < 2) continue;

            this.totalChecks++;
            const sizes = elements.map(el => el.styles.fontSize);
            const fit = typoMath.fitsScale(sizes);

            if (!fit.fits) {
                this.violations.push({
                    rule: 'typographyScale',
                    element: selector,
                    width: w,
                    detail: `closest scale=${fit.closest} (ratio=${fit.ratio.toFixed(3)}) deviation=${fit.deviation.toFixed(3)}`,
                    severity: 'info',
                    suggestion: `Font sizes deviate from ${fit.closest} scale; consider aligning to a modular type scale`,
                    fix: { selector, property: 'font-size', value: '(align to modular scale)', reason: 'Typography should follow a consistent scale' },
                });
            }
        }
        return this;
    }

    /** Spacing values (gap, padding) use only allowed design tokens */
    spacingTokens(selector: string, tokens: number[]): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                const spacingValues = [
                    el.styles.gap,
                    el.styles.paddingTop,
                    el.styles.paddingRight,
                    el.styles.paddingBottom,
                    el.styles.paddingLeft,
                ];
                const result = typoMath.usesTokens(spacingValues, tokens);

                if (!result.valid) {
                    this.violations.push({
                        rule: 'spacingTokens',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `off-token values=[${result.outliers.map(v => Math.round(v)).join(',')}] tokens=[${tokens.join(',')}]`,
                        severity: 'info',
                        suggestion: 'Align spacing values to your design tokens for visual consistency',
                        fix: { selector, property: '(gap or padding)', value: '(nearest token)', reason: 'Use design system spacing tokens' },
                    });
                }
            }
        }
        return this;
    }

    /** Element width/height ratio stays within expected bounds at all widths */
    aspectRatio(selector: string, ratio: number, tolerance = 0.1): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                if (el.rect.height === 0) continue;
                this.totalChecks++;
                const actual = el.rect.width / el.rect.height;

                if (Math.abs(actual - ratio) > tolerance) {
                    this.violations.push({
                        rule: 'aspectRatio',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `aspect=${actual.toFixed(3)} expected=${ratio.toFixed(3)} (tolerance=${tolerance})`,
                        expected: ratio,
                        actual,
                        severity: 'warning',
                        suggestion: `Adjust dimensions to maintain ${ratio.toFixed(2)}:1 aspect ratio`,
                        fix: { selector, property: 'aspect-ratio', value: String(ratio), reason: 'Maintain target aspect ratio' },
                    });
                }
            }
        }
        return this;
    }

    /** Focusable elements should have a visible focus indicator.
     *  Note: checks resting state only. Elements using box-shadow focus rings
     *  will show as 'info' not 'error' since we can't measure :focus-visible
     *  state without interaction. Use measureInteraction() for definitive
     *  focus ring validation. */
    focusVisible(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                // Skip elements that aren't interactive (no cursor:pointer)
                if (el.computed.cursor !== 'pointer' && el.computed.cursor !== 'text') continue;
                // Skip hidden/zero-size elements
                if (el.rect.width <= 0 || el.rect.height <= 0) continue;

                if (el.styles.outlineWidth <= 0) {
                    this.violations.push({
                        rule: 'focusVisible',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `outlineWidth=${el.styles.outlineWidth}px at rest — verify :focus-visible state has visible indicator`,
                        severity: 'info',
                        suggestion: 'Verify focus ring via outline or box-shadow on :focus-visible (WCAG 2.4.7)',
                        fix: { selector, property: 'outline', value: '2px solid currentColor', reason: 'Focus must be visible for keyboard users' },
                    });
                }
            }
        }
        return this;
    }

    /** Detect hidden overflow clipping children that extend beyond the parent rect */
    noHiddenOverflow(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                if (el.computed.overflow !== 'hidden') continue;

                const relations = snapshot.childRelations?.get(selector);
                if (!relations) continue;

                for (const rel of relations) {
                    this.totalChecks++;
                    for (let i = 0; i < rel.childRects.length; i++) {
                        const child = rel.childRects[i];
                        if (child.right > el.rect.right + 1 || child.bottom > el.rect.bottom + 1
                            || child.x < el.rect.x - 1 || child.y < el.rect.y - 1) {
                            this.violations.push({
                                rule: 'noHiddenOverflow',
                                element: `${selector}[${el.index}]`,
                                width: w,
                                detail: `overflow:hidden clips child[${i}] — child extends beyond parent bounds`,
                                severity: 'warning',
                                suggestion: 'Content is clipped by overflow:hidden; consider overflow:auto or adjusting layout',
                                fix: { selector, property: 'overflow', value: 'auto', reason: 'Content is clipped by overflow:hidden' },
                            });
                        }
                    }
                }
            }
        }
        return this;
    }

    /** Element positions align to a grid (x and y are multiples of gridSize within 1px) */
    alignedToGrid(selector: string, gridSize: number): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            for (const el of elements) {
                this.totalChecks++;
                const xOff = Math.abs(el.rect.x % gridSize);
                const yOff = Math.abs(el.rect.y % gridSize);
                // Within 1px tolerance: offset is near 0 or near gridSize
                const xAligned = xOff <= 1 || xOff >= gridSize - 1;
                const yAligned = yOff <= 1 || yOff >= gridSize - 1;

                if (!xAligned || !yAligned) {
                    this.violations.push({
                        rule: 'alignedToGrid',
                        element: `${selector}[${el.index}]`,
                        width: w,
                        detail: `position (${Math.round(el.rect.x)},${Math.round(el.rect.y)}) not aligned to ${gridSize}px grid (offsets: x=${xOff.toFixed(1)} y=${yOff.toFixed(1)})`,
                        severity: 'info',
                        suggestion: `Snap element positions to the ${gridSize}px grid`,
                        fix: { selector, property: 'margin-left', value: '(align to grid)', reason: 'Position should align to grid' },
                    });
                }
            }
        }
        return this;
    }

    /** At breakpoint boundaries, no element has zero height or negative width */
    breakpointSafe(breakpoints: number[]): this {
        for (const bp of breakpoints) {
            const checkWidths = [bp - 1, bp, bp + 1];
            for (const w of checkWidths) {
                const snapshot = this.store.snapshots.get(w);
                if (!snapshot) continue;

                for (const [selector, elements] of snapshot.elements) {
                    for (const el of elements) {
                        this.totalChecks++;
                        if (el.rect.height === 0) {
                            this.violations.push({
                                rule: 'breakpointSafe',
                                element: `${selector}[${el.index}]`,
                                width: w,
                                detail: `zero height at breakpoint boundary ${bp}px (measured at ${w}px)`,
                                severity: 'error',
                                suggestion: `Element collapses near the ${bp}px breakpoint; check media query transitions`,
                                fix: { selector: '(element)', property: 'min-height', value: '1px', reason: 'Element collapses at breakpoint' },
                            });
                        }
                        if (el.rect.width < 0) {
                            this.violations.push({
                                rule: 'breakpointSafe',
                                element: `${selector}[${el.index}]`,
                                width: w,
                                detail: `negative width=${Math.round(el.rect.width)}px at breakpoint boundary ${bp}px (measured at ${w}px)`,
                                severity: 'error',
                                suggestion: `Element has negative width near the ${bp}px breakpoint; check sizing constraints`,
                                fix: { selector: '(element)', property: 'min-height', value: '1px', reason: 'Element collapses at breakpoint' },
                            });
                        }
                    }
                }
            }
        }
        return this;
    }

    /** Interactive elements (cursor:pointer) must be spaced at least minGap px apart */
    interactiveSpacing(selector: string, minGap = 8): this {
        for (const [w, snapshot] of this.store.snapshots) {
            const elements = snapshot.elements.get(selector) || [];
            const interactive = elements.filter(el => el.computed.cursor === 'pointer');
            if (interactive.length < 2) continue;

            for (let i = 0; i < interactive.length; i++) {
                for (let j = i + 1; j < interactive.length; j++) {
                    this.totalChecks++;
                    const a = interactive[i].rect;
                    const b = interactive[j].rect;

                    // Minimum edge-to-edge gap: max of horizontal and vertical gaps,
                    // treating overlapping axis as 0 gap
                    const hGap = Math.max(0, Math.max(b.x - a.right, a.x - b.right));
                    const vGap = Math.max(0, Math.max(b.y - a.bottom, a.y - b.bottom));
                    // If rects overlap on one axis, gap is the other axis distance;
                    // if they overlap on both, gap is 0
                    const edgeGap = Math.max(hGap, vGap);

                    if (edgeGap < minGap) {
                        this.violations.push({
                            rule: 'interactiveSpacing',
                            elements: [`${selector}[${interactive[i].index}]`, `${selector}[${interactive[j].index}]`],
                            width: w,
                            detail: `gap=${Math.round(edgeGap)}px < min=${minGap}px between interactive elements`,
                            expected: minGap,
                            actual: Math.round(edgeGap),
                            severity: 'warning',
                            suggestion: `Increase spacing between interactive elements to at least ${minGap}px to prevent mis-taps`,
                            fix: { selector, property: 'margin', value: `${minGap}px`, reason: 'Interactive elements need spacing for usability' },
                        });
                    }
                }
            }
        }
        return this;
    }

    /** The element is present AND rendered (display/visibility/area) at every width. */
    visible(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            this.totalChecks++;
            const elements = snapshot.elements.get(selector) || [];
            const rendered = elements.some(
                (el) =>
                    el.computed.display !== 'none' &&
                    el.computed.visibility !== 'hidden' &&
                    el.rect.area > 0,
            );
            if (!rendered) {
                this.violations.push({
                    rule: 'visible',
                    element: selector,
                    width: w,
                    detail:
                        elements.length === 0
                            ? 'element not found'
                            : `present but not rendered (display=${elements[0].computed.display}, visibility=${elements[0].computed.visibility}, area=${Math.round(elements[0].rect.area)})`,
                    severity: 'error',
                });
            }
        }
        return this;
    }

    /** The element is absent OR not rendered at every width (inverse of visible). */
    hidden(selector: string): this {
        for (const [w, snapshot] of this.store.snapshots) {
            this.totalChecks++;
            const elements = snapshot.elements.get(selector) || [];
            const rendered = elements.filter(
                (el) =>
                    el.computed.display !== 'none' &&
                    el.computed.visibility !== 'hidden' &&
                    el.rect.area > 0,
            );
            if (rendered.length > 0) {
                this.violations.push({
                    rule: 'hidden',
                    element: `${selector}[${rendered[0].index}]`,
                    width: w,
                    detail: `expected hidden but rendered (${Math.round(rendered[0].rect.width)}×${Math.round(rendered[0].rect.height)})`,
                    severity: 'error',
                    fix: { selector, property: 'display', value: 'none', reason: 'contract requires this element hidden at this width' },
                });
            }
        }
        return this;
    }

    /** Generate the validation report */
    report(): Report {
        return {
            pass: this.violations.length === 0,
            total: this.totalChecks,
            passed: this.totalChecks - this.violations.length,
            failed: this.violations.length,
            violations: this.violations,
        };
    }

    /** Reset violations for a new run */
    reset(): this {
        this.violations = [];
        this.totalChecks = 0;
        return this;
    }
}

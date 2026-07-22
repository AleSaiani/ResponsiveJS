/**
 * Measurer: executes in the browser to capture element geometry and styles.
 * This is the bridge between the Cartesian plane model and the real DOM.
 */

import type { Page } from '@playwright/test';
import type { ElementSnapshot, ViewportSnapshot, ChildRelation, InteractionSnapshot } from '@responsivejs/core/types';
import { fromDOMRect } from '@responsivejs/core/rect';

/** Raw measurement result from the browser (serializable) */
interface RawMeasurement {
    selector: string;
    index: number;
    rect: { x: number; y: number; width: number; height: number };
    styles: {
        fontSize: number;
        lineHeight: number;
        fontWeight: number;
        gap: number;
        paddingTop: number;
        paddingRight: number;
        paddingBottom: number;
        paddingLeft: number;
        marginTop: number;
        marginRight: number;
        marginBottom: number;
        marginLeft: number;
        borderRadiusTL: number;
        borderRadiusTR: number;
        borderRadiusBR: number;
        borderRadiusBL: number;
        minWidth: number;
        maxWidth: number;
        minHeight: number;
        maxHeight: number;
        zIndex: number;
        opacity: number;
        outlineWidth: number;
        outlineOffset: number;
    };
    computed: {
        display: string;
        overflow: string;
        position: string;
        visibility: string;
        pointerEvents: string;
        backgroundColor: string;
        color: string;
        boxSizing: string;
        textAlign: string;
        whiteSpace: string;
        cursor: string;
    };
}

/**
 * Measure all elements matching the given selectors.
 * Runs entirely inside the browser via page.evaluate().
 */
export async function measure(page: Page, selectors: string[]): Promise<ViewportSnapshot> {
    const viewportSize = page.viewportSize();
    if (!viewportSize) throw new Error('Page has no viewport size set');

    const raw: RawMeasurement[] = await page.evaluate((sels) => {
        const results: any[] = [];

        for (const selector of sels) {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el, index) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);

                results.push({
                    selector,
                    index,
                    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                    styles: {
                        fontSize: parseFloat(cs.fontSize) || 0,
                        lineHeight: parseFloat(cs.lineHeight) || 0,
                        fontWeight: parseFloat(cs.fontWeight) || 400,
                        gap: parseFloat(cs.gap) || 0,
                        paddingTop: parseFloat(cs.paddingTop) || 0,
                        paddingRight: parseFloat(cs.paddingRight) || 0,
                        paddingBottom: parseFloat(cs.paddingBottom) || 0,
                        paddingLeft: parseFloat(cs.paddingLeft) || 0,
                        marginTop: parseFloat(cs.marginTop) || 0,
                        marginRight: parseFloat(cs.marginRight) || 0,
                        marginBottom: parseFloat(cs.marginBottom) || 0,
                        marginLeft: parseFloat(cs.marginLeft) || 0,
                        borderRadiusTL: parseFloat(cs.borderTopLeftRadius) || 0,
                        borderRadiusTR: parseFloat(cs.borderTopRightRadius) || 0,
                        borderRadiusBR: parseFloat(cs.borderBottomRightRadius) || 0,
                        borderRadiusBL: parseFloat(cs.borderBottomLeftRadius) || 0,
                        minWidth: parseFloat(cs.minWidth) || 0,
                        maxWidth: cs.maxWidth === 'none' ? Infinity : (parseFloat(cs.maxWidth) || 0),
                        minHeight: parseFloat(cs.minHeight) || 0,
                        maxHeight: cs.maxHeight === 'none' ? Infinity : (parseFloat(cs.maxHeight) || 0),
                        zIndex: cs.zIndex === 'auto' ? 0 : (parseInt(cs.zIndex) || 0),
                        opacity: parseFloat(cs.opacity) ?? 1,
                        outlineWidth: parseFloat(cs.outlineWidth) || 0,
                        outlineOffset: parseFloat(cs.outlineOffset) || 0,
                    },
                    computed: {
                        display: cs.display,
                        overflow: cs.overflow,
                        position: cs.position,
                        visibility: cs.visibility,
                        pointerEvents: cs.pointerEvents,
                        backgroundColor: cs.backgroundColor,
                        color: cs.color,
                        boxSizing: cs.boxSizing,
                        textAlign: cs.textAlign,
                        whiteSpace: cs.whiteSpace,
                        cursor: cs.cursor,
                    },
                });
            });
        }

        return results;
    }, selectors);

    // Convert raw measurements to ElementSnapshots with full Rect
    const elements = new Map<string, ElementSnapshot[]>();

    for (const m of raw) {
        const snapshot: ElementSnapshot = {
            selector: m.selector,
            index: m.index,
            rect: {
                x: m.rect.x,
                y: m.rect.y,
                width: m.rect.width,
                height: m.rect.height,
                right: m.rect.x + m.rect.width,
                bottom: m.rect.y + m.rect.height,
                centerX: m.rect.x + m.rect.width / 2,
                centerY: m.rect.y + m.rect.height / 2,
                area: m.rect.width * m.rect.height,
            },
            styles: m.styles,
            computed: m.computed,
        };

        const key = m.selector;
        if (!elements.has(key)) elements.set(key, []);
        elements.get(key)!.push(snapshot);
    }

    // Measure direct children of each container selector
    const childRelationsRaw = await page.evaluate((sels) => {
        const results: { selector: string; parentIndex: number; parentRect: any; childRects: any[] }[] = [];
        for (const selector of sels) {
            const parents = document.querySelectorAll(selector);
            parents.forEach((parent, pi) => {
                const pr = parent.getBoundingClientRect();
                const childRects = Array.from(parent.children).map(c => {
                    const cr = c.getBoundingClientRect();
                    return { x: cr.x, y: cr.y, width: cr.width, height: cr.height };
                });
                if (childRects.length > 0) {
                    results.push({
                        selector,
                        parentIndex: pi,
                        parentRect: { x: pr.x, y: pr.y, width: pr.width, height: pr.height },
                        childRects,
                    });
                }
            });
        }
        return results;
    }, selectors);

    const childRelations = new Map<string, ChildRelation[]>();
    for (const cr of childRelationsRaw) {
        const relation: ChildRelation = {
            parentSelector: cr.selector,
            parentRect: fromDOMRect(cr.parentRect),
            childRects: cr.childRects.map(fromDOMRect),
        };
        if (!childRelations.has(cr.selector)) childRelations.set(cr.selector, []);
        childRelations.get(cr.selector)!.push(relation);
    }

    return {
        width: viewportSize.width,
        height: viewportSize.height,
        elements,
        childRelations,
        timestamp: Date.now(),
    };
}

// measureContainment only measures geometry plus a handful of styles; the
// unmeasured fields fall back to neutral defaults so the ElementSnapshot
// contract holds without a lying cast.
const EMPTY_STYLES: ElementSnapshot['styles'] = {
    fontSize: 0, lineHeight: 0, fontWeight: 400, gap: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    borderRadiusTL: 0, borderRadiusTR: 0, borderRadiusBR: 0, borderRadiusBL: 0,
    minWidth: 0, maxWidth: 0, minHeight: 0, maxHeight: 0,
    zIndex: 0, opacity: 1, outlineWidth: 0, outlineOffset: 0,
};
const EMPTY_COMPUTED: ElementSnapshot['computed'] = {
    display: '', overflow: '', position: '', visibility: '', pointerEvents: '',
    backgroundColor: '', color: '', boxSizing: '', textAlign: '', whiteSpace: '', cursor: '',
};

/**
 * Measure parent-child relationships for containment checks.
 * Returns parent rect + all direct children rects.
 */
export async function measureContainment(
    page: Page,
    parentSelector: string,
    childSelector: string
): Promise<{ parent: ElementSnapshot; children: ElementSnapshot[] }[]> {
    const raw = await page.evaluate(([pSel, cSel]) => {
        const parents = document.querySelectorAll(pSel);
        return Array.from(parents).map((parent) => {
            const pRect = parent.getBoundingClientRect();
            const pCS = getComputedStyle(parent);
            const children = parent.querySelectorAll(cSel);
            return {
                parent: {
                    rect: { x: pRect.x, y: pRect.y, width: pRect.width, height: pRect.height },
                    styles: { fontSize: 0, lineHeight: 0, fontWeight: 400, gap: parseFloat(pCS.gap) || 0, paddingTop: parseFloat(pCS.paddingTop) || 0, paddingRight: parseFloat(pCS.paddingRight) || 0, paddingBottom: parseFloat(pCS.paddingBottom) || 0, paddingLeft: parseFloat(pCS.paddingLeft) || 0 },
                    computed: { display: pCS.display, overflow: pCS.overflow, position: pCS.position },
                },
                children: Array.from(children).map((child, i) => {
                    const cRect = child.getBoundingClientRect();
                    const cCS = getComputedStyle(child);
                    return {
                        index: i,
                        rect: { x: cRect.x, y: cRect.y, width: cRect.width, height: cRect.height },
                        styles: { fontSize: parseFloat(cCS.fontSize) || 0, lineHeight: parseFloat(cCS.lineHeight) || 0, fontWeight: parseFloat(cCS.fontWeight) || 400, gap: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
                        computed: { display: cCS.display, overflow: cCS.overflow, position: cCS.position },
                    };
                }),
            };
        });
    }, [parentSelector, childSelector] as const);

    return raw.map((r) => ({
        parent: {
            selector: parentSelector,
            index: 0,
            rect: { ...r.parent.rect, right: r.parent.rect.x + r.parent.rect.width, bottom: r.parent.rect.y + r.parent.rect.height, centerX: r.parent.rect.x + r.parent.rect.width / 2, centerY: r.parent.rect.y + r.parent.rect.height / 2, area: r.parent.rect.width * r.parent.rect.height },
            styles: { ...EMPTY_STYLES, ...r.parent.styles },
            computed: { ...EMPTY_COMPUTED, ...r.parent.computed },
        },
        children: r.children.map((c, i) => ({
            selector: childSelector,
            index: i,
            rect: { ...c.rect, right: c.rect.x + c.rect.width, bottom: c.rect.y + c.rect.height, centerX: c.rect.x + c.rect.width / 2, centerY: c.rect.y + c.rect.height / 2, area: c.rect.width * c.rect.height },
            styles: { ...EMPTY_STYLES, ...c.styles },
            computed: { ...EMPTY_COMPUTED, ...c.computed },
        })),
    }));
}

/**
 * Measure elements at a specific scroll position.
 * Scrolls to scrollY, waits for layout to settle, then measures.
 */
export async function measureAtScroll(page: Page, selectors: string[], scrollY: number): Promise<ViewportSnapshot> {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(50);

    const snapshot = await measure(page, selectors);
    snapshot.scrollY = scrollY;
    return snapshot;
}

/**
 * Measure an element in normal, hover, and focus states.
 * Returns the element's snapshot under each interaction state.
 */
export async function measureInteraction(
    page: Page,
    selector: string,
    selectors: string[]
): Promise<InteractionSnapshot> {
    // 1. Measure normal state
    const normalSnapshot = await measure(page, selectors);
    const normalElements = normalSnapshot.elements.get(selector);
    const normal = normalElements?.[0];
    if (!normal) {
        throw new Error(`r$: selector "${selector}" not found in page`);
    }

    // 2. Hover state
    await page.hover(selector);
    await page.waitForTimeout(100);
    const hoverSnapshot = await measure(page, selectors);
    const hover = hoverSnapshot.elements.get(selector)?.[0];

    // 3. Focus state
    await page.focus(selector);
    await page.waitForTimeout(100);
    const focusSnapshot = await measure(page, selectors);
    const focus = focusSnapshot.elements.get(selector)?.[0];

    // 4. Reset hover by moving mouse away
    await page.mouse.move(0, 0);

    return {
        selector,
        normal,
        hover,
        focus,
    };
}

/**
 * The ONE in-page collector. `collectPage` is deliberately self-contained —
 * no imports, no closures — so its source can be injected into any page via
 * `Function.prototype.toString()` (Playwright page.evaluate, CDP
 * Runtime.evaluate, agent-browser eval). It returns the serializable wire
 * shape; hydration happens on the node side (wire.ts).
 */

import type { ViewportSnapshotWire, ElementSnapshotWire, ChildRelationWire, RawRect } from './wire.js';

export interface CollectArgs {
    selectors: string[];
    /** Override the reported viewport (defaults to window.innerWidth/Height). */
    width?: number;
    height?: number;
}

/**
 * Runs IN-PAGE. Must stay closure-free: everything it needs arrives via
 * `args` or lives inside the body (enforced by a unit test that evals the
 * serialized source in isolation).
 */
export function collectPage(args: CollectArgs, root?: ParentNode): ViewportSnapshotWire {
    const scope: ParentNode = root ?? document;
    const width = args.width ?? window.innerWidth;
    const height = args.height ?? window.innerHeight;

    // Effective (visible) background: transparent elements inherit whatever
    // ancestor actually paints behind them — without this, contrast checks
    // compare text against a color nobody sees. Semi-transparent backgrounds
    // are returned as-is (no compositing). Memoized per ancestor.
    const isTransparent = (bg: string): boolean =>
        bg === 'transparent' || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(bg) || /\/\s*0\s*\)$/.test(bg);
    const bgCache = new Map<Element, string>();
    const effectiveBackground = (start: Element): string => {
        const chain: Element[] = [];
        let node: Element | null = start;
        let resolved = 'rgb(255, 255, 255)'; // default canvas
        while (node) {
            const cached = bgCache.get(node);
            if (cached !== undefined) {
                resolved = cached;
                break;
            }
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && !isTransparent(bg)) {
                resolved = bg;
                break;
            }
            chain.push(node);
            node = node.parentElement;
        }
        for (const n of chain) bgCache.set(n, resolved);
        return resolved;
    };

    // DOM-semantic interactivity — cursor alone misses native controls
    // (a <button> often has cursor:auto): native tags, interactive roles,
    // or tabindex >= 0, and not disabled.
    const isInteractive = (el: Element): boolean => {
        const tag = el.tagName.toLowerCase();
        if ((el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true') return false;
        if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'summary') return true;
        if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
        if (tag === 'a' && el.hasAttribute('href')) return true;
        const role = el.getAttribute('role');
        if (role && ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'slider', 'combobox', 'textbox', 'option'].indexOf(role) !== -1) return true;
        const tabindex = el.getAttribute('tabindex');
        return tabindex !== null && parseInt(tabindex, 10) >= 0;
    };

    const elements: [string, ElementSnapshotWire[]][] = [];
    const childRelations: [string, ChildRelationWire[]][] = [];

    for (const selector of args.selectors) {
        const snaps: ElementSnapshotWire[] = [];
        const relations: ChildRelationWire[] = [];

        scope.querySelectorAll(selector).forEach((el, index) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const rect: RawRect = { x: r.x, y: r.y, width: r.width, height: r.height };

            snaps.push({
                selector,
                index,
                rect,
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
                    maxWidth: cs.maxWidth === 'none' ? Infinity : parseFloat(cs.maxWidth) || 0,
                    minHeight: parseFloat(cs.minHeight) || 0,
                    maxHeight: cs.maxHeight === 'none' ? Infinity : parseFloat(cs.maxHeight) || 0,
                    zIndex: cs.zIndex === 'auto' ? 0 : parseInt(cs.zIndex) || 0,
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
                    backgroundColor: effectiveBackground(el),
                    color: cs.color,
                    boxSizing: cs.boxSizing,
                    textAlign: cs.textAlign,
                    whiteSpace: cs.whiteSpace,
                    cursor: cs.cursor,
                    tagName: el.tagName.toLowerCase(),
                    interactive: isInteractive(el),
                },
            });

            const childRects: RawRect[] = [];
            for (const c of Array.from(el.children)) {
                const cr = c.getBoundingClientRect();
                childRects.push({ x: cr.x, y: cr.y, width: cr.width, height: cr.height });
            }
            if (childRects.length > 0) {
                relations.push({ parentSelector: selector, parentRect: rect, childRects });
            }
        });

        if (snaps.length > 0) elements.push([selector, snaps]);
        if (relations.length > 0) childRelations.push([selector, relations]);
    }

    return { width, height, elements, childRelations, timestamp: Date.now() };
}

/**
 * The injectable expression: a driver evaluates this string in the page and
 * receives the wire snapshot back (JSON-serializable by construction).
 */
export function buildCollectExpression(args: CollectArgs): string {
    return `(${collectPage.toString()})(${JSON.stringify(args)})`;
}

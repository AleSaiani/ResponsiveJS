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
    /** Scope the query to this selector's subtree — the injectable form of
     *  the `root` parameter (a DOM node cannot cross an eval boundary). */
    within?: string;
    /** Report rects RELATIVE to the `within` root. Component mode: constraints
     *  compare against the harness width, so absolute page coordinates would
     *  make every child look like an overflow. */
    relative?: boolean;
}

/**
 * Runs IN-PAGE. Must stay closure-free: everything it needs arrives via
 * `args` or lives inside the body (enforced by a unit test that evals the
 * serialized source in isolation).
 */
export function collectPage(args: CollectArgs, root?: ParentNode): ViewportSnapshotWire {
    const given: ParentNode = root ?? document;
    const withinEl = args.within ? given.querySelector(args.within) : null;
    const scope: ParentNode = withinEl ?? given;
    // Component mode: the harness rect becomes the origin, so a child at page
    // x=200 inside a 300px harness is measured at x=0, not flagged as overflow.
    const originRect = args.relative && withinEl ? withinEl.getBoundingClientRect() : null;
    const originX = originRect ? originRect.x : 0;
    const originY = originRect ? originRect.y : 0;
    // Cross-document safe: when `root` is another (same-origin) document —
    // the iframe-emulation sweep — styles must come from THAT document's
    // view, and body/html boundaries must be that document's too.
    const doc = (scope as Document).documentElement ? (scope as Document) : (scope.ownerDocument ?? document);
    const view = doc.defaultView ?? window;
    // Free-global fallback: stubbed environments inject getComputedStyle
    // without putting it on the window object.
    const styleOf = (el: Element): CSSStyleDeclaration =>
        typeof view.getComputedStyle === 'function' ? view.getComputedStyle(el) : getComputedStyle(el);
    const width = args.width ?? view.innerWidth;
    const height = args.height ?? view.innerHeight;

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
            const bg = styleOf(node).backgroundColor;
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

    // Nearest ancestor that contains horizontal overflow. html/body are
    // excluded on purpose: overflow-x:hidden there hides the scrollbar but
    // the layout is still broken — that must stay a NAKED overflow.
    const containCache = new Map<Element, 'scroll' | 'clip' | null>();
    const overflowContainment = (start: Element): 'scroll' | 'clip' | null => {
        const chain: Element[] = [];
        let node: Element | null = start.parentElement;
        let found: 'scroll' | 'clip' | null = null;
        while (node && node !== doc.body && node !== doc.documentElement) {
            const hit = containCache.get(node);
            if (hit !== undefined) { found = hit; break; }
            chain.push(node);
            const ox = styleOf(node).overflowX;
            if (ox === 'auto' || ox === 'scroll') { found = 'scroll'; break; }
            if (ox === 'hidden' || ox === 'clip') { found = 'clip'; break; }
            node = node.parentElement;
        }
        for (const n of chain) containCache.set(n, found);
        return found;
    };

    const elements: [string, ElementSnapshotWire[]][] = [];
    const childRelations: [string, ChildRelationWire[]][] = [];

    for (const selector of args.selectors) {
        const snaps: ElementSnapshotWire[] = [];
        const relations: ChildRelationWire[] = [];

        scope.querySelectorAll(selector).forEach((el, index) => {
            const r = el.getBoundingClientRect();
            const cs = styleOf(el);
            const rect: RawRect = { x: r.x - originX, y: r.y - originY, width: r.width, height: r.height };

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
                    overflowContainment: overflowContainment(el) ?? undefined,
                },
            });

            const childRects: RawRect[] = [];
            for (const c of Array.from(el.children)) {
                const cr = c.getBoundingClientRect();
                childRects.push({ x: cr.x - originX, y: cr.y - originY, width: cr.width, height: cr.height });
            }
            if (childRects.length > 0) {
                relations.push({ parentSelector: selector, parentRect: rect, childRects });
            }
        });

        if (snaps.length > 0) elements.push([selector, snaps]);
        if (relations.length > 0) childRelations.push([selector, relations]);
    }

    // Provenance: if the page runs @responsivejs/runtime, ship its manifest
    // with the measurements (the closed loop's transport). `view`, not
    // window: an iframe-emulated sweep wants the MEASURED page's manifest.
    const manifest = (view as unknown as { __rjs_manifest?: unknown }).__rjs_manifest;

    return {
        width,
        height,
        elements,
        childRelations,
        timestamp: Date.now(),
        ...(Array.isArray(manifest) ? { manifest: manifest as ViewportSnapshotWire['manifest'] } : {}),
    };
}

/**
 * The injectable expression: a driver evaluates this string in the page and
 * receives the wire snapshot back (JSON-serializable by construction).
 */
export function buildCollectExpression(args: CollectArgs): string {
    return `(${collectPage.toString()})(${JSON.stringify(args)})`;
}

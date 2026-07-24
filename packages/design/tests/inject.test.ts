import { describe, it, expect } from 'vitest';
import { collectPage, buildCollectExpression } from '../src/browser/inject.js';
import { fromWire } from '../src/browser/wire.js';

/** Minimal DOM stand-ins for evaluating the collector outside a browser. */
function makeFakeDom() {
    const domStub = {
        tagName: 'DIV',
        getAttribute: () => null,
        hasAttribute: () => false,
    };
    const fakeChild = {
        ...domStub,
        getBoundingClientRect: () => ({ x: 12, y: 22, width: 40, height: 20 }),
    };
    const fakeEl = {
        ...domStub,
        getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 50 }),
        children: [fakeChild],
    };
    const styles: Record<string, string> = {
        fontSize: '16px', lineHeight: '24px', fontWeight: '400', gap: '0px',
        paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
        marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
        borderTopLeftRadius: '4px', borderTopRightRadius: '4px',
        borderBottomRightRadius: '4px', borderBottomLeftRadius: '4px',
        minWidth: '0px', maxWidth: 'none', minHeight: '0px', maxHeight: 'none',
        zIndex: 'auto', opacity: '1', outlineWidth: '0px', outlineOffset: '0px',
        display: 'block', overflow: 'visible', position: 'static', visibility: 'visible',
        pointerEvents: 'auto', backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)',
        boxSizing: 'border-box', textAlign: 'left', whiteSpace: 'normal', cursor: 'auto',
    };
    return {
        document: {
            querySelectorAll: (sel: string) => ({
                forEach: (cb: (el: unknown, i: number) => void) => {
                    if (sel === '.hit') cb(fakeEl, 0);
                },
            }),
        },
        window: { innerWidth: 1024, innerHeight: 768 },
        getComputedStyle: () => styles,
    };
}

describe('collectPage source', () => {
    it('is self-contained: no import/require/external identifiers', () => {
        const src = collectPage.toString();
        expect(src).not.toMatch(/\brequire\(/);
        expect(src).not.toMatch(/\bimport\b/);
        expect(src).not.toMatch(/fromDOMRect|expandRect|fromWire/); // no helper leakage
    });

    it('buildCollectExpression embeds the args as JSON', () => {
        const expr = buildCollectExpression({ selectors: ['.a', '.b'], width: 320 });
        expect(expr).toContain('{"selectors":[".a",".b"],"width":320}');
        expect(expr.startsWith('(function')).toBe(true);
    });

    it('the serialized expression evaluates against a stubbed DOM', () => {
        const dom = makeFakeDom();
        const expr = buildCollectExpression({ selectors: ['.hit', '.miss'] });
        const run = new Function('document', 'window', 'getComputedStyle', `return ${expr};`);
        const wire = run(dom.document, dom.window, dom.getComputedStyle);

        expect(wire.width).toBe(1024);
        expect(wire.elements).toHaveLength(1); // only .hit matched
        const [selector, snaps] = wire.elements[0];
        expect(selector).toBe('.hit');
        expect(snaps[0].styles.borderRadiusTL).toBe(4);
        expect(wire.childRelations[0][1][0].childRects[0].width).toBe(40);
    });

    it('the evaluated wire hydrates into a full snapshot', () => {
        const dom = makeFakeDom();
        const expr = buildCollectExpression({ selectors: ['.hit'], width: 500, height: 400 });
        const run = new Function('document', 'window', 'getComputedStyle', `return ${expr};`);
        const snap = fromWire(run(dom.document, dom.window, dom.getComputedStyle));
        expect(snap.width).toBe(500);
        expect(snap.elements.get('.hit')![0].rect.right).toBe(110);
    });
});

describe('collectPage — effective background', () => {
    function domWithAncestors(elBg: string, parentBg: string | null) {
        const styleFor = new Map<unknown, string>();
        const domStub = { tagName: 'DIV', getAttribute: () => null, hasAttribute: () => false };
        const grandparent = { ...domStub, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }), children: [], parentElement: null };
        const parent = { ...domStub, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }), children: [], parentElement: grandparent };
        const el = { ...domStub, getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 50 }), children: [], parentElement: parent };
        styleFor.set(el, elBg);
        if (parentBg) styleFor.set(parent, parentBg);
        const base = makeFakeDom();
        return {
            el,
            document: {
                querySelectorAll: (sel: string) => ({
                    forEach: (cb: (e: unknown, i: number) => void) => {
                        if (sel === '.t') cb(el, 0);
                    },
                }),
            },
            window: base.window,
            getComputedStyle: (node: unknown) => ({
                ...(base.getComputedStyle() as Record<string, string>),
                backgroundColor: styleFor.get(node) ?? 'rgba(0, 0, 0, 0)',
            }),
        };
    }

    function measuredBg(dom: ReturnType<typeof domWithAncestors>): string {
        const expr = buildCollectExpression({ selectors: ['.t'] });
        const run = new Function('document', 'window', 'getComputedStyle', `return ${expr};`);
        const wire = run(dom.document, dom.window, dom.getComputedStyle);
        return wire.elements[0][1][0].computed.backgroundColor;
    }

    it('transparent elements inherit the first painted ancestor background', () => {
        const dom = domWithAncestors('rgba(0, 0, 0, 0)', 'rgb(20, 20, 20)');
        expect(measuredBg(dom)).toBe('rgb(20, 20, 20)');
    });

    it('an element with its own background keeps it', () => {
        const dom = domWithAncestors('rgb(200, 0, 0)', 'rgb(20, 20, 20)');
        expect(measuredBg(dom)).toBe('rgb(200, 0, 0)');
    });

    it('a fully transparent chain falls back to the white canvas', () => {
        const dom = domWithAncestors('rgba(0, 0, 0, 0)', null);
        expect(measuredBg(dom)).toBe('rgb(255, 255, 255)');
    });
});

// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { geometry, whenWraps, whenOverflows, whenTruncated, whenStuck, linesOf, whenCollides } from '../src/geometry.js';
import { __resetViewportHub } from '../src/viewport.js';
import { installResizeObserverStub, tick } from './helpers.js';

type Rect = Partial<DOMRect>;

/** happy-dom does no layout: geometry comes from stubbed rects/scroll metrics. */
function stubRect(el: Element, rect: Rect): void {
    el.getBoundingClientRect = () =>
        ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect }) as DOMRect;
}

function stubScrollBox(el: Element, box: { sw?: number; cw?: number; sh?: number; ch?: number }): void {
    Object.defineProperties(el, {
        scrollWidth: { value: box.sw ?? 0, configurable: true },
        clientWidth: { value: box.cw ?? 0, configurable: true },
        scrollHeight: { value: box.sh ?? 0, configurable: true },
        clientHeight: { value: box.ch ?? 0, configurable: true },
    });
}

function make(tag = 'div', parent: Element = document.body): HTMLElement {
    const el = document.createElement(tag);
    parent.appendChild(el);
    return el;
}

let ro: ReturnType<typeof installResizeObserverStub>;

beforeEach(() => {
    document.body.innerHTML = '';
    ro = installResizeObserverStub();
});

afterEach(() => {
    __resetViewportHub();
    ro.uninstall();
});

describe('predicate measures', () => {
    it('whenWraps: true when a child starts below the first row', () => {
        const nav = make();
        const a = make('span', nav);
        const b = make('span', nav);
        stubRect(a, { top: 0, bottom: 20 });
        stubRect(b, { top: 24, bottom: 44 }); // second row
        expect(whenWraps().measure(nav)).toBe(true);

        stubRect(b, { top: 0, bottom: 20 }); // same row
        expect(whenWraps().measure(nav)).toBe(false);
    });

    it('whenWraps: single child never wraps', () => {
        const nav = make();
        make('span', nav);
        expect(whenWraps().measure(nav)).toBe(false);
    });

    it('whenOverflows: per-axis scroll vs client comparison', () => {
        const box = make();
        stubScrollBox(box, { sw: 400, cw: 320, sh: 100, ch: 100 });
        expect(whenOverflows().measure(box)).toBe(true); // x default
        expect(whenOverflows('y').measure(box)).toBe(false);
        expect(whenOverflows('both').measure(box)).toBe(true);
    });

    it('whenTruncated: needs BOTH clipped overflow and excess content', () => {
        const text = make();
        stubScrollBox(text, { sw: 400, cw: 320 });
        text.style.overflowX = 'hidden';
        expect(whenTruncated().measure(text)).toBe(true);

        text.style.overflowX = 'auto'; // scrollable ≠ truncated
        expect(whenTruncated().measure(text)).toBe(false);
    });

    it('whenStuck: sticky pinned at its top offset while the parent scrolled past', () => {
        const container = make();
        const sticky = make('div', container);
        sticky.style.position = 'sticky';
        sticky.style.top = '10px';
        stubRect(container, { top: -500, bottom: 800 });
        stubRect(sticky, { top: 10, bottom: 60 });
        expect(whenStuck().measure(sticky)).toBe(true);

        stubRect(container, { top: 40, bottom: 800 }); // not yet scrolled past
        stubRect(sticky, { top: 40, bottom: 90 });
        expect(whenStuck().measure(sticky)).toBe(false);

        sticky.style.position = 'static';
        expect(whenStuck().measure(sticky)).toBe(false);
    });

    it('linesOf: content height / line height, padding excluded', () => {
        const p = make('p');
        p.style.lineHeight = '20px';
        p.style.paddingTop = '10px';
        p.style.paddingBottom = '10px';
        stubRect(p, { height: 80 }); // (80 - 20) / 20 = 3
        expect(linesOf().measure(p)).toBe(3);
    });

    it('whenCollides: rect intersection with another element (selector or node)', () => {
        const a = make();
        const b = make();
        b.id = 'other';
        stubRect(a, { left: 0, right: 100, top: 0, bottom: 50 });
        stubRect(b, { left: 80, right: 180, top: 20, bottom: 70 });
        expect(whenCollides('#other').measure(a)).toBe(true);
        expect(whenCollides(b).measure(a)).toBe(true);

        stubRect(b, { left: 120, right: 220, top: 20, bottom: 70 });
        expect(whenCollides(b).measure(a)).toBe(false);
    });
});

describe('geometry() — attributes in sync', () => {
    it('sets boolean attributes by presence and numeric ones by value', () => {
        const nav = make();
        nav.className = 'nav';
        const a = make('span', nav);
        const b = make('span', nav);
        stubRect(a, { top: 0, bottom: 20 });
        stubRect(b, { top: 24, bottom: 44 });
        stubScrollBox(nav, { sw: 300, cw: 300 });
        nav.style.lineHeight = '20px';
        stubRect(nav, { height: 40 });

        const handle = geometry('.nav', { wrapped: whenWraps, lines: linesOf() });
        handle.measure();

        expect(nav.hasAttribute('data-wrapped')).toBe(true);
        expect(nav.getAttribute('data-lines')).toBe('2');

        stubRect(b, { top: 0, bottom: 20 }); // un-wrap
        handle.measure();
        expect(nav.hasAttribute('data-wrapped')).toBe(false);
        handle.dispose();
    });

    it('re-measures when the element resizes (shared ResizeObserver)', async () => {
        const box = make();
        box.className = 'box';
        stubScrollBox(box, { sw: 400, cw: 320 });

        const handle = geometry(box, { crowded: whenOverflows() });
        await tick();
        expect(box.hasAttribute('data-crowded')).toBe(true);

        stubScrollBox(box, { sw: 400, cw: 500 }); // grew: no overflow
        ro.resize(box, 500, 100);
        await tick();
        expect(box.hasAttribute('data-crowded')).toBe(false);
        handle.dispose();
    });

    it('camelCase state names become kebab-case attributes', async () => {
        const box = make();
        stubScrollBox(box, { sw: 400, cw: 320 });
        const handle = geometry(box, { tooCrowded: whenOverflows() });
        handle.measure();
        expect(box.hasAttribute('data-too-crowded')).toBe(true);
        handle.dispose();
    });

    it('pause stops updates; resume re-measures; dispose removes attributes', async () => {
        const box = make();
        stubScrollBox(box, { sw: 400, cw: 320 });
        const handle = geometry(box, { crowded: whenOverflows() });
        handle.measure();
        expect(box.hasAttribute('data-crowded')).toBe(true);

        handle.pause();
        stubScrollBox(box, { sw: 400, cw: 500 });
        ro.resize(box, 500, 100);
        await tick();
        expect(box.hasAttribute('data-crowded')).toBe(true); // frozen

        handle.resume();
        expect(box.hasAttribute('data-crowded')).toBe(false);

        stubScrollBox(box, { sw: 400, cw: 320 });
        handle.measure();
        expect(box.hasAttribute('data-crowded')).toBe(true);
        handle.dispose();
        expect(box.hasAttribute('data-crowded')).toBe(false); // cleaned
    });

    it('scroll-sensitive predicates re-measure on scroll', async () => {
        const container = make();
        const sticky = make('div', container);
        sticky.style.position = 'sticky';
        sticky.style.top = '0px';
        stubRect(container, { top: 100, bottom: 900 });
        stubRect(sticky, { top: 100, bottom: 150 });

        const handle = geometry(sticky, { stuck: whenStuck() });
        await tick();
        expect(sticky.hasAttribute('data-stuck')).toBe(false);

        stubRect(container, { top: -200, bottom: 600 }); // scrolled past
        stubRect(sticky, { top: 0, bottom: 50 });
        document.dispatchEvent(new Event('scroll'));
        await tick();
        expect(sticky.hasAttribute('data-stuck')).toBe(true);
        handle.dispose();
    });

    it('dispose releases the shared observer entries', async () => {
        const box = make();
        stubScrollBox(box, { sw: 0, cw: 100 });
        const handle = geometry(box, { crowded: whenOverflows() });
        await tick();
        expect(ro.observedCount()).toBe(1);
        handle.dispose();
        expect(ro.observedCount()).toBe(0);
    });
});

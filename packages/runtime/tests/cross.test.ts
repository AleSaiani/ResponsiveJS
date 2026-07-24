// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { fromElement, sync, ratio } from '../src/cross.js';
import { fluid } from '../src/value.js';
import { responsive } from '../src/index.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';
import { installResizeObserverStub, tick } from './helpers.js';

function setWidth(w: number) {
    (window as { innerWidth: number }).innerWidth = w;
    window.dispatchEvent(new Event('resize'));
}

function make(cls: string, rect: Partial<DOMRect> = {}): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.getBoundingClientRect = () =>
        ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect }) as DOMRect;
    document.body.appendChild(el);
    return el;
}

let ro: ReturnType<typeof installResizeObserverStub>;

beforeEach(() => {
    document.body.innerHTML = '';
    ro = installResizeObserverStub();
    configure({ breakpoints: [200, 600] });
});

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
    ro.uninstall();
});

describe('fromElement — cross-element fluid domain', () => {
    it('the value follows the SOURCE element width, not the viewport', async () => {
        setWidth(1920); // viewport is huge — must not matter
        const sidebar = make('sidebar', { width: 200 });
        const title = make('title');

        // domain [200, 600]: sidebar at 200 → min, at 600 → max
        responsive.dynamic(title, {
            fontSize: fluid(14, 18, { domain: fromElement('.sidebar'), from: 200, to: 600 }),
        });
        responsive.flush();
        expect(title.style.getPropertyValue('font-size')).toBe('14px');

        ro.resize(sidebar, 600, 0);
        await tick();
        responsive.flush();
        expect(title.style.getPropertyValue('font-size')).toBe('18px');
    });

    it('element-driven values never emit static CSS', () => {
        const v = fluid(14, 18, { domain: fromElement('.x') });
        expect(
            v.toStatic({ selector: '.t', property: 'font-size', domain: { min: 200, max: 600 }, breakpoints: [200, 600], container: false, unit: 'px' }),
        ).toBeNull();
    });

    it('a missing source element throws with the selector in the message', () => {
        const title = make('title');
        expect(() => responsive.dynamic(title, { fontSize: fluid(14, 18, { domain: fromElement('.nope') }) })).toThrow(
            /fromElement\('\.nope'\)/,
        );
    });
});

describe('sync — equal sizes across containers', () => {
    it('applies the max natural height to every element', () => {
        const a = make('card', { height: 120 });
        const b = make('card', { height: 180 });
        const c = make('card', { height: 150 });

        const handle = sync('.card', 'height');
        expect(a.style.getPropertyValue('height')).toBe('180px');
        expect(b.style.getPropertyValue('height')).toBe('180px');
        expect(c.style.getPropertyValue('height')).toBe('180px');

        handle.dispose();
        expect(a.style.getPropertyValue('height')).toBe(''); // constraint lifted
    });

    it('re-measures on viewport resize and via measure()', async () => {
        const a = make('card', { height: 100 });
        const b = make('card', { height: 140 });
        const handle = sync('.card');
        expect(a.style.getPropertyValue('height')).toBe('140px');

        b.getBoundingClientRect = () => ({ height: 90 }) as DOMRect;
        a.getBoundingClientRect = () => ({ height: 100 }) as DOMRect;
        setWidth(500);
        await tick();
        expect(b.style.getPropertyValue('height')).toBe('100px');
        handle.dispose();
    });

    it('fewer than two matches is inert', () => {
        make('solo', { height: 50 });
        const handle = sync('.solo');
        expect(handle.measure).toBeDefined(); // no throw, no-op
        handle.dispose();
    });
});

describe('ratio — active width-ratio enforcement', () => {
    it('constrains a when the ratio leaves the bounds, frees it inside', () => {
        const sidebar = make('side', { width: 100 });
        make('main', { width: 1000 });

        const handle = ratio('.side', '.main', { min: 0.2, max: 0.33 });
        // 100/1000 = 0.1 < 0.2 → width forced to 0.2 * 1000
        expect(sidebar.style.getPropertyValue('width')).toBe('200px');

        sidebar.getBoundingClientRect = () => ({ width: 250 }) as DOMRect; // 0.25: inside
        handle.measure();
        expect(sidebar.style.getPropertyValue('width')).toBe('');

        sidebar.getBoundingClientRect = () => ({ width: 500 }) as DOMRect; // 0.5 > 0.33
        handle.measure();
        expect(sidebar.style.getPropertyValue('width')).toBe('330px');

        handle.dispose();
        expect(sidebar.style.getPropertyValue('width')).toBe('');
    });
});

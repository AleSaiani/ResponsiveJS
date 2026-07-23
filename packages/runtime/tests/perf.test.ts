// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { responsive, fluid } from '../src/index.js';
import { memo } from '../src/perf.js';
import { custom, isResponsiveValue, type ResponsiveValue } from '../src/value.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig } from '../src/config.js';

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
});

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

describe('memo', () => {
    it('caches function values per quantized width', () => {
        const fn = vi.fn((w: number) => w * 2);
        const map = memo({ width: fn });
        const v = map.width as ResponsiveValue;
        expect(isResponsiveValue(v)).toBe(true);
        expect(v.resolve(500)).toBe(1000);
        expect(v.resolve(500.4)).toBe(1000); // same 1px bucket
        expect(fn).toHaveBeenCalledTimes(1);
        expect(v.resolve(600)).toBe(1200);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('leaves non-function values untouched', () => {
        const original = fluid(1, 2);
        const map = memo({ fontSize: original, display: 'grid' });
        expect(map.fontSize).toBe(original);
        expect(map.display).toBe('grid');
    });

    it('does not wrap ResponsiveValues even though they are objects', () => {
        const v = custom((w) => w);
        expect(memo({ x: v }).x).toBe(v);
    });
});

describe('batch', () => {
    it('applies multiple responsive() calls with a single synchronous flush', () => {
        const a = document.createElement('div');
        const b = document.createElement('div');
        document.body.append(a, b);
        responsive.batch(() => {
            responsive.dynamic(a, { margin: 4 });
            responsive.dynamic(b, { margin: 8 });
        });
        // batch() ends with an explicit flush — styles are already applied.
        expect(a.style.getPropertyValue('margin')).toBe('4px');
        expect(b.style.getPropertyValue('margin')).toBe('8px');
    });
});

describe('lazy', () => {
    it('falls back to immediate application without IntersectionObserver', () => {
        const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
        (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
        const el = document.createElement('div');
        document.body.appendChild(el);
        const handle = responsive.lazy(el, { margin: 6 });
        responsive.flush();
        expect(el.style.getPropertyValue('margin')).toBe('6px');
        handle.dispose();
        (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    });

    it('with IntersectionObserver applies only on first intersection', () => {
        let callback: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
        const observed: Element[] = [];
        (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
            constructor(cb: typeof callback) {
                callback = cb;
            }
            observe(el: Element) {
                observed.push(el);
            }
            unobserve() {}
            disconnect() {}
        };

        const el = document.createElement('div');
        document.body.appendChild(el);
        const handle = responsive.lazy(el, { margin: 10 });
        responsive.flush();
        expect(el.style.getPropertyValue('margin')).toBe(''); // not yet visible
        callback([{ target: el, isIntersecting: true }]);
        responsive.flush();
        expect(el.style.getPropertyValue('margin')).toBe('10px');
        handle.dispose();
        delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    });
});

describe('debug', () => {
    it('logs resolved values when enabled', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const el = document.createElement('div');
        document.body.appendChild(el);
        responsive.debug(true);
        responsive.dynamic(el, { margin: 4 });
        responsive.flush();
        expect(spy).toHaveBeenCalled();
        expect(String(spy.mock.calls[0][0])).toContain('[r$]');
        responsive.debug(false);
        spy.mockRestore();
    });
});

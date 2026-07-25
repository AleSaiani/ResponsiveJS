// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { responsive, fluid, custom, breakpoint } from '../src/index.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';
import { tick } from './helpers.js';

function setWidth(w: number) {
    (window as { innerWidth: number }).innerWidth = w;
    window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
});

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

function el(cls = 'box'): HTMLElement {
    const div = document.createElement('div');
    div.className = cls;
    document.body.appendChild(div);
    return div;
}

describe('responsive() — dynamic application', () => {
    it('applies resolved styles after flush', () => {
        setWidth(320);
        const target = el();
        responsive.dynamic(target, { fontSize: fluid(16, 32) });
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('16px');
    });

    it('reacts to viewport resizes', async () => {
        setWidth(320);
        const target = el();
        responsive.dynamic(target, { fontSize: fluid(16, 32) });
        responsive.flush();
        setWidth(1920);
        await tick();
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('32px');
    });

    it('coalesces multiple resizes into one write per frame', async () => {
        setWidth(320);
        const target = el();
        let writes = 0;
        const original = target.style.setProperty.bind(target.style);
        target.style.setProperty = (p: string, v: string) => {
            writes++;
            original(p, v);
        };
        responsive.dynamic(target, { fontSize: fluid(16, 32) });
        responsive.flush();
        writes = 0;
        setWidth(500);
        setWidth(900);
        setWidth(1400);
        await tick();
        responsive.flush();
        expect(writes).toBe(1);
    });

    it('handles custom functions and string values', () => {
        setWidth(1000);
        const target = el();
        responsive.dynamic(target, {
            width: custom((w) => w / 2),
            display: 'grid',
        });
        responsive.flush();
        expect(target.style.getPropertyValue('width')).toBe('500px');
        expect(target.style.getPropertyValue('display')).toBe('grid');
    });

    it('applies unitless props without unit', () => {
        setWidth(320);
        const target = el();
        responsive.dynamic(target, { opacity: fluid(0.5, 1), fontWeight: 400 });
        responsive.flush();
        expect(target.style.getPropertyValue('opacity')).toBe('0.5');
        expect(target.style.getPropertyValue('font-weight')).toBe('400');
    });

    it('accepts selector targets', () => {
        setWidth(320);
        el('multi');
        el('multi');
        responsive.dynamic('.multi', { margin: 8 });
        responsive.flush();
        for (const target of document.querySelectorAll<HTMLElement>('.multi')) {
            expect(target.style.getPropertyValue('margin')).toBe('8px');
        }
    });
});

describe('responsive() — CSS-first split', () => {
    it('injects static CSS and drives only the dynamic rest via JS', () => {
        setWidth(320);
        el('hero');
        responsive('.hero', {
            fontSize: fluid(16, 32), // static → clamp
            padding: fluid(8, 32, { curve: 'ease-in' }), // dynamic
        });
        responsive.flush();
        const style = document.head.querySelector('style[data-responsivejs]');
        expect(style?.textContent).toContain('font-size: clamp(');
        const target = document.querySelector<HTMLElement>('.hero')!;
        expect(target.style.getPropertyValue('font-size')).toBe(''); // NOT inline
        expect(target.style.getPropertyValue('padding')).toBe('8px'); // JS-driven
    });

    it('responsive.static throws when the map needs JS', () => {
        expect(() => responsive.static('.el', { width: custom((w) => w) })).toThrow(/cannot be expressed/);
    });

    it('responsive.static returns and injects pure CSS, with its own disposer', () => {
        const handle = responsive.static('.title', { fontSize: fluid(16, 32) });
        expect(handle.css).toContain('clamp');
        expect(document.head.querySelector('style[data-responsivejs]')?.textContent).toBe(handle.css);
        handle.dispose();
        expect(document.head.querySelector('style[data-responsivejs]')).toBeNull();
    });

    it('two static maps for the same selector do NOT clobber each other', () => {
        // Regression: the style key was derived from the selector alone, so the
        // second call overwrote the first — contradicting the ownership model.
        const a = responsive.static('.card', { fontSize: fluid(16, 32) });
        const b = responsive.static('.card', { padding: fluid(8, 16) });
        const sheets = [...document.head.querySelectorAll('style[data-responsivejs]')].map((s) => s.textContent ?? '');
        expect(sheets).toHaveLength(2);
        expect(sheets.some((s) => s.includes('font-size'))).toBe(true);
        expect(sheets.some((s) => s.includes('padding'))).toBe(true);
        a.dispose();
        b.dispose();
    });

    it('breakpoint switches go fully static through responsive()', () => {
        setWidth(320);
        el('nav');
        responsive('.nav', { display: breakpoint.below(768, 'none', 'flex') });
        responsive.flush();
        const target = document.querySelector<HTMLElement>('.nav')!;
        expect(target.style.getPropertyValue('display')).toBe('');
        expect(document.head.querySelector('style[data-responsivejs]')?.textContent).toContain('@media (min-width: 768px)');
    });

    it('useMediaQueries=false disables the split', () => {
        configure({ useMediaQueries: false });
        setWidth(320);
        const target = el();
        responsive(target, { fontSize: fluid(16, 32) });
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('16px'); // inline, no stylesheet
    });
});

describe('handle lifecycle', () => {
    it('update replaces the map', () => {
        setWidth(320);
        const target = el();
        const handle = responsive.dynamic(target, { margin: 4 });
        responsive.flush();
        handle.update({ margin: 12 });
        responsive.flush();
        expect(target.style.getPropertyValue('margin')).toBe('12px');
    });

    it('pause stops updates, resume re-applies', async () => {
        setWidth(320);
        const target = el();
        const handle = responsive.dynamic(target, { fontSize: fluid(16, 32) });
        responsive.flush();
        handle.pause();
        setWidth(1920);
        await tick();
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('16px'); // frozen
        handle.resume();
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('32px');
    });

    it('dispose removes inline styles, injected CSS and stops reacting', async () => {
        setWidth(320);
        el('gone');
        const handle = responsive('.gone', {
            fontSize: fluid(16, 32, { curve: 'ease-in' }),
            padding: fluid(4, 8),
        });
        responsive.flush();
        handle.dispose();
        const target = document.querySelector<HTMLElement>('.gone')!;
        expect(target.style.getPropertyValue('font-size')).toBe('');
        expect(document.head.querySelector('style[data-responsivejs]')).toBeNull();
        setWidth(1920);
        await tick();
        responsive.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('');
    });
});

describe('container-bound values', () => {
    it('sets container-type on the parent and resolves against container width', async () => {
        const { installResizeObserverStub } = await import('./helpers.js');
        const stub = installResizeObserverStub();
        __resetViewportHub();
        const parent = document.createElement('div');
        const child = document.createElement('div');
        parent.appendChild(child);
        document.body.appendChild(parent);

        responsive.dynamic(child, { fontSize: fluid(10, 20, { container: true, from: 0, to: 1000 }) });
        expect(parent.style.containerType).toBe('inline-size');
        stub.resize(parent, 500);
        await tick();
        responsive.flush();
        expect(child.style.getPropertyValue('font-size')).toBe('15px');
        stub.uninstall();
    });
});

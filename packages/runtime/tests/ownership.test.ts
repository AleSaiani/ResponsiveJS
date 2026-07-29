// @vitest-environment happy-dom
/** Regression tests for the 2026-07-24 review: handle ownership. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { r$ } from '../src/index.js';
import { sync, ratio } from '../src/cross.js';
import { tokens } from '../src/tokens.js';
import { fluid } from '../src/value.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';

function setWidth(w: number) {
    (window as { innerWidth: number }).innerWidth = w;
    window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    document.documentElement.removeAttribute('style');
    configure({ breakpoints: [320, 1920] });
    setWidth(320);
});

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

function el(cls = 'x', parent: HTMLElement = document.body): HTMLElement {
    const div = document.createElement('div');
    div.className = cls;
    parent.appendChild(div);
    return div;
}

describe('handles never share stylesheets', () => {
    it('two handles on the same selector own separate styles; disposing one keeps the other', () => {
        el('x');
        const a = r$('.x', { color: 'red', fontSize: fluid(10, 20) });
        const b = r$('.x', { padding: fluid(4, 8) });

        const styles = document.head.querySelectorAll('style[data-responsivejs]');
        expect(styles).toHaveLength(2); // review repro: used to be ONE shared

        a.dispose();
        const left = document.head.querySelectorAll('style[data-responsivejs]');
        expect(left).toHaveLength(1);
        expect(left[0].textContent).toContain('padding'); // b's style survived
        b.dispose();
        expect(document.head.querySelectorAll('style[data-responsivejs]')).toHaveLength(0);
    });
});

describe('update() drops stale properties', () => {
    it('switching {margin} → {padding} removes the applied margin', () => {
        const target = el();
        const h = r$.dynamic(target, { margin: 4 });
        r$.flush();
        expect(target.style.getPropertyValue('margin')).toBe('4px');

        h.update({ padding: 8 });
        r$.flush();
        expect(target.style.getPropertyValue('margin')).toBe(''); // review repro: used to linger
        expect(target.style.getPropertyValue('padding')).toBe('8px');
        h.dispose();
    });
});

describe('dispose restores pre-existing inline styles', () => {
    it('an inline font-size set before the handle comes back after dispose', () => {
        const target = el();
        target.style.setProperty('font-size', '99px');
        const h = r$.dynamic(target, { fontSize: fluid(10, 20) });
        r$.flush();
        expect(target.style.getPropertyValue('font-size')).toBe('10px');

        h.dispose();
        expect(target.style.getPropertyValue('font-size')).toBe('99px'); // review repro: was removed
    });

    it('properties we introduced are removed cleanly', () => {
        const target = el();
        const h = r$.dynamic(target, { padding: 8 });
        r$.flush();
        h.dispose();
        expect(target.style.getPropertyValue('padding')).toBe('');
    });
});

describe('container-type ownership', () => {
    it('the static container path configures the parent (review finding 3)', () => {
        const parent = el('wrap');
        el('inner', parent);
        // linear + container → fully static CSS (cqi), but the parent still
        // needs container-type: the handle sets it.
        const h = r$('.inner', { fontSize: fluid(14, 18, { container: true, from: 200, to: 900 }) });
        expect(parent.style.containerType).toBe('inline-size');
        h.dispose();
        expect(parent.style.containerType).toBe('');
    });

    it('is refcounted across handles and never steals a user declaration', () => {
        const parent = el('wrap');
        const inner = el('inner', parent);
        const a = r$.dynamic(inner, { width: fluid(10, 20, { container: true, from: 200, to: 900, curve: 'exponential' }) });
        const b = r$.dynamic(inner, { height: fluid(10, 20, { container: true, from: 200, to: 900, curve: 'exponential' }) });
        expect(parent.style.containerType).toBe('inline-size');
        a.dispose();
        expect(parent.style.containerType).toBe('inline-size'); // b still needs it
        b.dispose();
        expect(parent.style.containerType).toBe('');

        // user-owned declaration is never removed
        parent.style.containerType = 'size';
        const c = r$.dynamic(inner, { width: fluid(10, 20, { container: true, from: 200, to: 900, curve: 'exponential' }) });
        c.dispose();
        expect(parent.style.containerType).toBe('size');
    });
});

describe('sync/ratio/tokens restore what they overrode', () => {
    it('sync restores pre-existing inline heights on dispose', () => {
        const a = el('card');
        const b = el('card');
        a.style.setProperty('height', '50px');
        a.getBoundingClientRect = () => ({ height: 100 }) as DOMRect;
        b.getBoundingClientRect = () => ({ height: 140 }) as DOMRect;

        const h = sync('.card', 'height');
        expect(a.style.getPropertyValue('height')).toBe('140px');
        h.dispose();
        expect(a.style.getPropertyValue('height')).toBe('50px');
        expect(b.style.getPropertyValue('height')).toBe('');
    });

    it('ratio restores the constrained width on dispose', () => {
        const side = el('side');
        const main = el('main');
        side.style.setProperty('width', '77px');
        side.getBoundingClientRect = () => ({ width: 100 }) as DOMRect;
        main.getBoundingClientRect = () => ({ width: 1000 }) as DOMRect;

        const h = ratio('.side', '.main', { min: 0.2 });
        expect(side.style.getPropertyValue('width')).toBe('200px');
        h.dispose();
        expect(side.style.getPropertyValue('width')).toBe('77px');
    });

    it('tokens restore a pre-existing :root variable on dispose', () => {
        document.documentElement.style.setProperty('--font-hero', '13px');
        const h = tokens({ '--font-hero': fluid(24, 48, { curve: 'exponential' }) });
        expect(document.documentElement.style.getPropertyValue('--font-hero')).toBe('24px');
        h.dispose();
        expect(document.documentElement.style.getPropertyValue('--font-hero')).toBe('13px');
    });
});

// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { responsive, fluid } from '../src/index.js';
import { parseUtilities } from '../src/template.js';
import { isResponsiveValue, type ResponsiveValue } from '../src/value.js';
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

describe('tagged template', () => {
    it('a unit suffix is FOLDED into the value, keeping it CSS-first', () => {
        (window as { innerWidth: number }).innerWidth = 320;
        const el = document.createElement('div');
        el.className = 'card';
        document.body.appendChild(el);

        const handle = responsive`
            .card {
                font-size: ${fluid(14, 24)}px;
                display: block;
            }
        `;
        responsive.flush();

        // `${fluid(14,24)}px` used to degrade to a JS-only concatenation — the
        // flagship template example silently lost the CSS-first guarantee.
        // Now the unit belongs to the value and it compiles to clamp().
        const sheet = document.head.querySelector('style[data-responsivejs]')?.textContent ?? '';
        expect(sheet).toContain('clamp(14px');
        expect(el.style.getPropertyValue('font-size')).toBe(''); // no inline write needed
        handle.dispose();
    });

    it('a non-default unit survives both halves (rem stays rem)', () => {
        (window as { innerWidth: number }).innerWidth = 320;
        const el = document.createElement('div');
        el.className = 'lede';
        document.body.appendChild(el);

        const handle = responsive`.lede { font-size: ${fluid(1, 2)}rem; }`;
        responsive.flush();
        expect(document.head.querySelector('style[data-responsivejs]')?.textContent).toContain('clamp(1rem');
        handle.dispose();
    });

    it('genuinely mixed content stays JS-driven (CSS cannot express it)', () => {
        (window as { innerWidth: number }).innerWidth = 320;
        const el = document.createElement('div');
        el.className = 'mixed';
        document.body.appendChild(el);

        const handle = responsive`.mixed { border: ${fluid(1, 4)}px solid red; }`;
        responsive.flush();
        expect(el.style.getPropertyValue('border')).toBe('1px solid red');
        handle.dispose();
    });

    it('rejects placeholders in selector position', () => {
        expect(() => responsive`${fluid(1, 2)} { margin: 0 }`).toThrow(/value position/);
    });

    it('rejects at-rules', () => {
        expect(() => responsive`@media (min-width: 5px) { .x { margin: 0 } }`).toThrow(/at-rules/);
    });

    it('rejects non-ResponsiveValue interpolations', () => {
        expect(() => responsive`.x { margin: ${42 as never}px }`).toThrow(/ResponsiveValues/);
    });

    it('rejects garbage input', () => {
        expect(() => responsive`not css at all`).toThrow(/could not parse/);
    });
});

describe('responsive.apply utility grammar', () => {
    it('parses text sizes into fontSize fluid', () => {
        const map = parseUtilities('text-fluid-sm-xl');
        const v = map.fontSize as ResponsiveValue;
        expect(isResponsiveValue(v)).toBe(true);
        expect(v.resolve(320)).toBe(14);
        expect(v.resolve(1920)).toBe(20);
    });

    it('parses space levels into padding fluid', () => {
        const map = parseUtilities('p-fluid-2-8');
        const v = map.padding as ResponsiveValue;
        expect(v.resolve(320)).toBe(12); // level 2 = 8·1.5
    });

    it('parses colors (named and hex)', () => {
        const map = parseUtilities('bg-fluid-red-blue');
        const v = map.backgroundColor as ResponsiveValue;
        expect(v.resolve(320)).toBe('rgb(255 0 0)');
        expect(v.resolve(1920)).toBe('rgb(0 0 255)');
    });

    it('combines multiple utilities', () => {
        const map = parseUtilities('text-fluid-sm-xl p-fluid-2-8 gap-fluid-1-3');
        expect(Object.keys(map).sort()).toEqual(['fontSize', 'gap', 'padding']);
    });

    it('throws on unknown alias, size, color, or malformed token', () => {
        expect(() => parseUtilities('border-fluid-1-2')).toThrow(/unknown alias|unparseable/);
        expect(() => parseUtilities('text-fluid-tiny-huge')).toThrow(/unknown text size/i);
        expect(() => parseUtilities('bg-fluid-cerulean-red')).toThrow(/unknown color/);
        expect(() => parseUtilities('text-sm')).toThrow(/unparseable/);
    });

    it('applies to a live element', () => {
        (window as { innerWidth: number }).innerWidth = 320;
        const el = document.createElement('div');
        document.body.appendChild(el);
        const handle = responsive.apply(el, 'text-fluid-sm-xl');
        responsive.flush();
        expect(el.style.getPropertyValue('font-size')).toBe('14px');
        handle.dispose();
    });
});

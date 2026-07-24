// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { tokens } from '../src/tokens.js';
import { fluid } from '../src/value.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';
import { tick } from './helpers.js';

function setWidth(w: number) {
    (window as { innerWidth: number }).innerWidth = w;
    window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    document.documentElement.removeAttribute('style');
    configure({ breakpoints: [320, 1920] });
});

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

describe('responsive.tokens()', () => {
    it('linear fluid compiles to a static clamp() on :root — zero JS', () => {
        const handle = tokens({ '--space-md': fluid(8, 16) });
        expect(handle.css).toContain(':root');
        expect(handle.css).toContain('--space-md: clamp(');
        expect(handle.dynamic).toEqual([]);
        const style = document.head.querySelector('style[data-responsivejs]');
        expect(style?.textContent).toContain('--space-md');
        handle.dispose();
        expect(document.head.querySelector('style[data-responsivejs]')).toBeNull();
    });

    it('non-linear curves become JS-driven variables updated on resize', async () => {
        setWidth(320);
        const handle = tokens({ '--font-hero': fluid(24, 48, { curve: 'exponential' }) });
        expect(handle.dynamic).toEqual(['--font-hero']);
        expect(document.documentElement.style.getPropertyValue('--font-hero')).toBe('24px');

        setWidth(1920);
        await tick();
        expect(document.documentElement.style.getPropertyValue('--font-hero')).toBe('48px');

        handle.dispose();
        expect(document.documentElement.style.getPropertyValue('--font-hero')).toBe('');
    });

    it('rejects names without the -- prefix', () => {
        expect(() => tokens({ 'space-md': fluid(8, 16) } as never)).toThrow(/custom property/);
    });

    it('toDTCG exports static values verbatim and samples dynamic curves', () => {
        setWidth(320);
        const handle = tokens({
            '--space-md': fluid(8, 16),
            '--font-hero': fluid(24, 48, { curve: 'exponential' }),
        });
        const dtcg = handle.toDTCG();

        expect(dtcg['space-md'].$type).toBe('dimension');
        expect(dtcg['space-md'].$extensions?.['design.responsivejs'].curve).toEqual([
            [320, '8px'],
            [1920, '16px'],
        ]);

        const hero = dtcg['font-hero'];
        expect(hero.$value).toBe('24px'); // resolved at the current width
        const curve = hero.$extensions!['design.responsivejs'].curve;
        expect(curve[0]).toEqual([320, '24px']);
        expect(curve[1]).toEqual([1920, '48px']);
        handle.dispose();
    });

    it('two token sets coexist and dispose independently', () => {
        const a = tokens({ '--a': fluid(1, 2) });
        const b = tokens({ '--b': fluid(3, 4) });
        expect(document.head.querySelectorAll('style[data-responsivejs]')).toHaveLength(2);
        a.dispose();
        const left = document.head.querySelectorAll('style[data-responsivejs]');
        expect(left).toHaveLength(1);
        expect(left[0].textContent).toContain('--b');
        b.dispose();
    });
});

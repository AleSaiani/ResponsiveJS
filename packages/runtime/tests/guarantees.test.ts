// @vitest-environment happy-dom
/**
 * Regression tests for the R1 "verità" wave (2026-07-25): each one reproduces
 * a case where the runtime did NOT do what we documented, and pins the fix.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { r$, manifest } from '../src/index.js';
import { __resetProvenance } from '../src/provenance.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';
import { fluid } from '../src/value.js';

const sheets = (): string[] =>
    [...document.head.querySelectorAll('style[data-responsivejs]')].map((s) => s.textContent ?? '');

function el(cls: string): HTMLElement {
    const node = document.createElement('div');
    node.className = cls;
    document.body.appendChild(node);
    return node;
}

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    configure({ breakpoints: [320, 1280] });
    (window as { innerWidth: number }).innerWidth = 320;
    __resetProvenance();
});

afterEach(() => {
    __resetProvenance();
    __resetViewportHub();
    __resetConfig();
});

describe('fromElement — loud, and without leaks', () => {
    it('a missing source throws BEFORE any side effect (no provenance, no stylesheet)', () => {
        el('hero');
        expect(() => r$('.hero', { fontSize: fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }) })).toThrow(
            /fromElement\('\.sidebar'\)/,
        );
        // used to register provenance and inject CSS first, then throw with no handle
        expect(manifest()).toHaveLength(0);
        expect(sheets()).toHaveLength(0);
    });

    it('is honoured by non-numeric values too (was silently ignored)', () => {
        el('sidebar');
        el('hero');
        const handle = r$('.hero', {
            color: fluid('#000000', '#ffffff', { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
        });
        const entry = manifest().find((e) => e.construct === 'style')!;
        expect((entry.config as Record<string, { follows?: string }>).color.follows).toBe('.sidebar');
        handle.dispose();
    });
});

describe('units', () => {
    it('the dynamic path honours the value unit (rem must not be written as px)', () => {
        const node = el('lede');
        const handle = r$('.lede', { fontSize: fluid(1, 2, { curve: 'exponential', unit: 'rem' }) });
        r$.flush();
        expect(node.style.getPropertyValue('font-size')).toBe('1rem');
        handle.dispose();
    });

    it('the static path honours it as well', () => {
        el('lede');
        const handle = r$('.lede', { fontSize: fluid(1, 2, { unit: 'rem' }) });
        expect(sheets().join('')).toContain('clamp(1rem');
        handle.dispose();
    });
});

describe('geometry — attributes are owned, not destroyed', () => {
    it('restores a pre-existing attribute on dispose', () => {
        const nav = el('nav');
        nav.setAttribute('data-wrapped', ''); // server-rendered state
        const handle = r$.geometry('.nav', { wrapped: r$.whenWraps }); // measures false (no children)
        expect(nav.hasAttribute('data-wrapped')).toBe(false); // ours while the handle lives
        handle.dispose();
        expect(nav.hasAttribute('data-wrapped')).toBe(true); // theirs again
    });

    it('still removes attributes it introduced itself', () => {
        const nav = el('nav');
        const handle = r$.geometry('.nav', { wrapped: r$.whenWraps });
        handle.dispose();
        expect(nav.hasAttribute('data-wrapped')).toBe(false);
    });
});

describe('config changes reach BOTH halves', () => {
    // effects are flushed on a microtask — the reaction is async by design
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

    it('re-emits the static CSS when the breakpoints change', async () => {
        el('hero');
        const handle = r$('.hero', { fontSize: fluid(16, 32) });
        const before = sheets().join('');
        expect(before).toContain('clamp(16px');

        configure({ breakpoints: [320, 640] }); // same range, different domain → different slope
        await tick();
        const after = sheets().join('');
        expect(after).toContain('clamp(16px');
        expect(after).not.toBe(before); // used to keep serving the stale clamp
        handle.dispose();
    });

    it('tokens re-emit too', async () => {
        const handle = r$.tokens({ '--space-m': fluid(16, 24) });
        const before = handle.css;
        configure({ breakpoints: [320, 640] });
        await tick();
        expect(handle.css).not.toBe(before);
        handle.dispose();
    });
});

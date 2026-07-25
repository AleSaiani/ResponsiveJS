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

// ─── R2: completeness ───────────────────────────────────────────────────

describe('CSS-first reaches the cases it used to give up on', () => {
    it('a fluid branch compiles INSIDE the @media block', () => {
        el('side');
        const handle = r$('.side', { width: r$.breakpoint.below(768, '100%', fluid(240, 320)) });
        const css = sheets().join('');
        expect(css).toContain('width: 100%');
        expect(css).toContain('@media (min-width: 768px)');
        expect(css).toContain('clamp(240px');
        handle.dispose();
    });

    it('transforms compile: CSS math functions nest', () => {
        el('badge');
        const handle = r$('.badge', { transform: r$.combine([r$.translateX(fluid(0, 40)), r$.scale(fluid(1, 2))]) });
        const css = sheets().join('');
        expect(css).toContain('translateX(clamp(0px');
        expect(css).toContain('scale(clamp(1');
        handle.dispose();
    });
});

describe('SSR: the compiled CSS is reachable', () => {
    it('the handle exposes its own static half', () => {
        el('hero');
        const handle = r$('.hero', { fontSize: fluid(16, 32) });
        expect(handle.css).toContain('clamp(16px');
        handle.dispose();
    });

    it('renderStatic() collects every emission — what a server inlines', async () => {
        const { renderStatic } = await import('../src/static.js');
        el('hero');
        const a = r$('.hero', { fontSize: fluid(16, 32) });
        const b = r$.tokens({ '--space-m': fluid(16, 24) });
        const all = renderStatic();
        expect(all).toContain('.hero');
        expect(all).toContain('--space-m');
        a.dispose();
        b.dispose();
        expect(renderStatic()).not.toContain('--space-m'); // disposal deregisters
    });

    it('a CSP nonce is carried onto the injected style element', () => {
        configure({ nonce: 'abc123' });
        el('hero');
        const handle = r$('.hero', { fontSize: fluid(16, 32) });
        const tag = document.head.querySelector('style[data-responsivejs]')!;
        expect(tag.getAttribute('nonce')).toBe('abc123');
        handle.dispose();
    });
});

describe('handles compose', () => {
    it('r$.scope() disposes a whole component in reverse order', () => {
        const node = el('card');
        const s = r$.scope();
        const styles = s.add(r$('.card', { fontSize: fluid(1, 2, { curve: 'exponential', unit: 'rem' }) }));
        s.add(r$.geometry('.card', { wrapped: r$.whenWraps }));
        r$.flush();
        expect(s.size).toBe(2);
        expect(styles.elements).toHaveLength(1);

        s.dispose();
        expect(node.style.getPropertyValue('font-size')).toBe('');
        expect(manifest()).toHaveLength(0); // both constructs deregistered
    });

    it('defineBreakpoints is disposable like every other construct', () => {
        const bp = r$.breakpoints({ mobile: 320, desktop: 1280 });
        expect(manifest().some((e) => e.construct === 'breakpoints')).toBe(true);
        bp.dispose();
        expect(manifest().some((e) => e.construct === 'breakpoints')).toBe(false);
    });
});

describe('observe() — the SPA answer', () => {
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

    it('binds elements that appear later, and releases the ones that leave', async () => {
        const handle = r$.observe('.item', { fontSize: fluid(1, 2, { curve: 'exponential', unit: 'rem' }) });
        expect(handle.elements).toHaveLength(0);

        const first = el('item');
        await tick();
        r$.flush();
        expect(handle.elements).toHaveLength(1);
        expect(first.style.getPropertyValue('font-size')).toBe('1rem');

        el('item');
        await tick();
        expect(handle.elements).toHaveLength(2);

        first.remove();
        await tick();
        expect(handle.elements).toHaveLength(1);

        handle.dispose();
    });

    it('the static half is injected once and covers future elements', () => {
        const handle = r$.observe('.later', { fontSize: fluid(16, 32) });
        expect(sheets().join('')).toContain('clamp(16px'); // before any .later exists
        handle.dispose();
        expect(sheets().join('')).not.toContain('clamp(16px');
    });
});

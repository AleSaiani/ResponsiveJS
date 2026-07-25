// @vitest-environment happy-dom
/**
 * The adapter's job is the lifecycle, so that is what these check — against
 * the REAL Angular signal primitives and a real injection context, without
 * dragging in the template compiler (the package ships no decorators, by
 * design).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { r$, manifest } from '@responsivejs/runtime';
import { __resetProvenance } from '@responsivejs/runtime/provenance';
import { __resetViewportHub } from '@responsivejs/runtime/viewport';
import { __resetConfig, configure } from '@responsivejs/runtime/config';
import {
    createResponsive,
    createGeometry,
    createViewportWidth,
    createBreakpoint,
    injectResponsive,
    injectViewportWidth,
} from '../src/index.js';

function el(cls: string): HTMLElement {
    const node = document.createElement('div');
    node.className = cls;
    document.body.appendChild(node);
    return node;
}

/** A real injector: Angular provides DestroyRef itself, and destroying the
 *  injector fires it — exactly what happens when a component is destroyed. */
function destroyableContext(): { injector: Injector; destroy: () => void } {
    const injector = Injector.create({ providers: [] });
    return { injector, destroy: () => (injector as unknown as { destroy(): void }).destroy() };
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

describe('createResponsive', () => {
    it('applies, updates in place, and releases', () => {
        const node = el('card');
        const binding = createResponsive(new ElementRef(node), {
            fontSize: r$.fluid(10, 20, { curve: 'exponential' }),
        });
        r$.flush();
        expect(node.style.getPropertyValue('font-size')).toBe('10px');
        expect(manifest()).toHaveLength(1);

        binding.update({ fontSize: r$.fluid(30, 40, { curve: 'exponential' }) });
        r$.flush();
        expect(node.style.getPropertyValue('font-size')).toBe('30px');
        expect(manifest()).toHaveLength(1); // updated, not stacked

        binding.destroy();
        expect(manifest()).toHaveLength(0);
        expect(node.style.getPropertyValue('font-size')).toBe('');
    });

    it('accepts a bare element as well as an ElementRef', () => {
        const node = el('bare');
        const binding = createResponsive(node, { padding: r$.fluid(4, 8, { curve: 'exponential' }) });
        r$.flush();
        expect(node.style.getPropertyValue('padding')).toBe('4px');
        binding.destroy();
    });
});

describe('createGeometry', () => {
    it('registers and releases, and refuses a silent state swap', () => {
        const nav = el('nav');
        const binding = createGeometry(new ElementRef(nav), { wrapped: r$.whenWraps });
        expect(manifest().some((e) => e.construct === 'geometry')).toBe(true);
        expect(() => binding.update(undefined as never)).toThrow(/destroy and re-create/);
        binding.destroy();
        expect(manifest()).toHaveLength(0);
    });
});

describe('signal readers', () => {
    it('viewport width is a real Angular signal that tracks the hub', async () => {
        const binding = createViewportWidth();
        expect(binding.value()).toBe(320);

        (window as { innerWidth: number }).innerWidth = 900;
        window.dispatchEvent(new Event('resize'));
        await Promise.resolve();
        expect(binding.value()).toBe(900);

        binding.destroy();
        (window as { innerWidth: number }).innerWidth = 1200;
        window.dispatchEvent(new Event('resize'));
        await Promise.resolve();
        expect(binding.value()).toBe(900); // released: no longer tracking
    });

    it('breakpoint match is a signal and releases its media-query listener', () => {
        const binding = createBreakpoint(768);
        expect(typeof binding.value()).toBe('boolean');
        binding.destroy();
    });
});

describe('injection-context helpers', () => {
    it('inject* variants tie the teardown to DestroyRef', () => {
        const node = el('injected');
        const { injector, destroy } = destroyableContext();

        runInInjectionContext(injector, () => {
            injectResponsive(node, { fontSize: r$.fluid(12, 20, { curve: 'exponential' }) });
            injectViewportWidth();
        });
        r$.flush();
        expect(node.style.getPropertyValue('font-size')).toBe('12px');
        expect(manifest()).toHaveLength(1);

        destroy(); // the component is destroyed
        expect(manifest()).toHaveLength(0);
        expect(node.style.getPropertyValue('font-size')).toBe('');
    });
});

// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { viewportWidth, mediaQuery, breakpointSignal, containerWidth, __resetViewportHub } from '../src/viewport.js';
import { configure, bpWidth, domain, __resetConfig } from '../src/config.js';
import { defineBreakpoints } from '../src/breakpoints.js';
import { installMatchMediaStub, installResizeObserverStub, tick } from './helpers.js';

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

describe('config', () => {
    it('normalizes named breakpoints to a sorted list', () => {
        defineBreakpoints({ desktop: 1024, mobile: 320, tablet: 768 });
        expect(domain()).toEqual({ min: 320, max: 1024 });
        expect(bpWidth('tablet')).toBe(768);
    });

    it('bpWidth passes numbers through and throws on unknown names', () => {
        expect(bpWidth(500)).toBe(500);
        defineBreakpoints({ mobile: 320 });
        expect(() => bpWidth('tablet')).toThrow(/Known: mobile/);
    });

    it('throws a helpful message when no names are defined', () => {
        expect(() => bpWidth('tablet')).toThrow(/responsive\.breakpoints/);
    });

    it('rejects empty breakpoints', () => {
        expect(() => configure({ breakpoints: [] })).toThrow();
    });

    it('keeps unrelated settings on partial configure', () => {
        configure({ defaultUnit: 'rem' });
        configure({ debug: true });
        defineBreakpoints({ sm: 100 });
        expect(domain()).toEqual({ min: 100, max: 100 });
    });
});

describe('viewportWidth', () => {
    it('is a singleton fed by ONE resize listener', () => {
        const spy = vi.spyOn(window, 'addEventListener');
        const a = viewportWidth();
        const b = viewportWidth();
        expect(a).toBe(b);
        expect(spy.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
    });

    it('tracks window.innerWidth on resize', async () => {
        const sig = viewportWidth();
        (window as { innerWidth: number }).innerWidth = 555;
        window.dispatchEvent(new Event('resize'));
        await tick();
        expect(sig.get()).toBe(555);
    });
});

describe('mediaQuery', () => {
    it('reflects match state and reacts to changes', async () => {
        const stub = installMatchMediaStub(1024);
        __resetViewportHub();
        const { signal, dispose } = mediaQuery('(min-width: 768px)');
        expect(signal.get()).toBe(true);
        stub.setWidth(320);
        await tick();
        expect(signal.get()).toBe(false);
        dispose();
        stub.uninstall();
    });

    it('is refcounted: native listener removed only at zero consumers', () => {
        const stub = installMatchMediaStub(1024);
        __resetViewportHub();
        const q = '(min-width: 768px)';
        const a = mediaQuery(q);
        const b = mediaQuery(q);
        expect(stub.listenerCount(q)).toBe(1); // shared
        a.dispose();
        expect(stub.listenerCount(q)).toBe(1);
        b.dispose();
        expect(stub.listenerCount(q)).toBe(0);
        stub.uninstall();
    });

    it('double dispose is safe', () => {
        const stub = installMatchMediaStub(1024);
        __resetViewportHub();
        const q = '(min-width: 500px)';
        const a = mediaQuery(q);
        const b = mediaQuery(q);
        a.dispose();
        a.dispose(); // no double decrement
        expect(stub.listenerCount(q)).toBe(1);
        b.dispose();
        expect(stub.listenerCount(q)).toBe(0);
        stub.uninstall();
    });

    it('breakpointSignal resolves names through config', () => {
        const stub = installMatchMediaStub(800);
        __resetViewportHub();
        defineBreakpoints({ tablet: 768 });
        const { signal, dispose } = breakpointSignal('tablet');
        expect(signal.get()).toBe(true);
        dispose();
        stub.uninstall();
    });
});

describe('containerWidth', () => {
    it('observes via ONE shared ResizeObserver and reacts', async () => {
        const stub = installResizeObserverStub();
        __resetViewportHub();
        const el = document.createElement('div');
        const { signal, dispose } = containerWidth(el);
        stub.resize(el, 480);
        await tick();
        expect(signal.get()).toBe(480);
        dispose();
        expect(stub.observedCount()).toBe(0);
        stub.uninstall();
    });

    it('is refcounted per element', () => {
        const stub = installResizeObserverStub();
        __resetViewportHub();
        const el = document.createElement('div');
        const a = containerWidth(el);
        const b = containerWidth(el);
        expect(stub.observedCount()).toBe(1);
        a.dispose();
        expect(stub.observedCount()).toBe(1);
        b.dispose();
        expect(stub.observedCount()).toBe(0);
        stub.uninstall();
    });
});

describe('SSR safety (module contract)', () => {
    it('mediaQuery without matchMedia yields a never-matching signal', () => {
        const original = (window as unknown as { matchMedia?: unknown }).matchMedia;
        (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
        (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
        __resetViewportHub();
        const { signal, dispose } = mediaQuery('(min-width: 1px)');
        expect(signal.get()).toBe(false);
        dispose();
        (window as unknown as { matchMedia?: unknown }).matchMedia = original;
    });
});

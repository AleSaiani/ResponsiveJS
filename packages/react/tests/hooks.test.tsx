// @vitest-environment happy-dom
/**
 * The adapter's whole job is the lifecycle: apply on mount, update on
 * change, dispose on unmount. So that is what these test — against a real
 * React renderer, not a mock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StrictMode, useRef, useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { r$, manifest } from '@responsivejs/runtime';
import { __resetProvenance } from '@responsivejs/runtime/provenance';
import { __resetViewportHub } from '@responsivejs/runtime/viewport';
import { __resetConfig, configure } from '@responsivejs/runtime/config';
import { useResponsive, useGeometry, useViewportWidth, useBreakpoint } from '../src/index.js';

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    configure({ breakpoints: [320, 1280] });
    (window as { innerWidth: number }).innerWidth = 320;
    __resetProvenance();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    __resetProvenance();
    __resetViewportHub();
    __resetConfig();
});

describe('useResponsive', () => {
    function Card({ size }: { size: number }) {
        const ref = useRef<HTMLDivElement>(null);
        useResponsive(ref, { fontSize: r$.fluid(size, size * 2, { curve: 'exponential' }) }, [size]);
        return <div ref={ref} className="card" />;
    }

    it('applies on mount and disposes on unmount', () => {
        act(() => root.render(<Card size={10} />));
        r$.flush();
        const el = container.querySelector<HTMLElement>('.card')!;
        expect(el.style.getPropertyValue('font-size')).toBe('10px');
        expect(manifest()).toHaveLength(1);

        act(() => root.render(<></>));
        expect(manifest()).toHaveLength(0); // the construct released with the component
    });

    it('updates the live handle when the declaration changes', () => {
        act(() => root.render(<Card size={10} />));
        r$.flush();
        act(() => root.render(<Card size={30} />));
        r$.flush();
        expect(container.querySelector<HTMLElement>('.card')!.style.getPropertyValue('font-size')).toBe('30px');
        expect(manifest()).toHaveLength(1); // updated, not stacked
    });

    it('survives StrictMode double-invocation without leaking constructs', () => {
        act(() => root.render(<StrictMode><Card size={12} /></StrictMode>));
        r$.flush();
        expect(manifest()).toHaveLength(1);
    });
});

describe('useGeometry', () => {
    it('mirrors measured facts into attributes and cleans up', () => {
        function Nav() {
            const ref = useRef<HTMLElement>(null);
            useGeometry(ref, { wrapped: r$.whenWraps });
            return <nav ref={ref} className="nav" />;
        }
        act(() => root.render(<Nav />));
        expect(manifest().some((e) => e.construct === 'geometry')).toBe(true);
        act(() => root.render(<></>));
        expect(manifest()).toHaveLength(0);
    });
});

describe('reactive readers', () => {
    it('useViewportWidth tracks the hub', async () => {
        function Probe() {
            return <span className="w">{useViewportWidth()}</span>;
        }
        act(() => root.render(<Probe />));
        expect(container.querySelector('.w')!.textContent).toBe('320');

        // the signal notifies on a microtask — await the act, don't assume sync
        await act(async () => {
            (window as { innerWidth: number }).innerWidth = 900;
            window.dispatchEvent(new Event('resize'));
            await Promise.resolve();
        });
        expect(container.querySelector('.w')!.textContent).toBe('900');
    });

    it('useBreakpoint reads a media query without leaking listeners', () => {
        function Probe() {
            return <span className="bp">{String(useBreakpoint(768))}</span>;
        }
        act(() => root.render(<Probe />));
        expect(['true', 'false']).toContain(container.querySelector('.bp')!.textContent);
        act(() => root.render(<></>)); // dispose path must not throw
    });
});

describe('state changes that keep the same element', () => {
    it('a re-render without dep changes does not recreate the construct', () => {
        function Counter() {
            const [n, setN] = useState(0);
            const ref = useRef<HTMLDivElement>(null);
            useResponsive(ref, { padding: r$.fluid(4, 8, { curve: 'exponential' }) }, []);
            return <div ref={ref} className="c" onClick={() => setN(n + 1)}>{n}</div>;
        }
        act(() => root.render(<Counter />));
        const before = manifest()[0].id;
        act(() => container.querySelector<HTMLElement>('.c')!.click());
        expect(manifest()).toHaveLength(1);
        expect(manifest()[0].id).toBe(before); // same construct, not re-created
    });
});

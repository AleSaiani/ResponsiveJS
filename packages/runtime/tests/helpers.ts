/**
 * Test-only stubs for the browser APIs neither happy-dom nor jsdom make
 * controllable: matchMedia, ResizeObserver, requestAnimationFrame.
 * Every installer returns an uninstaller.
 */

type Listener = (e: { matches: boolean }) => void;

export function installMatchMediaStub(initialWidth = 1024) {
    let width = initialWidth;
    const queries = new Map<string, { listeners: Set<Listener>; mql: { matches: boolean } }>();

    const evaluate = (query: string, w: number): boolean => {
        const min = query.match(/\(min-width:\s*([\d.]+)px\)/);
        if (min) return w >= parseFloat(min[1]);
        const max = query.match(/\(max-width:\s*([\d.]+)px\)/);
        if (max) return w <= parseFloat(max[1]);
        return false;
    };

    const original = (globalThis as { matchMedia?: unknown }).matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => {
        let entry = queries.get(query);
        if (!entry) {
            entry = { listeners: new Set(), mql: { matches: evaluate(query, width) } };
            queries.set(query, entry);
        }
        const { listeners, mql } = entry;
        return {
            get matches() {
                return mql.matches;
            },
            media: query,
            addEventListener: (_: string, cb: Listener) => listeners.add(cb),
            removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
        };
    };
    if (typeof window !== 'undefined') {
        (window as unknown as { matchMedia: unknown }).matchMedia = (
            globalThis as { matchMedia?: unknown }
        ).matchMedia;
    }

    return {
        setWidth(w: number) {
            width = w;
            for (const [query, entry] of queries) {
                const matches = evaluate(query, w);
                if (matches !== entry.mql.matches) {
                    entry.mql.matches = matches;
                    for (const cb of entry.listeners) cb({ matches });
                }
            }
        },
        listenerCount(query: string): number {
            return queries.get(query)?.listeners.size ?? 0;
        },
        uninstall() {
            (globalThis as { matchMedia?: unknown }).matchMedia = original;
        },
    };
}

type ROCallback = (
    entries: {
        target: Element;
        contentRect: { width: number; height?: number };
        contentBoxSize?: { inlineSize: number; blockSize?: number }[];
    }[],
) => void;

export function installResizeObserverStub() {
    const observers = new Set<{ cb: ROCallback; elements: Set<Element> }>();

    const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
        private entry = { cb: null as unknown as ROCallback, elements: new Set<Element>() };
        constructor(cb: ROCallback) {
            this.entry.cb = cb;
            observers.add(this.entry);
        }
        observe(el: Element) {
            this.entry.elements.add(el);
        }
        unobserve(el: Element) {
            this.entry.elements.delete(el);
        }
        disconnect() {
            this.entry.elements.clear();
            observers.delete(this.entry);
        }
    };

    return {
        resize(el: Element, width: number, height = 0) {
            for (const { cb, elements } of observers) {
                if (elements.has(el)) {
                    cb([
                        {
                            target: el,
                            contentRect: { width, height },
                            contentBoxSize: [{ inlineSize: width, blockSize: height }],
                        },
                    ]);
                }
            }
        },
        observedCount(): number {
            let n = 0;
            for (const { elements } of observers) n += elements.size;
            return n;
        },
        uninstall() {
            (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
        },
    };
}

/** Await one microtask turn (signal effects flush). */
export const tick = () => new Promise<void>((r) => queueMicrotask(r));

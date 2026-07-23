import { describe, it, expect, vi } from 'vitest';
import { state, computed, effect, subscribe, batch, untrack } from '../src/signals.js';

const tick = () => new Promise<void>((r) => queueMicrotask(r));

describe('state', () => {
    it('get returns the current value', () => {
        const s = state(1);
        expect(s.get()).toBe(1);
        s.set(2);
        expect(s.get()).toBe(2);
    });

    it('set is equality-gated with Object.is', async () => {
        const s = state(1);
        const spy = vi.fn(() => { s.get(); });
        effect(spy);
        s.set(1);
        await tick();
        expect(spy).toHaveBeenCalledTimes(1); // only the initial run
    });

    it('supports custom equality', async () => {
        const s = state({ x: 1 }, (a, b) => a.x === b.x);
        const spy = vi.fn(() => { s.get(); });
        effect(spy);
        s.set({ x: 1 });
        await tick();
        expect(spy).toHaveBeenCalledTimes(1);
        s.set({ x: 2 });
        await tick();
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe('computed', () => {
    it('derives lazily and caches', () => {
        const s = state(2);
        const fn = vi.fn(() => s.get() * 10);
        const c = computed(fn);
        expect(fn).not.toHaveBeenCalled();
        expect(c.get()).toBe(20);
        expect(c.get()).toBe(20);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('recomputes only when a source actually changed', () => {
        const s = state(1);
        const fn = vi.fn(() => s.get() + 1);
        const c = computed(fn);
        c.get();
        s.set(1); // gated — no version bump
        c.get();
        expect(fn).toHaveBeenCalledTimes(1);
        s.set(2);
        expect(c.get()).toBe(3);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('chains through other computeds', () => {
        const s = state(1);
        const double = computed(() => s.get() * 2);
        const quad = computed(() => double.get() * 2);
        expect(quad.get()).toBe(4);
        s.set(3);
        expect(quad.get()).toBe(12);
    });

    it('is diamond-safe (single recompute per change)', async () => {
        const s = state(1);
        const a = computed(() => s.get() + 1);
        const b = computed(() => s.get() + 2);
        const joinFn = vi.fn(() => a.get() + b.get());
        const join = computed(joinFn);
        expect(join.get()).toBe(5);
        s.set(2);
        expect(join.get()).toBe(7);
        expect(joinFn).toHaveBeenCalledTimes(2); // once initial, once after change
    });

    it('equality-gates its own value (downstream sees no change)', async () => {
        const s = state(1);
        const parity = computed(() => s.get() % 2);
        const spy = vi.fn(() => { parity.get(); });
        effect(spy);
        expect(spy).toHaveBeenCalledTimes(1);
        s.set(3); // parity unchanged (1 → 1)
        await tick();
        expect(spy).toHaveBeenCalledTimes(1);
        s.set(4);
        await tick();
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('prunes stale dependencies on recompute', async () => {
        const cond = state(true);
        const a = state('a');
        const b = state('b');
        const pick = computed(() => (cond.get() ? a.get() : b.get()));
        const spy = vi.fn(() => { pick.get(); });
        effect(spy);
        cond.set(false);
        await tick();
        expect(spy).toHaveBeenCalledTimes(2);
        a.set('a2'); // no longer a dependency
        await tick();
        expect(spy).toHaveBeenCalledTimes(2);
        b.set('b2');
        await tick();
        expect(spy).toHaveBeenCalledTimes(3);
    });
});

describe('effect', () => {
    it('runs immediately and re-runs on change', async () => {
        const s = state(1);
        const values: number[] = [];
        effect(() => {
            values.push(s.get());
        });
        expect(values).toEqual([1]);
        s.set(2);
        await tick();
        expect(values).toEqual([1, 2]);
    });

    it('dedupes multiple sets into one microtask run', async () => {
        const s = state(0);
        const spy = vi.fn(() => { s.get(); });
        effect(spy);
        s.set(1);
        s.set(2);
        s.set(3);
        await tick();
        expect(spy).toHaveBeenCalledTimes(2); // initial + one flush
        expect(s.get()).toBe(3);
    });

    it('runs cleanup before re-run and on dispose', async () => {
        const s = state(0);
        const cleanup = vi.fn();
        const dispose = effect(() => {
            s.get();
            return cleanup;
        });
        s.set(1);
        await tick();
        expect(cleanup).toHaveBeenCalledTimes(1);
        dispose();
        expect(cleanup).toHaveBeenCalledTimes(2);
    });

    it('never re-runs after dispose', async () => {
        const s = state(0);
        const spy = vi.fn(() => { s.get(); });
        const dispose = effect(spy);
        dispose();
        s.set(1);
        await tick();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('tracks new dependencies discovered on re-run', async () => {
        const cond = state(false);
        const extra = state(10);
        const seen: number[] = [];
        effect(() => {
            seen.push(cond.get() ? extra.get() : -1);
        });
        cond.set(true);
        await tick();
        extra.set(20);
        await tick();
        expect(seen).toEqual([-1, 10, 20]);
    });
});

describe('subscribe', () => {
    it('does not fire on subscription, fires on change', async () => {
        const s = state('a');
        const spy = vi.fn();
        subscribe(s, spy);
        expect(spy).not.toHaveBeenCalled();
        s.set('b');
        await tick();
        expect(spy).toHaveBeenCalledWith('b');
    });

    it('returns a working disposer', async () => {
        const s = state(0);
        const spy = vi.fn();
        const dispose = subscribe(s, spy);
        dispose();
        s.set(1);
        await tick();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('batch', () => {
    it('defers effects until exit, then flushes synchronously', () => {
        const a = state(1);
        const b = state(2);
        const sums: number[] = [];
        effect(() => {
            sums.push(a.get() + b.get());
        });
        batch(() => {
            a.set(10);
            b.set(20);
            expect(sums).toEqual([3]); // nothing ran yet
        });
        expect(sums).toEqual([3, 30]); // synchronous flush at exit
    });

    it('supports nesting (flush only at the outermost exit)', () => {
        const s = state(0);
        const spy = vi.fn(() => { s.get(); });
        effect(spy);
        batch(() => {
            s.set(1);
            batch(() => s.set(2));
            expect(spy).toHaveBeenCalledTimes(1);
        });
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe('untrack', () => {
    it('reads inside untrack are not dependencies', async () => {
        const tracked = state(1);
        const ignored = state(100);
        const spy = vi.fn(() => { tracked.get(); untrack(() => ignored.get()); });
        effect(spy);
        ignored.set(200);
        await tick();
        expect(spy).toHaveBeenCalledTimes(1);
        tracked.set(2);
        await tick();
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

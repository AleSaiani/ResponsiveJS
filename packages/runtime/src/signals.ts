/**
 * Minimal reactive engine, shaped on the TC39 Signals proposal ({get}/{get,set})
 * so framework adapters map trivially. Zero dependencies, no DOM.
 *
 * Semantics: pull-based lazy computeds (version-validated, diamond-safe),
 * equality-gated writes, effects deduped and flushed in a microtask (or
 * synchronously at batch() exit). Disposal removes every graph edge — nothing
 * leaks after dispose().
 */

export interface State<T> {
    get(): T;
    set(value: T): void;
}

export interface Computed<T> {
    get(): T;
}

export type Signal<T> = State<T> | Computed<T>;
export type Disposer = () => void;
export type Equals<T> = (a: T, b: T) => boolean;

// ─── internals ──────────────────────────────────────────────────────────

interface SourceNode {
    version: number;
    observers: Set<ObserverNode>;
    /** Bring the node up to date and return its current version. */
    refresh(): number;
}

interface ObserverNode {
    sources: Map<SourceNode, number>;
    /** Called when a transitively-reachable source changed. */
    invalidate(): void;
}

let currentObserver: ObserverNode | null = null;
let batchDepth = 0;
const pendingEffects = new Set<EffectNode>();
let flushScheduled = false;

function track(source: SourceNode): void {
    if (currentObserver) {
        currentObserver.sources.set(source, source.version);
        source.observers.add(currentObserver);
    }
}

function unlink(observer: ObserverNode): void {
    for (const source of observer.sources.keys()) source.observers.delete(observer);
    observer.sources.clear();
}

function invalidateObservers(source: SourceNode): void {
    for (const observer of source.observers) observer.invalidate();
}

function scheduleFlush(): void {
    if (batchDepth > 0 || flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flushEffects);
}

/** Run all pending effects now. Exposed for deterministic tests via batch(). */
function flushEffects(): void {
    flushScheduled = false;
    // Effects scheduled while flushing run in the same pass (Set iteration
    // visits additions), with a generous cycle guard.
    let iterations = 0;
    for (const effect of pendingEffects) {
        pendingEffects.delete(effect);
        effect.run();
        if (++iterations > 10_000) {
            pendingEffects.clear();
            throw new Error('signals: effect cycle detected (10000 iterations)');
        }
    }
}

// ─── state ──────────────────────────────────────────────────────────────

class StateNode<T> implements State<T>, SourceNode {
    version = 0;
    observers = new Set<ObserverNode>();

    constructor(
        private value: T,
        private equals: Equals<T>,
    ) {}

    get(): T {
        track(this);
        return this.value;
    }

    set(next: T): void {
        if (this.equals(this.value, next)) return;
        this.value = next;
        this.version++;
        invalidateObservers(this);
        scheduleFlush();
    }

    refresh(): number {
        return this.version;
    }
}

// ─── computed ───────────────────────────────────────────────────────────

class ComputedNode<T> implements Computed<T>, SourceNode, ObserverNode {
    version = 0;
    observers = new Set<ObserverNode>();
    sources = new Map<SourceNode, number>();

    private value!: T;
    private stale = true;
    private initialized = false;

    constructor(
        private fn: () => T,
        private equals: Equals<T>,
    ) {}

    get(): T {
        this.refresh();
        track(this);
        return this.value;
    }

    invalidate(): void {
        if (this.stale) return;
        this.stale = true;
        invalidateObservers(this);
    }

    refresh(): number {
        if (!this.stale) return this.version;
        this.stale = false;

        // Version validation: recompute only if a source actually changed.
        if (this.initialized) {
            let changed = false;
            for (const [source, seen] of this.sources) {
                if (source.refresh() !== seen) {
                    changed = true;
                    break;
                }
            }
            if (!changed) return this.version;
        }

        unlink(this);
        const prev = currentObserver;
        currentObserver = this;
        let next: T;
        try {
            next = this.fn();
        } finally {
            currentObserver = prev;
        }

        if (!this.initialized || !this.equals(this.value, next)) {
            this.value = next;
            this.version++;
        }
        this.initialized = true;
        return this.version;
    }
}

// ─── effect ─────────────────────────────────────────────────────────────

class EffectNode implements ObserverNode {
    sources = new Map<SourceNode, number>();
    private cleanup: void | Disposer = undefined;
    private disposed = false;

    constructor(private fn: () => void | Disposer) {}

    invalidate(): void {
        if (!this.disposed) pendingEffects.add(this);
    }

    run(): void {
        if (this.disposed) return;

        // Version validation: skip when nothing actually changed (an upstream
        // computed may have re-evaluated to an equal value).
        if (this.sources.size > 0) {
            let changed = false;
            for (const [source, seen] of this.sources) {
                if (source.refresh() !== seen) {
                    changed = true;
                    break;
                }
            }
            if (!changed) return;
        }

        if (typeof this.cleanup === 'function') this.cleanup();
        unlink(this);
        const prev = currentObserver;
        currentObserver = this;
        try {
            this.cleanup = this.fn();
        } finally {
            currentObserver = prev;
        }
    }

    /** First run: always executes (no sources recorded yet). */
    start(): void {
        if (typeof this.cleanup === 'function') this.cleanup();
        unlink(this);
        const prev = currentObserver;
        currentObserver = this;
        try {
            this.cleanup = this.fn();
        } finally {
            currentObserver = prev;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        pendingEffects.delete(this);
        if (typeof this.cleanup === 'function') this.cleanup();
        this.cleanup = undefined;
        unlink(this);
    }
}

// ─── public API ─────────────────────────────────────────────────────────

export function state<T>(initial: T, equals: Equals<T> = Object.is): State<T> {
    return new StateNode(initial, equals);
}

export function computed<T>(fn: () => T, equals: Equals<T> = Object.is): Computed<T> {
    return new ComputedNode(fn, equals);
}

/** Runs fn now (tracking reads) and re-runs it when any read signal changes. */
export function effect(fn: () => void | Disposer): Disposer {
    const node = new EffectNode(fn);
    node.start();
    return () => node.dispose();
}

/** Calls cb with the new value on every change (not on subscription). */
export function subscribe<T>(signal: Signal<T>, cb: (value: T) => void): Disposer {
    let first = true;
    return effect(() => {
        const value = signal.get();
        if (first) {
            first = false;
            return;
        }
        cb(value);
    });
}

/** Defers effect execution until fn returns, then flushes synchronously. */
export function batch(fn: () => void): void {
    batchDepth++;
    try {
        fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) flushEffects();
    }
}

/** Reads inside fn are not tracked by the surrounding effect/computed. */
export function untrack<T>(fn: () => T): T {
    const prev = currentObserver;
    currentObserver = null;
    try {
        return fn();
    } finally {
        currentObserver = prev;
    }
}

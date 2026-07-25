/**
 * A scope groups constructs so a component can tear them all down with one
 * call. Every r$ construct returns a handle with `dispose()` — the scope just
 * remembers them and disposes in reverse order (last created, first released).
 */

/** The one thing every r$ construct handle has in common. */
export interface Disposable {
    dispose(): void;
}

export interface Scope extends Disposable {
    /** Adopt a handle and return it unchanged, so it can wrap a call inline. */
    add<T extends Disposable>(handle: T): T;
    /** How many handles are still held. */
    readonly size: number;
}

export function scope(): Scope {
    const held: Disposable[] = [];
    let disposed = false;
    return {
        add<T extends Disposable>(handle: T): T {
            if (disposed) {
                throw new Error('r$: this scope is already disposed — create a new one.');
            }
            held.push(handle);
            return handle;
        },
        get size() {
            return held.length;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            // reverse order: constructs created later may depend on earlier ones
            for (let i = held.length - 1; i >= 0; i--) held[i].dispose();
            held.length = 0;
        },
    };
}

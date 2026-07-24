/**
 * Provenance registry — the authoring plane's side of the closed loop.
 *
 * Every construct registers what it controls (target, behavior, best-effort
 * call site) and unregisters on dispose. The manifest is published on
 * `window.__rjs_manifest`, where the design collector picks it up with the
 * measurements — so a violation report can say WHICH construct owns the
 * element and WHERE it was declared, and an agent can patch the construct
 * instead of blind-patching CSS.
 */

import type { ProvenanceEntry } from '@responsivejs/core/types';
import { isResponsiveValue, type StyleMap } from './value.js';

/** Serializable config of a style/tokens map: each entry's meta descriptor. */
export function describeMap(map: StyleMap): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(map).map(([prop, v]) => [
            prop,
            isResponsiveValue(v)
                ? (v.meta ?? { value: v.kind })
                : typeof v === 'function'
                  ? { value: 'custom' }
                  : { value: 'literal', literal: v },
        ]),
    );
}

let nextId = 0;
const entries = new Map<number, ProvenanceEntry>();

/** Best-effort call site: the first stack frame outside r$ internals. */
function captureSource(): string | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;
    const frames = stack.split('\n').slice(1);
    const external = frames.find(
        (line) =>
            /[\d]+:[\d]+/.test(line) &&
            !/responsivejs[\\/]|[\\/]runtime[\\/](src|dist)[\\/]|captureSource|registerProvenance/.test(line),
    );
    return external?.trim().replace(/^at\s+/, '') || undefined;
}

function publish(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as { __rjs_manifest: ProvenanceEntry[] }).__rjs_manifest = manifest();
}

/** Register a construct; returns its disposer. Called by every constructor. */
export function registerProvenance(entry: Omit<ProvenanceEntry, 'id' | 'source'>): () => void {
    const id = ++nextId;
    const source = captureSource();
    entries.set(id, { ...entry, id, ...(source ? { source } : {}) });
    publish();
    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        entries.delete(id);
        publish();
    };
}

/** The live manifest of every active runtime construct. */
export function manifest(): ProvenanceEntry[] {
    return [...entries.values()];
}

/** Test-only: clear the registry. */
export function __resetProvenance(): void {
    entries.clear();
    publish();
}

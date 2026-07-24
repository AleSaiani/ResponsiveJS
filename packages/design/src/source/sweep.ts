/**
 * Driver-neutral sweeper: drives any MeasurementSource across viewport widths.
 * The Playwright sweep()/resweep() delegate here.
 */

import type { SnapshotStore, SweepOptions, ViewportSnapshot } from '@responsivejs/core/types';
import { DEFAULT_WIDTHS } from '@responsivejs/core/types';
import type { MeasurementSource } from './types.js';

/** Source-level sweeps may omit `url` (pre-navigated / attached sources). */
export type SourceSweepOptions = Omit<SweepOptions, 'url'> & { url?: string };

/** Resolve sweep options to a concrete sorted list of widths. */
export function resolveWidths(opts: Pick<SweepOptions, 'widths' | 'from' | 'to' | 'step'>): number[] {
    if (opts.widths) return [...opts.widths].sort((a, b) => a - b);
    if (opts.from !== undefined && opts.to !== undefined) {
        const step = opts.step || 50;
        const widths: number[] = [];
        for (let w = opts.from; w <= opts.to; w += step) widths.push(w);
        return widths;
    }
    return [...DEFAULT_WIDTHS];
}

async function measureWithScroll(
    source: MeasurementSource,
    selectors: string[],
    height: number,
    scrollSteps: number,
): Promise<ViewportSnapshot> {
    const snapshot = await source.measure(selectors);
    if (!source.evaluate) {
        throw new Error(`r$: scroll sweeping needs an evaluate-capable source ('${source.kind}' has none)`);
    }

    const pageHeight = await source.evaluate<number>('document.documentElement.scrollHeight');

    for (let step = 1; step <= scrollSteps; step++) {
        const scrollY = Math.min(step * height, pageHeight - height);
        if (scrollY <= 0) break;

        await source.evaluate(`window.scrollTo(0, ${scrollY})`);
        const scrollSnapshot = await source.measure(selectors);
        scrollSnapshot.scrollY = scrollY;

        // Merge newly-visible elements (never overwrite what was already seen).
        for (const [sel, elements] of scrollSnapshot.elements) {
            const existing = snapshot.elements.get(sel);
            if (!existing) {
                snapshot.elements.set(sel, elements);
            } else {
                const seen = new Set(existing.map((e) => e.index));
                for (const el of elements) {
                    if (!seen.has(el.index)) existing.push(el);
                }
            }
        }
        for (const [sel, relations] of scrollSnapshot.childRelations) {
            if (!snapshot.childRelations.has(sel)) snapshot.childRelations.set(sel, relations);
        }
    }

    await source.evaluate('window.scrollTo(0, 0)');
    return snapshot;
}

/** Sweep a source across widths, producing a SnapshotStore. */
export async function sweepSource(source: MeasurementSource, opts: SourceSweepOptions): Promise<SnapshotStore> {
    const widths = resolveWidths(opts);
    const height = opts.height || 900;
    const snapshots = new Map<number, ViewportSnapshot>();

    if (opts.url) {
        if (!source.open) throw new Error(`r$: source '${source.kind}' cannot open URLs — pre-navigate and omit url`);
        await source.open(opts.url);
    }

    let manifest: SnapshotStore['manifest'];
    for (const w of widths) {
        await source.setViewport(w, height);
        const snapshot = opts.scroll
            ? await measureWithScroll(source, opts.selectors, height, opts.scrollSteps ?? 3)
            : await source.measure(opts.selectors);
        snapshots.set(w, snapshot);
        if (snapshot.manifest) manifest = snapshot.manifest;
    }

    return { snapshots, widths, selectors: opts.selectors, ...(manifest ? { manifest } : {}) };
}

/** Incremental re-sweep: re-measure specific widths/selectors into an existing store. */
export async function resweepSource(
    source: MeasurementSource,
    existing: SnapshotStore,
    opts: { widths?: number[]; selectors?: string[]; height?: number },
): Promise<SnapshotStore> {
    const widths = opts.widths ?? [...existing.widths];
    const selectors = opts.selectors ?? existing.selectors;
    const height = opts.height ?? 900;

    const snapshots = new Map(existing.snapshots);
    for (const w of widths) {
        await source.setViewport(w, height);
        snapshots.set(w, await source.measure(selectors));
    }

    return {
        snapshots,
        widths: [...new Set([...existing.widths, ...widths])].sort((a, b) => a - b),
        selectors: [...new Set([...existing.selectors, ...selectors])],
    };
}

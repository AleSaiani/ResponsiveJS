/**
 * Sweep-to-sweep diff — measure, change the CSS, measure again, and see
 * exactly what moved. Pure: two outcomes in, a structured delta out.
 */

import type { SnapshotStore, Violation } from '@responsivejs/core/types';

const PROPS = ['fontSize', 'width', 'height', 'x', 'y'] as const;
const TOLERANCE = 0.5; // sub-pixel jitter is not a change

export interface ValueChange {
    selector: string;
    /** element index within the selector */
    index: number;
    prop: (typeof PROPS)[number];
    width: number;
    before: number;
    after: number;
}

export interface SweepDiff {
    changes: ValueChange[];
    /** violation keys (rule|element|width) present now but not before */
    appeared: string[];
    /** violation keys resolved since the previous sweep */
    resolved: string[];
}

const violationKey = (v: Violation): string => `${v.rule}|${v.element ?? v.elements?.join('+') ?? ''}|${v.width}`;

function valueOf(store: SnapshotStore, width: number, selector: string, index: number, prop: (typeof PROPS)[number]): number | undefined {
    const els = store.snapshots.get(width)?.elements.get(selector);
    const elSnap = els?.find((e) => e.index === index);
    if (!elSnap) return undefined;
    return prop === 'fontSize' ? elSnap.styles.fontSize : elSnap.rect[prop];
}

export function diffSweeps(
    before: { store: SnapshotStore; violations: Violation[] },
    after: { store: SnapshotStore; violations: Violation[] },
): SweepDiff {
    const changes: ValueChange[] = [];
    const widths = after.store.widths.filter((w) => before.store.snapshots.has(w));

    for (const w of widths) {
        const snapshot = after.store.snapshots.get(w)!;
        for (const [selector, els] of snapshot.elements) {
            for (const elSnap of els) {
                for (const prop of PROPS) {
                    const b = valueOf(before.store, w, selector, elSnap.index, prop);
                    const a = valueOf(after.store, w, selector, elSnap.index, prop);
                    if (b === undefined || a === undefined) continue;
                    if (Math.abs(a - b) > TOLERANCE) {
                        changes.push({ selector, index: elSnap.index, prop, width: w, before: b, after: a });
                    }
                }
            }
        }
    }

    const beforeKeys = new Set(before.violations.map(violationKey));
    const afterKeys = new Set(after.violations.map(violationKey));
    return {
        changes,
        appeared: [...afterKeys].filter((k) => !beforeKeys.has(k)),
        resolved: [...beforeKeys].filter((k) => !afterKeys.has(k)),
    };
}

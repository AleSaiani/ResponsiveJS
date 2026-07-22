// L-95 regression:
//  (a) textReadable compared line-height as if it were a ratio, but the measurer stores
//      it in PX → the check never fired. It must normalize px→ratio (and skip `normal`=0).
//  (b) contrastRatio's isLargeText ignored the WCAG bold requirement (`>=18.66px AND bold`),
//      wrongly relaxing the threshold for regular-weight 18.66–24px text.

import { describe, it, expect } from 'vitest';
import { Asserter } from '../src/constraints/index.js';
import { contrastRatio } from '@responsivejs/core/color';
import type { SnapshotStore, ViewportSnapshot, ElementSnapshot } from '@responsivejs/core/types';

function rect() {
    return { x: 0, y: 0, width: 100, height: 30, right: 100, bottom: 30, centerX: 50, centerY: 15, area: 3000 };
}

function el(styles: Partial<ElementSnapshot['styles']>, computed: Partial<ElementSnapshot['computed']> = {}): ElementSnapshot {
    return {
        selector: '.t',
        index: 0,
        rect: rect(),
        styles: {
            fontSize: 16, lineHeight: 0, fontWeight: 400, gap: 0,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
            marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
            borderRadiusTL: 0, borderRadiusTR: 0, borderRadiusBR: 0, borderRadiusBL: 0,
            minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity,
            zIndex: 0, opacity: 1, outlineWidth: 0, outlineOffset: 0,
            ...styles,
        },
        computed: {
            display: 'block', overflow: 'visible', position: 'static', visibility: 'visible',
            pointerEvents: 'auto', backgroundColor: '#ffffff', color: '#000000',
            boxSizing: 'border-box', textAlign: 'left', whiteSpace: 'normal', cursor: 'auto',
            ...computed,
        },
    };
}

function store(elements: ElementSnapshot[]): SnapshotStore {
    const snap: ViewportSnapshot = {
        width: 1280, height: 800,
        elements: new Map([['.t', elements]]),
        childRelations: new Map(),
        timestamp: 0,
    };
    return { snapshots: new Map([[1280, snap]]), widths: [1280], selectors: ['.t'] };
}

describe('textReadable — line-height normalized px→ratio (L-95a)', () => {
    it('flags a tight line-height (20px on 16px font = 1.25 ratio)', () => {
        const r = new Asserter(store([el({ fontSize: 16, lineHeight: 20 })])).textReadable('.t').report();
        const lh = r.violations.filter(v => v.detail.includes('lineHeight'));
        expect(lh.length).toBe(1);
        expect(lh[0].actual).toBeCloseTo(1.25, 2);
    });

    it('accepts a comfortable line-height (24px on 16px font = 1.5 ratio)', () => {
        const r = new Asserter(store([el({ fontSize: 16, lineHeight: 24 })])).textReadable('.t').report();
        expect(r.violations.some(v => v.detail.includes('lineHeight'))).toBe(false);
    });

    it('does not false-positive on `normal` line-height (stored as 0)', () => {
        const r = new Asserter(store([el({ fontSize: 16, lineHeight: 0 })])).textReadable('.t').report();
        expect(r.violations.some(v => v.detail.includes('lineHeight'))).toBe(false);
    });
});

describe('contrastRatio — WCAG large-text requires bold below 24px (L-95b)', () => {
    // #888 on white ≈ 3.54:1 — passes the large-text bar (3:1) but fails normal (4.5:1).
    const MID = '#888888';

    it('precondition: mid-gray contrast is between the large (3) and normal (4.5) thresholds', () => {
        const ratio = contrastRatio(MID, '#ffffff');
        expect(ratio).toBeGreaterThan(3);
        expect(ratio).toBeLessThan(4.5);
    });

    it('regular-weight 20px text is NOT large text → must fail AA', () => {
        const r = new Asserter(store([el({ fontSize: 20, fontWeight: 400 }, { color: MID })]))
            .contrastRatio('.t', 'AA').report();
        expect(r.violations.some(v => v.rule === 'contrastRatio')).toBe(true);
    });

    it('bold 20px text IS large text → passes AA at the same contrast', () => {
        const r = new Asserter(store([el({ fontSize: 20, fontWeight: 700 }, { color: MID })]))
            .contrastRatio('.t', 'AA').report();
        expect(r.violations.some(v => v.rule === 'contrastRatio')).toBe(false);
    });
});

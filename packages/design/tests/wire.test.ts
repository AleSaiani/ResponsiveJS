import { describe, it, expect } from 'vitest';
import { fromWire, toWire, storeToJSON, storeFromJSON, type ViewportSnapshotWire } from '../src/browser/wire.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

describe('wire round-trip', () => {
    it('fromWire rebuilds derived Rect fields', () => {
        const wire: ViewportSnapshotWire = {
            width: 800,
            height: 600,
            timestamp: 42,
            elements: [['.a', [{ selector: '.a', index: 0, rect: { x: 10, y: 20, width: 100, height: 50 }, styles: makeEl('.a').styles, computed: makeEl('.a').computed }]]],
            childRelations: [['.a', [{ parentSelector: '.a', parentRect: { x: 10, y: 20, width: 100, height: 50 }, childRects: [{ x: 12, y: 22, width: 40, height: 20 }] }]]],
        };
        const snap = fromWire(wire);
        const el = snap.elements.get('.a')![0];
        expect(el.rect.right).toBe(110);
        expect(el.rect.bottom).toBe(70);
        expect(el.rect.centerX).toBe(60);
        expect(el.rect.area).toBe(5000);
        expect(snap.childRelations.get('.a')![0].childRects[0].right).toBe(52);
    });

    it('toWire → fromWire is the identity on snapshots', () => {
        const store = makeStore([320, 1280], ['.x', '.y']);
        const snap = store.snapshots.get(320)!;
        const back = fromWire(toWire(snap));
        expect(back.width).toBe(snap.width);
        expect(back.elements.get('.x')![0]).toEqual(snap.elements.get('.x')![0]);
    });

    it('preserves scrollY when present', () => {
        const snap = { ...makeStore([320], ['.x']).snapshots.get(320)!, scrollY: 450 };
        expect(fromWire(toWire(snap)).scrollY).toBe(450);
    });

    it('storeToJSON survives JSON.stringify and rebuilds identical Maps', () => {
        const store = makeStore([320, 768, 1280], ['.a'], (w, sel) => [makeEl(sel, { rect: makeRect(0, 0, w / 2, 40) })]);
        const json = JSON.parse(JSON.stringify(storeToJSON(store)));
        const back = storeFromJSON(json);
        expect(back.widths).toEqual(store.widths);
        expect(back.selectors).toEqual(store.selectors);
        expect(back.snapshots.size).toBe(3);
        expect(back.snapshots.get(768)!.elements.get('.a')![0].rect.width).toBe(384);
    });

    it('storeFromJSON output feeds the scoring core (Maps, not objects)', () => {
        const store = makeStore([320], ['.a']);
        const back = storeFromJSON(JSON.parse(JSON.stringify(storeToJSON(store))));
        expect(back.snapshots instanceof Map).toBe(true);
        expect(back.snapshots.get(320)!.elements instanceof Map).toBe(true);
    });
});

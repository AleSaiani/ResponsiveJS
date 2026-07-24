import { describe, it, expect, vi } from 'vitest';
import { EvalSource } from '../src/source/eval.js';
import { sweepSource } from '../src/source/sweep.js';

const WIRE = { width: 768, height: 900, timestamp: 1, elements: [], childRelations: [] };

/** Fake eval primitive: answers innerWidth queries and collector injections. */
function makeEval(liveWidth = 1280, wire: unknown = WIRE) {
    const expressions: string[] = [];
    const fn = vi.fn(async (expression: string) => {
        expressions.push(expression);
        if (expression === 'window.innerWidth') return liveWidth;
        if (expression.includes('querySelectorAll')) return wire;
        return undefined;
    });
    return { fn, expressions };
}

describe('EvalSource', () => {
    it('measure without setViewport injects the collector with no width override', async () => {
        const { fn, expressions } = makeEval();
        const source = new EvalSource(fn);
        const snap = await source.measure(['.a']);

        const expr = expressions.find((e) => e.includes('querySelectorAll'));
        expect(expr).toBeDefined();
        expect(expr).not.toContain('"width"'); // as-is: the page reports its own size
        expect(snap.width).toBe(768);
        expect(snap.elements instanceof Map).toBe(true);
    });

    it('setViewport delegates to the callback and measure passes the explicit width', async () => {
        const { fn, expressions } = makeEval();
        const setViewport = vi.fn(async () => {});
        const source = new EvalSource(fn, { setViewport, settleMs: 0 });

        await source.setViewport(768, 900);
        expect(setViewport).toHaveBeenCalledWith(768, 900);

        await source.measure(['.a']);
        const expr = expressions.find((e) => e.includes('querySelectorAll'));
        expect(expr).toContain('"width":768');
        expect(expr).toContain('"height":900');
    });

    it('without a setter, setViewport accepts the live width (within tolerance)', async () => {
        const { fn } = makeEval(1280);
        const source = new EvalSource(fn);
        await expect(source.setViewport(1280, 900)).resolves.toBeUndefined();
        await expect(source.setViewport(1281, 900)).resolves.toBeUndefined(); // ±1 default
    });

    it('without a setter, setViewport refuses to lie about a mismatched width', async () => {
        const { fn } = makeEval(1280);
        const source = new EvalSource(fn);
        await expect(source.setViewport(320, 900)).rejects.toThrow(/live viewport is 1280px, not 320px/);
    });

    it('open is absent without a callback and present (delegating) with one', async () => {
        const { fn } = makeEval();
        expect(new EvalSource(fn).open).toBeUndefined();

        const open = vi.fn(async () => {});
        const source = new EvalSource(fn, { open });
        await source.open?.('http://x');
        expect(open).toHaveBeenCalledWith('http://x');
    });

    it('currentWidth reads the live innerWidth', async () => {
        const { fn } = makeEval(1024);
        const source = new EvalSource(fn);
        await expect(source.currentWidth()).resolves.toBe(1024);
    });

    it('measure parses a JSON-string wire (text transports) and rejects garbage', async () => {
        const asText = makeEval(1280, JSON.stringify(WIRE));
        const source = new EvalSource(asText.fn);
        const snap = await source.measure(['.a']);
        expect(snap.width).toBe(768);

        const garbage = makeEval(1280, 'not json at all');
        await expect(new EvalSource(garbage.fn).measure(['.a'])).rejects.toThrow(/non-JSON string/);
    });

    it('sweepSource drives an eval-only source at the live width', async () => {
        const { fn } = makeEval(1280, { ...WIRE, width: 1280 });
        const source = new EvalSource(fn);
        const store = await sweepSource(source, { selectors: ['.a'], widths: [1280] });
        expect(store.widths).toEqual([1280]);
        expect(store.snapshots.get(1280)?.width).toBe(1280);
    });

    it('sweepSource without open() rejects url sweeps with guidance', async () => {
        const { fn } = makeEval();
        const source = new EvalSource(fn);
        await expect(sweepSource(source, { url: 'http://x', selectors: ['.a'], widths: [1280] })).rejects.toThrow(
            /cannot open URLs/,
        );
    });
});

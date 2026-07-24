import { describe, it, expect, vi } from 'vitest';
import type { ElementSnapshot } from '@responsivejs/core/types';
import { main, type CliIo } from '../src/main.js';
import { FakeSource, makeEl, makeRect, makeSnapshot } from '../../design/tests/f3-fixtures.js';

/** A page where h1 tracks the viewport (capped at 400) and .card is fixed 480px wide. */
function fakeSource(): FakeSource {
    return new FakeSource((width, selectors) => {
        const elements = new Map<string, ElementSnapshot[]>();
        for (const sel of selectors) {
            if (sel === 'h1') {
                elements.set(sel, [makeEl(sel, { rect: makeRect(16, 16, Math.min(width, 400), 40) })]);
            } else if (sel === '.card') {
                elements.set(sel, [makeEl(sel, { rect: makeRect(0, 100, 480, 120) })]);
            }
        }
        return makeSnapshot(width, elements);
    });
}

function makeIo(files: Record<string, string> = {}) {
    const out: string[] = [];
    const err: string[] = [];
    const written: Record<string, string> = {};
    const writtenBytes: Record<string, Uint8Array> = {};
    const close = vi.fn(async () => {});
    const io: CliIo = {
        stdout: (t) => out.push(t),
        stderr: (t) => err.push(t),
        readFile: async (p) => {
            if (p in files) return files[p];
            throw new Error('ENOENT');
        },
        writeFile: async (p, t) => void (written[p] = t),
        writeFileBytes: async (p, b) => void (writtenBytes[p] = b),
        resolveDriver: vi.fn(async () => ({ kind: 'fake', source: fakeSource(), close })),
    };
    return { io, out, err, written, writtenBytes, close };
}

const CONTRACT = JSON.stringify({
    name: 'home',
    version: 1,
    viewport: { widths: [320, 1280] },
    rules: [{ assert: 'noOverflow', args: {} }],
    baselines: [{ selector: 'h1', prop: 'width' }],
});

describe('rjs main', () => {
    it('--help prints usage and exits 0; no command exits 2', async () => {
        const help = makeIo();
        expect(await main(['--help'], help.io)).toBe(0);
        expect(help.out.join('\n')).toContain('rjs <command>');

        const none = makeIo();
        expect(await main([], none.io)).toBe(2);
    });

    it('--version prints the package version', async () => {
        const { io, out } = makeIo();
        expect(await main(['--version'], io)).toBe(0);
        expect(out[0]).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('rejects unknown driver/format/command with exit 2', async () => {
        const a = makeIo();
        expect(await main(['analyze', 'http://x', '-d', 'selenium'], a.io)).toBe(2);
        expect(a.err.join('\n')).toContain("unknown driver 'selenium'");

        const b = makeIo();
        expect(await main(['analyze', 'http://x', '-f', 'xml'], b.io)).toBe(2);

        const c = makeIo();
        expect(await main(['paint', 'http://x'], c.io)).toBe(2);
        expect(c.err.join('\n')).toContain("unknown command 'paint'");
    });

    it('analyze finds the overflow, exits 1, closes the driver', async () => {
        const { io, out, close } = makeIo();
        const code = await main(['analyze', 'http://x', '-w', '320,1280', '-s', 'h1,.card', '-f', 'json', '--no-a11y'], io);
        expect(code).toBe(1); // 480px card overflows the 320px viewport
        const report = JSON.parse(out.join('\n'));
        expect(report.pass).toBe(false);
        expect(report.violations.some((v: { rule: string }) => v.rule === 'noOverflow')).toBe(true);
        expect(close).toHaveBeenCalledOnce();
    });

    it('analyze --out writes the report to a file', async () => {
        const { io, written, out } = makeIo();
        await main(['analyze', 'http://x', '-w', '1280', '-s', 'h1', '-f', 'sarif', '-o', 'report.sarif', '--no-a11y'], io);
        expect(written['report.sarif']).toContain('"2.1.0"');
        expect(out.join('\n')).toContain('report.sarif');
    });

    it('verify derives the sweep from the contract and reports violations', async () => {
        const { io, out } = makeIo({ 'home.json': CONTRACT });
        const code = await main(['verify', 'home.json', 'http://x', '-f', 'json'], io);
        expect(code).toBe(1); // noOverflow fails at 320
        const report = JSON.parse(out.join('\n'));
        expect(report.contract.name).toBe('home');
        expect(report.rules.some((r: { assert: string }) => r.assert === 'noOverflow')).toBe(true);
    });

    it('verify -f sarif emits SARIF with the contract rule ids', async () => {
        const { io, out } = makeIo({ 'home.json': CONTRACT });
        expect(await main(['verify', 'home.json', 'http://x', '-f', 'sarif'], io)).toBe(1);
        const sarif = JSON.parse(out.join('\n'));
        expect(sarif.version).toBe('2.1.0');
        const results = sarif.runs[0].results as { ruleId: string; message: { text: string } }[];
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].ruleId).toContain('noOverflow'); // auto id rule-1-noOverflow
        expect(results[0].message.text).toContain('[home]');
    });

    it('verify surfaces loader errors (did-you-mean) with exit 2', async () => {
        const bad = JSON.stringify({ name: 'x', version: 1, rules: [{ assert: 'noOverfow', args: {} }] });
        const { io, err } = makeIo({ 'bad.json': bad });
        expect(await main(['verify', 'bad.json', 'http://x'], io)).toBe(2);
        expect(err.join('\n')).toContain('noOverflow'); // suggestion
    });

    it('init generates a contract from the page manifest and writes it', async () => {
        const { io, out, written } = makeIo();
        const manifest = [
            { id: 1, construct: 'style', target: 'h1', behavior: ['fontSize: fluid'], config: { fontSize: { value: 'fluid', min: 16, max: 32 } } },
            { id: 2, construct: 'breakpoints', target: ':root', behavior: [], config: { m: 320, d: 1280 } },
        ];
        const source = new FakeSource((width, selectors) => ({ ...makeSnapshot(width, new Map(selectors.map((s) => [s, [makeEl(s)]]))), manifest }));
        (io.resolveDriver as ReturnType<typeof vi.fn>).mockResolvedValue({ kind: 'fake', source, close: async () => {} });

        expect(await main(['init', 'http://x', '-o', 'gen.json'], io)).toBe(0);
        const contract = JSON.parse(written['gen.json']);
        expect(contract.viewport.widths).toEqual([320, 1280]);
        expect(contract.rules.map((r: { assert: string }) => r.assert)).toEqual(['noOverflow', 'monotonic', 'continuous']);
        expect(contract.baselines).toEqual([{ selector: 'h1', prop: 'fontSize' }]);
        expect(out.join('\n')).toContain('rjs record gen.json'); // points to the next step
    });

    it('init without a manifest fails loudly with exit 2', async () => {
        const { io, err } = makeIo();
        expect(await main(['init', 'http://x'], io)).toBe(2);
        expect(err.join('\n')).toContain('no provenance manifest');
    });

    it('record measures baselines and writes the contract back', async () => {
        const { io, written, out } = makeIo({ 'home.json': CONTRACT });
        const code = await main(['record', 'home.json', 'http://x'], io);
        expect(code).toBe(0);
        const recorded = JSON.parse(written['home.json']);
        const curve = recorded.baselines[0].curve as [number, number][];
        expect(curve.map(([w]) => w)).toEqual([320, 1280]);
        expect(curve[0][1]).toBe(320); // h1 width = min(viewport, 400)
        expect(curve[1][1]).toBe(400);
        expect(out.join('\n')).toContain('r$ ✓ recorded 1 baseline');
    });

    it('record without baselines[] fails with guidance', async () => {
        const noBaselines = JSON.stringify({ name: 'x', version: 1, rules: [{ assert: 'noOverflow', args: {} }] });
        const { io, err } = makeIo({ 'x.json': noBaselines });
        expect(await main(['record', 'x.json', 'http://x'], io)).toBe(2);
        expect(err.join('\n')).toContain('no baselines');
    });
});

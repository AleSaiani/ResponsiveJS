/**
 * E2E: the rjs CLI end to end — real chromium via the playwright driver,
 * against the built landing example. Covers driver resolution, the full
 * analyze pipeline, and the record → verify contract round-trip.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { main, type CliIo } from '../src/main.js';
import { resolveDriver } from '../src/drivers.js';
import { buildLandingFixture, type LandingFixture } from '../../runtime/e2e/fixture.js';

let fixture: LandingFixture;
let url: string;

beforeAll(async () => {
    fixture = await buildLandingFixture();
    url = fixture.url;
}, 120_000);

afterAll(async () => {
    await fixture.close();
});

function makeIo(files: Record<string, string> = {}) {
    const out: string[] = [];
    const err: string[] = [];
    const written: Record<string, string> = {};
    const io: CliIo = {
        stdout: (t) => out.push(t),
        stderr: (t) => err.push(t),
        readFile: async (p) => {
            if (p in files) return files[p];
            throw new Error('ENOENT');
        },
        writeFile: async (p, t) => void (written[p] = t),
        resolveDriver,
    };
    return { io, out, err, written, files };
}

describe('rjs against a real page (playwright driver)', () => {
    it('analyze sweeps, measures and reports coherently', async () => {
        const { io, out } = makeIo();
        const code = await main(
            ['analyze', url, '-d', 'playwright', '-w', '400,1400', '-s', 'main,.hero h1,.card,.cta', '-f', 'json', '--no-a11y'],
            io,
        );
        const report = JSON.parse(out.join('\n'));
        expect([0, 1]).toContain(code);
        expect(report.widths).toEqual([400, 1400]);
        expect(report.sources.measurement).toBe('playwright');
        expect(report.summary).toBeDefined();
        expect(report.scores?.average?.overall).toBeGreaterThan(0);
    }, 120_000);

    it('record → verify round-trip: pinned baselines pass on the same page', async () => {
        const contract = JSON.stringify({
            name: 'landing',
            version: 1,
            viewport: { widths: [400, 1400] },
            rules: [
                { assert: 'minSize', args: { selector: '.cta', min: { height: 44 } }, description: 'tappable CTA' },
            ],
            baselines: [{ selector: '.hero h1', prop: 'fontSize' }],
        });

        const rec = makeIo({ 'landing.json': contract });
        expect(await main(['record', 'landing.json', url, '-d', 'playwright'], rec.io)).toBe(0);
        const recorded = JSON.parse(rec.written['landing.json']);
        const curve = recorded.baselines[0].curve as [number, number][];
        expect(curve.map(([w]) => w)).toEqual([400, 1400]);
        expect(curve[1][1]).toBeGreaterThan(curve[0][1]); // hero grows with width

        const ver = makeIo({ 'landing.json': rec.written['landing.json'] });
        const code = await main(['verify', 'landing.json', url, '-d', 'playwright', '-f', 'json'], ver.io);
        const report = JSON.parse(ver.out.join('\n'));
        expect(code).toBe(0);
        expect(report.pass).toBe(true);
    }, 180_000);
});

import { describe, it, expect, vi } from 'vitest';
import type { ElementSnapshot } from '@responsivejs/core/types';
import { main, type CliIo } from '../src/main.js';
import { crawlable } from '../src/commands/audit.js';
import { FakeSource, makeEl, makeRect, makeSnapshot } from '../../design/tests/f3-fixtures.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** h1 fits, .card overflows 320. Optional screenshot seam + canned crawl links. */
function fakeSource(opts: { screenshot?: boolean; links?: string[] } = {}): FakeSource {
    const source = new FakeSource((width, selectors) => {
        const elements = new Map<string, ElementSnapshot[]>();
        for (const sel of selectors) {
            if (sel === 'h1') elements.set(sel, [makeEl(sel, { rect: makeRect(16, 16, Math.min(width, 400), 40) })]);
            if (sel === 'main') elements.set(sel, [makeEl(sel, { rect: makeRect(0, 100, 480, 120) })]);
        }
        return makeSnapshot(width, elements);
    });
    if (opts.screenshot) source.screenshot = async () => PNG;
    if (opts.links) source.evalResults.set("Array.from(document.querySelectorAll('a[href]'))", opts.links);
    return source;
}

function makeIo(source: FakeSource) {
    const out: string[] = [];
    const err: string[] = [];
    const written: Record<string, string> = {};
    const writtenBytes: Record<string, Uint8Array> = {};
    const io: CliIo = {
        stdout: (t) => out.push(t),
        stderr: (t) => err.push(t),
        readFile: async () => {
            throw new Error('ENOENT');
        },
        writeFile: async (p, t) => void (written[p] = t),
        writeFileBytes: async (p, b) => void (writtenBytes[p] = b),
        resolveDriver: vi.fn(async () => ({ kind: 'fake', source, close: async () => {} })),
    };
    return { io, out, err, written, writtenBytes };
}

const BASE = ['-w', '320,1280', '-s', 'h1,main', '--no-a11y'];

describe('rjs audit', () => {
    it('writes a self-contained HTML report with embedded screenshots and overlays', async () => {
        const { io, out, written } = makeIo(fakeSource({ screenshot: true }));
        const code = await main(['audit', 'http://site.test/', ...BASE], io);
        expect(code).toBe(1); // main overflows at 320
        const html = written['rjs-audit.html'];
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('data:image/png;base64,');
        expect(html).toContain('noOverflow');
        expect(html).toContain('class="box"'); // measured violation rect overlay
        expect(out.join('\n')).toContain('rjs-audit.html');
    });

    it('degrades without the screenshot seam — says so, still reports', async () => {
        const { io, err, written } = makeIo(fakeSource());
        await main(['audit', 'http://site.test/', ...BASE], io);
        expect(err.join('\n')).toContain('cannot screenshot');
        expect(written['rjs-audit.html']).not.toContain('data:image/png');
    });

    it('--screenshots without the seam is a hard error (the flag was explicit)', async () => {
        const { io } = makeIo(fakeSource());
        expect(await main(['audit', 'http://site.test/', '--screenshots', 'shots', ...BASE], io)).toBe(2);
    });

    it('--screenshots <dir> writes the per-width PNGs', async () => {
        const { io, writtenBytes } = makeIo(fakeSource({ screenshot: true }));
        await main(['audit', 'http://site.test/', '--screenshots', 'shots', ...BASE], io);
        expect(Object.keys(writtenBytes).sort()).toEqual(['shots/site-test-320.png', 'shots/site-test-1280.png'].sort());
        expect(writtenBytes['shots/site-test-320.png']).toEqual(PNG);
    });

    it('--vs audits both and the report leads with the comparison', async () => {
        const { io, written } = makeIo(fakeSource());
        await main(['audit', 'http://site.test/', '--vs', 'http://rival.test/', ...BASE], io);
        const html = written['rjs-audit.html'];
        expect(html).toContain('Side by side');
        expect(html).toContain('http://site.test/');
        expect(html).toContain('http://rival.test/');
    });

    it('--crawl follows same-origin links up to --max-pages, reporting the rest', async () => {
        const { io, out, written } = makeIo(
            fakeSource({
                links: [
                    'http://site.test/about',
                    'http://site.test/about#team', // hash dup of the same page
                    'http://site.test/pricing',
                    'http://elsewhere.test/x', // cross-origin: never crawled
                ],
            }),
        );
        await main(['audit', 'http://site.test/', '--crawl', '--max-pages', '2', ...BASE], io);
        const html = written['rjs-audit.html'];
        expect(html).toContain('http://site.test/about');
        expect(html).not.toContain('pricing'); // beyond max-pages
        expect(html).not.toContain('elsewhere.test');
        expect(out.join('\n')).toContain('discovered but not audited');
    });
});

describe('crawlable', () => {
    it('normalizes same-origin http(s) links and rejects the rest', () => {
        const origin = 'http://site.test';
        expect(crawlable('http://site.test/a#x', origin)).toBe('http://site.test/a');
        expect(crawlable('http://other.test/a', origin)).toBeNull();
        expect(crawlable('mailto:x@y.z', origin)).toBeNull();
        expect(crawlable('not a url', origin)).toBeNull();
    });
});

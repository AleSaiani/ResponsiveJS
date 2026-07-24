import { describe, it, expect } from 'vitest';
import { runSnippet } from '../src/commands/snippet.js';
import type { CliIo, SharedOptions } from '../src/main.js';

const SHARED = { bookmarklet: false } as SharedOptions & { bookmarklet: boolean };

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
        writeFileBytes: async () => {},
        resolveDriver: async () => {
            throw new Error('unused');
        },
    };
    return { io, out, err, written };
}

const BUNDLE = 'var rjs=(()=>{return{mountOverlay(){}}})();';

describe('rjs snippet', () => {
    it('emits a paste-ready <script> block that mounts the overlay', async () => {
        const { io, out } = makeIo({ '/dist/browser-global.js': BUNDLE });
        expect(await runSnippet(SHARED, io, '/dist/browser-global.js')).toBe(0);
        const text = out.join('\n');
        expect(text).toContain('<script>');
        expect(text).toContain(BUNDLE);
        expect(text).toContain('rjs.mountOverlay();');
    });

    it('--bookmarklet emits an url-encoded javascript: URL', async () => {
        const { io, out } = makeIo({ '/dist/browser-global.js': BUNDLE });
        await runSnippet({ ...SHARED, bookmarklet: true }, io, '/dist/browser-global.js');
        const url = out.join('');
        expect(url.startsWith('javascript:')).toBe(true);
        expect(decodeURIComponent(url.slice('javascript:'.length))).toContain('rjs.mountOverlay()');
    });

    it('-o writes the snippet to a file with a size note', async () => {
        const { io, out, written } = makeIo({ '/dist/browser-global.js': BUNDLE });
        await runSnippet({ ...SHARED, out: 'snippet.html' }, io, '/dist/browser-global.js');
        expect(written['snippet.html']).toContain(BUNDLE);
        expect(out.join('\n')).toContain('snippet.html');
    });

    it('missing bundle fails with build guidance', async () => {
        const { io, err } = makeIo();
        expect(await runSnippet(SHARED, io, '/nope.js')).toBe(2);
        expect(err.join('\n')).toContain('build @responsivejs/design');
    });
});

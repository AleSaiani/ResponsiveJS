/**
 * rjs snippet — the injectable surface, packaged. Emits the browser-global
 * bundle (window.rjs) as a paste-ready <script> block, or as a bookmarklet
 * URL that mounts the <rjs-overlay> badge on ANY page you're looking at.
 * Everything is inline — nothing hosted, nothing to trust but your build.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CliIo, SharedOptions } from '../main.js';

export function resolveBundlePath(): string {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve('@responsivejs/design/package.json');
    return join(dirname(pkg), 'dist', 'browser-global.js');
}

export async function runSnippet(
    opts: SharedOptions & { bookmarklet: boolean },
    io: CliIo,
    bundlePath = resolveBundlePath(),
): Promise<number> {
    let code: string;
    try {
        code = await io.readFile(bundlePath);
    } catch {
        io.stderr(`r$ ✗ browser bundle not found at ${bundlePath} — build @responsivejs/design first`);
        return 2;
    }

    const text = opts.bookmarklet
        ? `javascript:${encodeURIComponent(`(()=>{${code};rjs.mountOverlay()})()`)}`
        : `<script>\n${code}\nrjs.mountOverlay();\n</script>`;

    if (opts.out) {
        await io.writeFile(opts.out, text);
        io.stdout(`r$ snippet → ${opts.out} (${Math.round(text.length / 1024)}kB, ${opts.bookmarklet ? 'bookmarklet URL' : '<script> block'})`);
    } else {
        io.stdout(text);
    }
    if (opts.bookmarklet && !opts.out) {
        io.stderr('r$ ~ save this URL as a bookmark; clicking it on any page mounts the r$ overlay');
    }
    return 0;
}

/**
 * Bundle the runtime as a single IIFE exposing `window.r$` (and the
 * `responsive` alias). esbuild lives ONLY in build scripts — the published
 * library itself is plain tsc output.
 */

import { build } from 'esbuild';

const result = await build({
    entryPoints: ['src/global.ts'],
    bundle: true,
    format: 'iife',
    globalName: '__rjsRuntime',
    outfile: 'dist/global.js',
    minify: true,
    target: 'es2022',
    metafile: true,
    banner: { js: '/* responsivejs runtime (MPL-2.0) — https://github.com/AleSaiani/ResponsiveJS */' },
    // The namespace object carries every named export; publish the callable
    // one under the two names the docs use.
    footer: { js: 'window.r$=__rjsRuntime.r$;window.responsive=__rjsRuntime.r$;' },
    logLevel: 'warning',
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`r$ runtime global → dist/global.js (${(bytes / 1024).toFixed(1)} kB raw)`);

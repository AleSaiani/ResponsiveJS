/**
 * Bundle the browser core as a single IIFE global (`window.rjs`).
 * esbuild lives ONLY here — the library itself ships plain tsc output.
 */

import { build } from 'esbuild';

await build({
    entryPoints: ['src/browser/global.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'rjs',
    outfile: 'dist/browser-global.js',
    minify: true,
    target: 'es2022',
    banner: {
        js: '/* responsivejs browser core (MPL-2.0) — https://github.com/AleSaiani/ResponsiveJS */',
    },
    logLevel: 'warning',
});

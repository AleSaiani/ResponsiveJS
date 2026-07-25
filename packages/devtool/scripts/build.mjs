/**
 * Bundle the extension: three esbuild entries (panel, devtools, background)
 * + static assets + the M4 browser-global bundle (fetched by the panel to
 * mount the overlay in the inspected page).
 */

import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
    entryPoints: [
        join(root, 'src/panel.ts'),
        join(root, 'src/sidebar.ts'),
        join(root, 'src/devtools.ts'),
        join(root, 'src/background.ts'),
    ],
    bundle: true,
    format: 'iife',
    outdir: join(root, 'dist'),
    minify: true,
    target: 'es2022',
    logLevel: 'warning',
});

await mkdir(join(root, 'dist'), { recursive: true });
for (const file of ['manifest.json', 'devtools.html', 'panel.html', 'sidebar.html']) {
    await cp(join(root, file), join(root, 'dist', file));
}

// the injectable overlay bundle from @responsivejs/design (built before us —
// pnpm orders workspace builds by dependency)
const require = createRequire(import.meta.url);
const designPkg = require.resolve('@responsivejs/design/package.json');
await cp(join(dirname(designPkg), 'dist', 'browser-global.js'), join(root, 'dist', 'browser-global.js'));

console.log('r$ devtool → dist/ (load unpacked in chrome://extensions)');

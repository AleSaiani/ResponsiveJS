/**
 * The repo's `docs/` tree is the single source of truth — it is read on
 * GitHub too. This copies it into the site and fixes up the links that only
 * make sense inside the repository:
 *
 *  - `README.md` → `index.md` (VitePress' directory index)
 *  - links to packages/ examples/ → GitHub URLs
 *  - `.md` links → clean URLs
 *
 * It never edits `docs/` itself: one content, one place.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'docs');
const OUT = join(here, '..', 'docs');
const REPO = 'https://github.com/AleSaiani/ResponsiveJS/blob/main';

async function* walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(path);
        else if (entry.name.endsWith('.md')) yield path;
    }
}

/** Rewrite one markdown link target. `depth` = how deep the file sits. */
function rewriteTarget(target) {
    if (/^(https?:|mailto:|#)/.test(target)) return target;

    // Anything that climbs out of docs/ points at the repository.
    const escapes = target.match(/^(\.\.\/)+/);
    if (escapes && !target.startsWith('../api/') && !target.startsWith('../guides/') && !target.startsWith('../agents/')) {
        return `${REPO}/${target.replace(/^(\.\.\/)+/, '')}`;
    }

    // README.md is the directory index; other .md links become clean URLs.
    return target
        .replace(/README\.md/g, 'index.md')
        .replace(/\.md(#|$)/, '$1');
}

async function main() {
    await rm(OUT, { recursive: true, force: true });

    let count = 0;
    for await (const file of walk(SRC)) {
        const rel = relative(SRC, file).replaceAll('\\', '/');
        const outRel = rel.replace(/(^|\/)README\.md$/, '$1index.md');
        const outPath = join(OUT, outRel);
        await mkdir(dirname(outPath), { recursive: true });

        const source = await readFile(file, 'utf8');
        const rewritten = source.replace(/\]\(([^)]+)\)/g, (_, target) => `](${rewriteTarget(target)})`);
        await writeFile(outPath, rewritten, 'utf8');
        count++;
    }
    console.log(`site: synced ${count} docs pages → site/docs/`);
}

await main();

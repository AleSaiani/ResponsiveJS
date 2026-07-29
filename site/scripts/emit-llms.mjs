/**
 * Agent-readable twins of the documentation.
 *
 * An agent that fetches a docs page gets HTML: a theme, a sidebar, a search
 * widget, and the prose somewhere inside. These outputs give it the source
 * instead — no scraping, no token budget spent on chrome.
 *
 *   /llms.txt          the index, in the llmstxt.org format
 *   /llms-full.txt     every page concatenated, for a single fetch
 *   /docs/<page>.md    the markdown twin of each rendered page
 *
 * Written into site/public/ so the dev server and the build both serve them.
 * Run after sync-docs.mjs — it reads site/docs/ (links already rewritten).
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = join(here, '..', 'docs');
const PUBLIC = join(here, '..', 'public');
const SITE = 'https://responsivejs.com';

/** Order and grouping mirror the sidebar: an index is only useful if it is
 *  opinionated about what to read first. */
const SECTIONS = [
    { title: 'Start here', pages: ['getting-started', 'adopting', 'tutorial', 'why', 'concepts', 'troubleshooting', 'index'] },
    { title: 'Guides', pages: ['guides/runtime', 'guides/case-studies', 'guides/validation', 'guides/testing', 'guides/ci', 'guides/agents'] },
    { title: 'Reference', pages: ['api/runtime', 'api/design', 'api/contract', 'api/cli', 'api/adapters', 'api/core'] },
    { title: 'Machine-readable I/O', pages: ['agents/authoring-reference', 'agents/validation-reference'] },
];

async function* walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(path);
        else if (entry.name.endsWith('.md')) yield path;
    }
}

/** First heading and first paragraph — enough for an agent to decide to fetch. */
function describe(source) {
    const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
    const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'Untitled';
    // The page's own first real paragraph: headings, quotes, tables and code
    // fences skipped. Reading the block after the first sub-heading, as this
    // used to, summarised "Getting started" as "Pick your entry:".
    for (const block of body.split(/\n\s*\n/)) {
        const text = block.trim();
        if (!text || /^[#>|:`<-]/.test(text) || text.startsWith('```')) continue;
        const plain = text
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/[*`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (plain.length < 40) continue;
        return { title, summary: plain.length > 180 ? `${plain.slice(0, 177)}…` : plain };
    }
    return { title, summary: '' };
}

async function main() {
    const pages = new Map();
    for await (const file of walk(DOCS)) {
        const slug = relative(DOCS, file).replaceAll('\\', '/').replace(/\.md$/, '');
        pages.set(slug, await readFile(file, 'utf8'));
    }

    // markdown twins, at the same path as the page plus .md
    await rm(join(PUBLIC, 'docs'), { recursive: true, force: true });
    for (const [slug, source] of pages) {
        const out = join(PUBLIC, 'docs', `${slug}.md`);
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, source, 'utf8');
    }

    const listed = new Set();
    const index = [
        '# ResponsiveJS (r$)',
        '',
        '> Author responsive behavior CSS cannot express — `value = f(width)` — then measure the',
        '> rendered page and fail CI when it disagrees. Linear values compile to a static `clamp()`,',
        '> so the common case ships as CSS with zero runtime JavaScript.',
        '',
        'Every link below is source markdown, not rendered HTML. `llms-full.txt` is all of it in one file.',
        '',
    ];

    for (const section of SECTIONS) {
        index.push(`## ${section.title}`, '');
        for (const slug of section.pages) {
            const source = pages.get(slug);
            if (!source) continue;
            listed.add(slug);
            const { title, summary } = describe(source);
            index.push(`- [${title}](${SITE}/docs/${slug}.md)${summary ? `: ${summary}` : ''}`);
        }
        index.push('');
    }

    const rest = [...pages.keys()].filter((slug) => !listed.has(slug)).sort();
    if (rest.length > 0) {
        index.push('## Optional', '');
        for (const slug of rest) index.push(`- [${describe(pages.get(slug)).title}](${SITE}/docs/${slug}.md)`);
        index.push('');
    }

    await writeFile(join(PUBLIC, 'llms.txt'), index.join('\n'), 'utf8');

    const ordered = [...SECTIONS.flatMap((s) => s.pages).filter((slug) => pages.has(slug)), ...rest];
    const full = ordered.map((slug) => `<!-- ${SITE}/docs/${slug} -->\n\n${pages.get(slug)}`).join('\n\n---\n\n');
    await writeFile(join(PUBLIC, 'llms-full.txt'), `# ResponsiveJS — complete documentation\n\n${full}`, 'utf8');

    console.log(`site: emitted llms.txt, llms-full.txt and ${pages.size} markdown twins → site/public/`);
}

await main();

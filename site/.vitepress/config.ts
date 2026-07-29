import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://responsivejs.com';
const OG_IMAGE = `${SITE}/og.png`;

/**
 * A page's own summary, taken from its first real paragraph — headings, code
 * fences, tables, admonitions and HTML skipped. Without this every page in the
 * site would share one description, which search results and link previews
 * both punish.
 */
function summarize(file: string): string | undefined {
    let source: string;
    try {
        source = readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
    const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
    for (const block of body.split(/\n\s*\n/)) {
        const text = block.trim();
        if (!text || /^[#>|:`<-]/.test(text) || text.startsWith('```')) continue;
        const plain = text
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their label
            .replace(/[*_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (plain.length < 40) continue;
        return plain.length > 155 ? `${plain.slice(0, 152).replace(/\s+\S*$/, '')}…` : plain;
    }
    return undefined;
}

// The docs tree under /docs is synced from the repository's docs/ by
// scripts/sync-docs.mjs — never edited here (one content, one place).
export default defineConfig({
    title: 'ResponsiveJS',
    titleTemplate: ':title · r$',
    description: 'Design as functions, not frames. Author responsive behavior CSS cannot express, then verify the rendered result.',
    lang: 'en-US',
    cleanUrls: true,
    lastUpdated: false,
    sitemap: { hostname: SITE },
    // public/docs/*.md are the agent-readable twins — static files, not pages.
    // Without this VitePress renders each one a second time under /public/docs/
    // and puts it in the sitemap: duplicate content, competing with the real page.
    srcExclude: ['public/**'],
    // Site-wide tags. Anything that differs per page is added in transformHead
    // below, so a shared link always previews the page it points at.
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        ['meta', { name: 'theme-color', content: '#0b7a43' }],
        ['meta', { name: 'author', content: 'Alessandro Saiani' }],
        ['meta', { property: 'og:site_name', content: 'ResponsiveJS' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:image', content: OG_IMAGE }],
        ['meta', { property: 'og:image:width', content: '1200' }],
        ['meta', { property: 'og:image:height', content: '630' }],
        [
            'meta',
            {
                property: 'og:image:alt',
                content: 'ResponsiveJS — a breakpoint ladder drawn in steps against a smooth fluid curve, and the gap between them.',
            },
        ],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:image', content: OG_IMAGE }],
        ['link', { rel: 'alternate', type: 'text/plain', href: `${SITE}/llms.txt`, title: 'llms.txt — docs index for agents' }],
        [
            'script',
            { type: 'application/ld+json' },
            JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareSourceCode',
                name: 'ResponsiveJS',
                alternateName: 'r$',
                description:
                    'Author responsive behavior CSS cannot express — value = f(width) — then measure the rendered page and fail CI when it disagrees.',
                url: SITE,
                codeRepository: 'https://github.com/AleSaiani/ResponsiveJS',
                programmingLanguage: 'TypeScript',
                license: 'https://www.mozilla.org/en-US/MPL/2.0/',
                author: { '@type': 'Person', name: 'Alessandro Saiani' },
            }),
        ],
    ],
    // Every docs page ships a markdown twin (scripts/emit-llms.mjs). Advertising
    // it in <head> is how an agent finds the source without scraping the theme.
    transformPageData(pageData, { siteConfig }) {
        // `??=` is not enough: VitePress has already filled this with the site
        // description by now, so every page would keep the same one.
        if (!pageData.frontmatter.description) {
            const summary = summarize(join(siteConfig.srcDir, pageData.relativePath));
            if (summary) pageData.description = summary;
        }

        if (!pageData.relativePath.startsWith('docs/')) return;
        const markdown = `/${pageData.relativePath}`;
        pageData.frontmatter.head ??= [];
        pageData.frontmatter.head.push([
            'link',
            { rel: 'alternate', type: 'text/markdown', href: markdown, title: 'Markdown source' },
        ]);
    },
    // Per-page canonical, title and description. Without this every shared link
    // previews as the site's front page, which is the same as no preview at all.
    transformHead({ pageData, description }) {
        const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
        const url = `${SITE}/${path}`;
        const title = pageData.frontmatter.title ?? pageData.title;
        const summary = pageData.frontmatter.description || pageData.description || description;
        return [
            ['link', { rel: 'canonical', href: url }],
            ['meta', { property: 'og:url', content: url }],
            ...(title ? [['meta', { property: 'og:title', content: `${title} · ResponsiveJS` }] as [string, Record<string, string>]] : []),
            ...(summary ? [['meta', { property: 'og:description', content: summary }] as [string, Record<string, string>]] : []),
        ];
    },
    themeConfig: {
        // the wordmark is a component (theme/components/Wordmark.vue): it measures
        // whether "ResponsiveJS" fits and falls back to "r$" when it does not
        siteTitle: false,
        nav: [
            { text: 'Demos', link: '/demos' },
            { text: 'Docs', link: '/docs/getting-started' },
            { text: 'Tutorial', link: '/docs/tutorial' },
            {
                text: 'Reference',
                items: [
                    { text: 'runtime', link: '/docs/api/runtime' },
                    { text: 'design', link: '/docs/api/design' },
                    { text: 'contract', link: '/docs/api/contract' },
                    { text: 'cli', link: '/docs/api/cli' },
                    { text: 'adapters', link: '/docs/api/adapters' },
                    { text: 'core', link: '/docs/api/core' },
                ],
            },
            { text: 'GitHub', link: 'https://github.com/AleSaiani/ResponsiveJS' },
        ],
        sidebar: {
            '/docs/': [
                {
                    text: 'Start',
                    items: [
                        { text: 'Getting started', link: '/docs/getting-started' },
                        { text: 'Adopting r$ in an existing site', link: '/docs/adopting' },
                        { text: 'Tutorial — build a page', link: '/docs/tutorial' },
                        { text: 'Why r$ (and when not to)', link: '/docs/why' },
                        { text: 'Concepts', link: '/docs/concepts' },
                        { text: 'Troubleshooting', link: '/docs/troubleshooting' },
                        { text: 'All docs by question', link: '/docs/' },
                    ],
                },
                {
                    text: 'Guides',
                    items: [
                        { text: 'Authoring (runtime)', link: '/docs/guides/runtime' },
                        { text: 'Pattern catalog', link: '/docs/guides/case-studies' },
                        { text: 'Validating (design)', link: '/docs/guides/validation' },
                        { text: 'Testing', link: '/docs/guides/testing' },
                        { text: 'CI', link: '/docs/guides/ci' },
                        { text: 'For AI agents', link: '/docs/guides/agents' },
                    ],
                },
                {
                    text: 'Reference',
                    items: [
                        { text: 'runtime', link: '/docs/api/runtime' },
                        { text: 'design', link: '/docs/api/design' },
                        { text: 'contract', link: '/docs/api/contract' },
                        { text: 'cli', link: '/docs/api/cli' },
                        { text: 'adapters (React/Vue/Angular)', link: '/docs/api/adapters' },
                        { text: 'core', link: '/docs/api/core' },
                    ],
                },
                {
                    text: 'For agents',
                    items: [
                        { text: 'Validation I/O', link: '/docs/agents/validation-reference' },
                        { text: 'Authoring I/O', link: '/docs/agents/authoring-reference' },
                    ],
                },
            ],
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/AleSaiani/ResponsiveJS' }],
        search: { provider: 'local' },
        footer: {
            message:
                'Built with r$ · verified by r$ in CI against <a href="https://github.com/AleSaiani/ResponsiveJS/blob/main/site/site.contract.json">its own contract</a> — 9 rules, 8 widths, every build. Agents: <a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a>.',
            copyright: 'MPL-2.0 licensed',
        },
        editLink: {
            pattern: 'https://github.com/AleSaiani/ResponsiveJS/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
    },
});

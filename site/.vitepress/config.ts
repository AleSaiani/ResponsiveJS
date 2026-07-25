import { defineConfig } from 'vitepress';

// The docs tree under /docs is synced from the repository's docs/ by
// scripts/sync-docs.mjs — never edited here (one content, one place).
export default defineConfig({
    title: 'ResponsiveJS',
    titleTemplate: ':title · r$',
    description: 'Design as functions, not frames. Author responsive behavior CSS cannot express, then verify the rendered result.',
    lang: 'en-US',
    cleanUrls: true,
    lastUpdated: false,
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        ['meta', { name: 'theme-color', content: '#255fd8' }],
        ['meta', { property: 'og:title', content: 'ResponsiveJS — value = f(width)' }],
        [
            'meta',
            {
                property: 'og:description',
                content: 'Author responsive behavior CSS cannot express, then verify the rendered result — for developers and agents.',
            },
        ],
    ],
    themeConfig: {
        siteTitle: 'r$',
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
                        { text: 'Tutorial — build a page', link: '/docs/tutorial' },
                        { text: 'Concepts', link: '/docs/concepts' },
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
                'Built with r$ · verified by r$ in CI against <a href="https://github.com/AleSaiani/ResponsiveJS/blob/main/site/site.contract.json">its own contract</a> — 9 rules, 6 widths, every build.',
            copyright: 'MPL-2.0 licensed',
        },
        editLink: {
            pattern: 'https://github.com/AleSaiani/ResponsiveJS/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
    },
});

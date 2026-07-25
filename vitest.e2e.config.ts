import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// E2E suite: real Chromium via Playwright. Kept out of the default test run —
// CI has a dedicated job that installs the browser first.
export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@responsivejs\/core$/,
                replacement: resolve(import.meta.dirname, 'packages/core/src/index.ts'),
            },
            {
                find: /^@responsivejs\/core\/(.*)$/,
                replacement: resolve(import.meta.dirname, 'packages/core/src/$1.ts'),
            },
            {
                find: /^@responsivejs\/contract$/,
                replacement: resolve(import.meta.dirname, 'packages/contract/src/index.ts'),
            },
            {
                find: /^@responsivejs\/design$/,
                replacement: resolve(import.meta.dirname, 'packages/design/src/index.ts'),
            },
            {
                find: /^@responsivejs\/design\/browser$/,
                replacement: resolve(import.meta.dirname, 'packages/design/src/browser/index.ts'),
            },
            {
                find: /^@responsivejs\/react$/,
                replacement: resolve(import.meta.dirname, 'packages/react/src/index.ts'),
            },
            {
                find: /^@responsivejs\/vue$/,
                replacement: resolve(import.meta.dirname, 'packages/vue/src/index.ts'),
            },
        ],
    },
    test: {
        environment: 'node',
        include: ['packages/*/e2e/**/*.e2e.test.ts'],
        testTimeout: 60_000,
        hookTimeout: 120_000,
        // e2e files share the landing fixture build and a real browser: serial.
        fileParallelism: false,
    },
});

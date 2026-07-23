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
        ],
    },
    test: {
        environment: 'node',
        include: ['packages/*/e2e/**/*.e2e.test.ts'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});

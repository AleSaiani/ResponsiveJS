import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Both aliases must stay in sync with the subpath exports of @responsivejs/core:
// tests and typecheck resolve core from src, so no build is needed to run them.
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
                find: /^@responsivejs\/runtime$/,
                replacement: resolve(import.meta.dirname, 'packages/runtime/src/index.ts'),
            },
            {
                find: /^@responsivejs\/runtime\/(.*)$/,
                replacement: resolve(import.meta.dirname, 'packages/runtime/src/$1.ts'),
            },
            {
                find: /^@responsivejs\/contract$/,
                replacement: resolve(import.meta.dirname, 'packages/contract/src/index.ts'),
            },
            {
                find: /^@responsivejs\/contract\/(.*)$/,
                replacement: resolve(import.meta.dirname, 'packages/contract/src/$1.ts'),
            },
        ],
    },
    test: {
        environment: 'node',
        include: ['packages/*/tests/**/*.test.ts'],
    },
});

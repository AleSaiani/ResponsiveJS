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
            {
                find: /^@responsivejs\/angular$/,
                replacement: resolve(import.meta.dirname, 'packages/angular/src/index.ts'),
            },
        ],
    },
    test: {
        environment: 'node',
        include: ['packages/*/tests/**/*.test.{ts,tsx}'],
    },
});

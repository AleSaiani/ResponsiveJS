import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['**/dist/', '**/node_modules/', '**/coverage/'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            // The measurement/observer modules contain in-page code (window, document,
            // ResizeObserver) that runs inside the browser via eval/page.evaluate.
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // The page.evaluate serialization boundary is untyped by nature: values
        // cross a structured-clone bridge and TS cannot see the in-page types.
        files: ['packages/design/src/driver/**', 'packages/design/src/realtime/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        // The dependency-tracking stack assigns `this` to the module-level
        // currentObserver — intentional observer-pattern, not an alias smell.
        files: ['packages/runtime/src/signals.ts'],
        rules: {
            '@typescript-eslint/no-this-alias': 'off',
        },
    },
);

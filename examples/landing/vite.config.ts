import { defineConfig } from 'vite';

// Relative base → the built dist works from file:// (the e2e suite loads it
// without a server).
export default defineConfig({
    base: './',
});

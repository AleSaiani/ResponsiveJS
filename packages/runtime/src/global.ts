/**
 * IIFE entry — the no-build surface. Drop the bundle in with a <script> tag
 * and `window.r$` is the same callable namespace the npm package exports.
 *
 * This is the one thing the 2013 library did that the rewrite did not: no
 * bundler, no module system, just a script tag. It also powers live docs
 * demos and agents that inject the runtime into a page.
 */

export * from './index.js';

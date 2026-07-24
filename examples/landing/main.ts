/**
 * The r$ constructs this page demonstrates, side by side with the hack each
 * one replaces. See README.md for the full walkthrough.
 * (Named imports of the same functions exist for tree-shaking-sensitive code.)
 */

import { r$ } from '@responsivejs/runtime';

// ── 1. Typed breakpoints — names the compiler checks ────────────────────
const bp = r$.breakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

// ── 2. Token bridge — the design scale as fluid custom properties ───────
// Linear → a static clamp() stylesheet on :root, ZERO runtime JS.
r$.tokens({
    '--space-s': r$.fluid(8, 12),
    '--space-m': r$.fluid(16, 24),
    '--space-l': r$.fluid(32, 56),
    '--font-body': r$.fluid(15, 18),
    '--font-hero': r$.fluid(28, 64, { curve: 'exponential' }), // non-linear → JS-driven var
});

// ── 3. Geometry predicates — state CSS can't select on ──────────────────
// The nav gets data-wrapped when its links no longer fit on one row;
// style.css turns that into the burger. No magic breakpoint to maintain.
r$.geometry('.site-nav', { wrapped: r$.whenWraps, crowded: r$.whenOverflows });
r$.geometry('.site-header', { stuck: r$.whenStuck() });

// ── 4. Cross-element — relations CSS cannot declare ─────────────────────
r$.sync('.card h3', 'height'); // equal heading heights across the card row
r$('.hero .tagline', {
    // The tagline's size follows the SIDEBAR's width, not the viewport.
    fontSize: r$.fluid(14, 18, { domain: r$.fromElement('.sidebar'), from: 200, to: 400 }),
});

// ── 5. Conditional layout with the typed names ──────────────────────────
r$('.cards', {
    gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)'),
});

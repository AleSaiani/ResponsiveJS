/**
 * The r$ constructs this page demonstrates, side by side with the hack each
 * one replaces. See README.md for the full walkthrough.
 */

import { responsive, fluid, defineBreakpoints, geometry, whenWraps, whenOverflows, whenStuck, sync, fromElement } from '@responsivejs/runtime';

// ── 1. Typed breakpoints — names the compiler checks ────────────────────
const bp = defineBreakpoints({ mobile: 320, tablet: 768, desktop: 1280 } as const);

// ── 2. Token bridge — the design scale as fluid custom properties ───────
// Linear → a static clamp() stylesheet on :root, ZERO runtime JS.
responsive.tokens({
    '--space-s': fluid(8, 12),
    '--space-m': fluid(16, 24),
    '--space-l': fluid(32, 56),
    '--font-body': fluid(15, 18),
    '--font-hero': fluid(28, 64, { curve: 'exponential' }), // non-linear → JS-driven var
});

// ── 3. Geometry predicates — state CSS can't select on ──────────────────
// The nav gets data-wrapped when its links no longer fit on one row;
// style.css turns that into the burger. No magic breakpoint to maintain.
geometry('.site-nav', { wrapped: whenWraps, crowded: whenOverflows });
geometry('.site-header', { stuck: whenStuck() });

// ── 4. Cross-element — relations CSS cannot declare ─────────────────────
sync('.card h3', 'height'); // equal heading heights across the card row
responsive('.hero .tagline', {
    // The tagline's size follows the SIDEBAR's width, not the viewport.
    fontSize: fluid(14, 18, { domain: fromElement('.sidebar'), from: 200, to: 400 }),
});

// ── 5. Conditional layout with the typed names ──────────────────────────
responsive('.cards', {
    gridTemplateColumns: bp.below('tablet', '1fr', 'repeat(3, 1fr)'),
});

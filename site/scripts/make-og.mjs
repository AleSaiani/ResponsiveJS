/**
 * Renders the social preview card to site/public/og.png.
 *
 * Committed as an image because Open Graph consumers do not accept SVG, and
 * generated from markup so it can be re-rendered when the pitch changes:
 *
 *   pnpm --filter responsivejs-site og
 *
 * The chart is the same story the home page tells: a breakpoint ladder in
 * steps against a fluid curve, and the gap between them.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'og.png');

const W = 1200;
const H = 630;

// chart geometry, in the card's own coordinates
const PLOT = { x: 660, y: 150, w: 460, h: 300 };
const MIN = 320;
const MAX = 1440;
const px = (w) => PLOT.x + ((w - MIN) / (MAX - MIN)) * PLOT.w;
const py = (v) => PLOT.y + PLOT.h - ((v - 12) / (48 - 12)) * PLOT.h;

const curve = Array.from({ length: 57 }, (_, i) => {
    const w = MIN + (i * (MAX - MIN)) / 56;
    const v = 18 + ((w - MIN) / (MAX - MIN)) * 30; // fluid(18, 48)
    return `${i ? 'L' : 'M'} ${px(w).toFixed(1)} ${py(v).toFixed(1)}`;
}).join(' ');

const STEPS = [
    [MIN, 768, 18],
    [768, 1024, 28],
    [1024, MAX, 40],
];
const steps = STEPS.flatMap(([from, to, v], i) => {
    const segment = [`M ${px(from).toFixed(1)} ${py(v).toFixed(1)}`, `L ${px(to).toFixed(1)} ${py(v).toFixed(1)}`];
    const next = STEPS[i + 1];
    return next ? [...segment, `L ${px(to).toFixed(1)} ${py(next[2]).toFixed(1)}`] : segment;
}).join(' ');

const GAP_W = 560;
const gapTop = py(18 + ((GAP_W - MIN) / (MAX - MIN)) * 30);
const gapBottom = py(18);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
      width: ${W}px; height: ${H}px;
      background: #0b0f14;
      color: #e9eef5;
      font-family: Inter, -apple-system, 'Segoe UI', system-ui, sans-serif;
      display: grid; grid-template-columns: 1fr 1fr; align-items: center;
      padding: 64px;
      position: relative; overflow: hidden;
  }
  .glow { position: absolute; inset: -30% 40% 40% -20%; background: radial-gradient(circle, rgba(11,122,67,.30), transparent 62%); }
  .left { position: relative; z-index: 1; padding-right: 24px; }
  .mark { display: inline-flex; align-items: center; gap: 14px; margin-bottom: 34px; }
  .badge { background: #0f9d58; color: #fff; font-family: ui-monospace, monospace; font-weight: 700;
           font-size: 30px; border-radius: 12px; padding: 4px 14px; }
  .name { font-size: 30px; font-weight: 700; color: #4ade80; letter-spacing: -.01em; }
  h1 { font-size: 60px; line-height: 1.04; letter-spacing: -.028em; font-weight: 700; }
  h1 em { font-style: normal; color: #4ade80; }
  p { margin-top: 24px; font-size: 25px; line-height: 1.45; color: #9fb0c3; }
  code { font-family: ui-monospace, monospace; color: #e9eef5; }
  .url { position: absolute; left: 64px; bottom: 52px; font-size: 21px; color: #6c8099; letter-spacing: .01em; }
  svg { display: block; }
  .cap { fill: #6c8099; font-size: 19px; font-family: ui-monospace, monospace; }
  .cap-curve { fill: #4ade80; }
</style></head><body>
  <div class="glow"></div>
  <div class="left">
      <div class="mark"><span class="badge">r$</span><span class="name">ResponsiveJS</span></div>
      <h1>Design as <em>functions</em>,<br>not frames.</h1>
      <p>Declare what happens <em style="font-style:italic;color:#e9eef5">between</em> your breakpoints —
         then measure whether the browser agreed.</p>
  </div>
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">
      <line x1="${PLOT.x}" y1="${PLOT.y + PLOT.h}" x2="${PLOT.x + PLOT.w}" y2="${PLOT.y + PLOT.h}" stroke="#243040" stroke-width="2"/>
      <path d="${steps}" fill="none" stroke="#5b6b80" stroke-width="4" stroke-dasharray="9 8"/>
      <path d="${curve}" fill="none" stroke="#4ade80" stroke-width="6" stroke-linecap="round"/>
      <line x1="${px(GAP_W)}" y1="${gapTop}" x2="${px(GAP_W)}" y2="${gapBottom}" stroke="#f59e0b" stroke-width="5"/>
      <circle cx="${px(GAP_W)}" cy="${gapTop}" r="8" fill="#4ade80"/>
      <circle cx="${px(GAP_W)}" cy="${gapBottom}" r="7" fill="#5b6b80"/>
      <text class="cap" x="${PLOT.x}" y="${PLOT.y + PLOT.h + 34}">320px</text>
      <text class="cap" x="${PLOT.x + PLOT.w}" y="${PLOT.y + PLOT.h + 34}" text-anchor="end">1440px</text>
      <text class="cap" x="${px(1430)}" y="${py(31)}" text-anchor="end">@media ladder</text>
      <text class="cap cap-curve" x="${px(420)}" y="${py(33)}">fluid(18, 48)</text>
  </svg>
  <div class="url">responsivejs.com</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(200);
await writeFile(OUT, await page.screenshot({ type: 'png' }));
await browser.close();
console.log(`site: wrote ${OUT} (${W}×${H})`);

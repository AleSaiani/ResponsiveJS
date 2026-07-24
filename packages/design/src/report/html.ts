/**
 * Self-contained HTML audit report — the presentable face of the oracle.
 * One file, no external assets: inline CSS, screenshots embedded as data
 * URIs, violation rectangles drawn as overlays on the per-width shots
 * (positions come from the measured rects, not from image analysis).
 */

import type { SnapshotStore, Violation } from '@responsivejs/core/types';
import type { UnifiedReport } from '../analyze/core.js';

export interface PageAudit {
    url: string;
    report: UnifiedReport;
    /** Enables screenshot overlays (rect lookup + embedded images). */
    store?: SnapshotStore;
}

const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toBase64(bytes: Uint8Array): string {
    const B = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(e: string): string } } }).Buffer;
    if (B) return B.from(bytes).toString('base64');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
}

const SEV_COLOR: Record<string, string> = { error: '#d33', warning: '#d90', info: '#28c' };

function sevOf(v: Violation): string {
    return v.severity ?? 'error';
}

function statusBadge(report: UnifiedReport): string {
    return report.pass
        ? '<span class="badge pass">PASS</span>'
        : '<span class="badge fail">FAIL</span>';
}

function summaryRow(page: PageAudit): string {
    const { report } = page;
    const s = report.summary;
    const overall = report.scores?.average.overall;
    return `<tr><td class="url">${esc(page.url)}</td><td>${statusBadge(report)}</td>
<td>${s.errors}</td><td>${s.warnings}</td><td>${s.info}</td><td>${report.total}</td>
<td>${overall !== undefined ? overall.toFixed(2) : '—'}</td></tr>`;
}

function violationsSection(report: UnifiedReport): string {
    if (report.violations.length === 0) return '<p class="clean">No violations.</p>';
    const byRule = new Map<string, Violation[]>();
    for (const v of report.violations) {
        (byRule.get(v.rule) ?? byRule.set(v.rule, []).get(v.rule)!).push(v);
    }
    const blocks: string[] = [];
    for (const [rule, violations] of byRule) {
        const byElement = new Map<string, Violation[]>();
        for (const v of violations) {
            const el = v.element || v.elements?.join(' + ') || '?';
            (byElement.get(el) ?? byElement.set(el, []).get(el)!).push(v);
        }
        const rows = [...byElement].map(([el, vs]) => {
            const widths = [...new Set(vs.map((v) => v.width))].sort((a, b) => a - b).join(', ');
            const first = vs[0];
            const owner = first.owner
                ? `<div class="owner">owned by <code>${esc(first.owner.construct)}</code>${first.owner.source ? ` at <code>${esc(first.owner.source)}</code>` : ''}</div>`
                : '';
            return `<li><span class="dot" style="background:${SEV_COLOR[sevOf(first)]}"></span>
<code>${esc(el)}</code> <span class="w">@${widths}px</span> — ${esc(first.detail)}${owner}</li>`;
        });
        blocks.push(`<details open><summary>${esc(rule)} <span class="count">${violations.length}</span></summary>
<ul>${rows.join('\n')}</ul></details>`);
    }
    return blocks.join('\n');
}

function fixesSection(report: UnifiedReport): string {
    if (report.fixes.length === 0) return '';
    const rows = report.fixes.map(
        (f) => `<tr><td><code>${esc(f.selector)}</code></td><td><code>${esc(f.property)}: ${esc(f.value)}</code></td><td>${esc(f.reason)}</td></tr>`,
    );
    return `<h3>Apply-verbatim fixes</h3>
<table class="fixes"><thead><tr><th>selector</th><th>declaration</th><th>reason</th></tr></thead>
<tbody>${rows.join('\n')}</tbody></table>`;
}

/** Violation rectangles at one width, as percentage-positioned overlay divs. */
function overlayBoxes(store: SnapshotStore, report: UnifiedReport, width: number): string {
    const snapshot = store.snapshots.get(width);
    if (!snapshot) return '';
    const boxes: string[] = [];
    for (const v of report.violations) {
        if (v.width !== width || !v.element) continue;
        const selector = v.element.replace(/\[\d+\]$/, '');
        const index = Number(/\[(\d+)\]$/.exec(v.element)?.[1] ?? 0);
        const el = snapshot.elements.get(selector)?.find((e) => e.index === index);
        if (!el || el.rect.width <= 0) continue;
        const pct = (n: number, base: number): string => `${((n / base) * 100).toFixed(2)}%`;
        boxes.push(
            `<div class="box" style="left:${pct(el.rect.x, width)};top:${pct(el.rect.y, snapshot.height)};width:${pct(el.rect.width, width)};height:${pct(el.rect.height, snapshot.height)};border-color:${SEV_COLOR[sevOf(v)]}" title="${esc(`${v.rule} ${v.element}: ${v.detail}`)}"></div>`,
        );
    }
    return boxes.join('\n');
}

function screenshotsSection(page: PageAudit): string {
    const shots = page.store?.screenshots;
    if (!shots || shots.size === 0) return '';
    const figures = [...shots]
        .sort((a, b) => a[0] - b[0])
        .map(
            ([w, bytes]) => `<figure>
<figcaption>@${w}px</figcaption>
<div class="shot" style="max-width:${w}px">
<img src="data:image/png;base64,${toBase64(bytes)}" alt="viewport at ${w}px" />
${page.store ? overlayBoxes(page.store, page.report, w) : ''}
</div></figure>`,
        );
    return `<h3>Screenshots <span class="hint">(boxes = measured violation rects)</span></h3>
<div class="shots">${figures.join('\n')}</div>`;
}

function pageSection(page: PageAudit): string {
    const { report } = page;
    return `<section>
<h2>${statusBadge(report)} ${esc(page.url)}</h2>
<p class="meta">${report.summary.errors} errors · ${report.summary.warnings} warnings · ${report.summary.info} info ·
${report.total} checks @ [${report.widths.join(', ')}]px · measured by ${esc(report.sources.measurement)} ·
a11y: ${esc(report.sources.a11y)}${report.scores ? ` · score ${report.scores.average.overall.toFixed(2)}` : ''}</p>
${violationsSection(report)}
${fixesSection(report)}
${screenshotsSection(page)}
</section>`;
}

/** Render one or more page audits into a single self-contained HTML document.
 *  With 2+ pages a comparison table leads (audit --vs / --crawl). */
export function renderAuditHTML(pages: PageAudit[], opts: { title?: string } = {}): string {
    const title = opts.title ?? 'r$ audit';
    const compare =
        pages.length > 1
            ? `<h2>Side by side</h2>
<table class="compare"><thead><tr><th>page</th><th>status</th><th>errors</th><th>warnings</th><th>info</th><th>checks</th><th>score</th></tr></thead>
<tbody>${pages.map(summaryRow).join('\n')}</tbody></table>`
            : '';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
body { font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 70rem; padding: 0 1rem; color: #1a1a1a; }
h1 { font-size: 1.5rem; } h2 { font-size: 1.15rem; margin-top: 2.5rem; } h3 { font-size: 1rem; }
code { background: #f3f3f3; padding: 0 .3em; border-radius: 3px; font-size: .92em; }
.badge { font-weight: 700; padding: .1em .5em; border-radius: 4px; color: #fff; font-size: .8em; vertical-align: middle; }
.badge.pass { background: #2a9d4a; } .badge.fail { background: #d33; }
.meta { color: #666; font-size: .9em; }
details { margin: .6rem 0; } summary { cursor: pointer; font-weight: 600; }
.count { color: #666; font-weight: 400; }
ul { list-style: none; padding-left: 1rem; } li { margin: .35rem 0; }
.dot { display: inline-block; width: .6em; height: .6em; border-radius: 50%; margin-right: .4em; }
.w { color: #666; font-size: .9em; }
.owner { color: #666; font-size: .85em; margin-left: 1.6em; }
table { border-collapse: collapse; margin: .8rem 0; } th, td { text-align: left; padding: .35rem .8rem; border-bottom: 1px solid #e5e5e5; }
.url { max-width: 28rem; overflow-wrap: anywhere; }
.clean { color: #2a9d4a; font-weight: 600; }
.shots { display: flex; flex-wrap: wrap; gap: 1.2rem; }
.shot { position: relative; border: 1px solid #ddd; }
.shot img { display: block; width: 100%; height: auto; }
.box { position: absolute; border: 2px solid; box-sizing: border-box; pointer-events: auto; }
figure { margin: 0; } figcaption { font-size: .85em; color: #666; margin-bottom: .3rem; }
.hint { font-weight: 400; color: #666; font-size: .85em; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
${compare}
${pages.map(pageSection).join('\n')}
<p class="meta">generated by responsivejs — exit gate: PASS = zero error-severity violations</p>
</body>
</html>
`;
}

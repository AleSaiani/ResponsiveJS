/// <reference types="chrome" />
/**
 * The r$ panel — the closed loop, visualized.
 *
 * Quick check: inspectedWindow.eval runs the in-page collector at the live
 * viewport → analyzeStore in the panel (score HUD + findings). Sweep: CDP
 * emulation via the background's chrome.debugger proxy runs the REAL
 * multi-width oracle. Curves: StoreQuery over the swept store, drawn as
 * SVG. Recorder: what you pinned becomes a contract JSON for `rjs verify`.
 */

import { analyzeStore, buildCollectExpression, fromWire, type UnifiedReport, type ViewportSnapshotWire } from '@responsivejs/design/browser';
import type { SnapshotStore, Violation } from '@responsivejs/core/types';
import { makeCdpClient, fullSweep, curveOf, type TabCdp } from './engine.js';
import { curveToSvg } from './curve-svg.js';
import { buildRecordedContract, type RecordedBaseline } from './recorder.js';

// ─── state ──────────────────────────────────────────────────────────────

let store: SnapshotStore | null = null;
let report: UnifiedReport | null = null;
let cdp: TabCdp | null = null;
const baselines: RecordedBaseline[] = [];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const messenger = {
    send: (msg: Record<string, unknown>) => chrome.runtime.sendMessage(msg) as Promise<{ ok?: boolean; result?: unknown; error?: string }>,
};

function evalInPage<T>(expression: string): Promise<T> {
    return new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(expression, (result, err) => {
            if (err) reject(new Error(err.description ?? 'eval failed'));
            else resolve(result as T);
        });
    });
}

// ─── quick check (live viewport) ────────────────────────────────────────

async function quickCheck(): Promise<void> {
    status('measuring at the live viewport…');
    const wire = await evalInPage<ViewportSnapshotWire>(buildCollectExpression({ selectors: selectors() }));
    const snap = fromWire(wire);
    store = { snapshots: new Map([[snap.width, snap]]), widths: [snap.width], selectors: selectors(), ...(snap.manifest ? { manifest: snap.manifest } : {}) };
    report = analyzeStore(store, constraints());
    render();
    status(`live check at ${snap.width}px`);
}

// ─── full sweep (CDP emulation) ─────────────────────────────────────────

async function sweep(): Promise<void> {
    const widths = ($<HTMLInputElement>('widths').value || '320,768,1280')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    status(`attaching debugger + sweeping ${widths.join(', ')}px…`);
    try {
        const tabId = chrome.devtools.inspectedWindow.tabId;
        cdp ??= makeCdpClient(messenger, tabId);
        await cdp.attach();
        const touchMin = constraints().constraints?.touchTarget?.min;
        const outcome = await fullSweep(cdp, { widths, selectors: selectors(), touchMin });
        store = outcome.store;
        report = outcome.report;
        render();
        renderCurveControls();
        status(`swept ${widths.length} widths — pick an element in Curves to inspect f(width)`);
    } catch (e) {
        status(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        await cdp?.detach().catch(() => {});
    }
}

// ─── render: report + score HUD ─────────────────────────────────────────

const SEV: Record<string, string> = { error: '#e5484d', warning: '#d9822b', info: '#3b82f6' };

function render(): void {
    if (!report) return;
    const s = report.summary;
    $('hud').innerHTML = '';
    const badge = el('span', report.pass ? 'pass' : 'fail', report.pass ? 'PASS' : 'FAIL');
    const counts = el('span', 'counts', ` ${s.errors}E · ${s.warnings}W · ${s.info}I · ${report.total} checks`);
    $('hud').append(badge, counts);
    if (report.scores) {
        const score = el('span', 'score', ` · score ${report.scores.average.overall.toFixed(2)}`);
        score.title = Object.entries(report.scores.average)
            .filter(([k]) => k !== 'overall')
            .map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`)
            .join('\n');
        $('hud').append(score);
    }

    const list = $('violations');
    list.innerHTML = '';
    const byRule = new Map<string, Violation[]>();
    for (const v of report.violations) (byRule.get(v.rule) ?? byRule.set(v.rule, []).get(v.rule)!).push(v);
    for (const [rule, violations] of byRule) {
        const details = document.createElement('details');
        details.open = true;
        const summary = document.createElement('summary');
        summary.textContent = `${rule} (${violations.length})`;
        details.append(summary);
        for (const v of violations.slice(0, 50)) {
            const row = el('div', 'violation');
            const dot = el('span', 'dot', '');
            dot.style.background = SEV[v.severity ?? 'error'];
            const target = el('code', '', v.element ?? v.elements?.join(' + ') ?? '?');
            row.append(dot, target, document.createTextNode(` @${v.width}px — ${v.detail}`));
            if (v.owner) row.append(el('div', 'owner', `↳ ${v.owner.construct}${v.owner.source ? ` at ${v.owner.source}` : ''}`));
            row.addEventListener('click', () => highlight(v.element));
            details.append(row);
        }
        list.append(details);
    }
    if (report.violations.length === 0) list.append(el('div', 'clean', 'No violations.'));
}

function highlight(element: string | undefined): void {
    if (!element) return;
    const selector = element.replace(/\[\d+\]$/, '');
    const index = Number(/\[(\d+)\]$/.exec(element)?.[1] ?? 0);
    void evalInPage(
        `inspect(document.querySelectorAll(${JSON.stringify(selector)})[${index}])`,
    ).catch(() => {});
}

// ─── curves ─────────────────────────────────────────────────────────────

function renderCurveControls(): void {
    if (!store) return;
    const sel = $<HTMLSelectElement>('curve-selector');
    sel.innerHTML = '';
    for (const s of store.selectors) sel.append(new Option(s, s));
    drawCurve();
}

function drawCurve(): void {
    if (!store) return;
    const selector = $<HTMLSelectElement>('curve-selector').value;
    const prop = $<HTMLSelectElement>('curve-prop').value as 'width' | 'height' | 'x' | 'y' | 'fontSize';
    if (!selector) return;
    const curve = curveOf(store, selector, prop);
    const svg = curveToSvg(curve, 320, 140);
    const dots = svg.points
        .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3"><title>${p.value.toFixed(1)} @ ${p.width}px</title></circle>`)
        .join('');
    $('curve-plot').innerHTML =
        svg.points.length < 2
            ? '<div class="hint">sweep first — a curve needs at least two widths</div>'
            : `<svg viewBox="0 0 ${svg.width} ${svg.height}">
<path d="${svg.path}" fill="none" stroke="#3b82f6" stroke-width="2"/>${dots}
</svg>
<div class="hint">${prop}: ${svg.minValue.toFixed(1)} → ${svg.maxValue.toFixed(1)} over [${svg.points[0].width}, ${svg.points[svg.points.length - 1].width}]px</div>`;
    $('pin').onclick = () => {
        baselines.push({ selector, prop, curve: [...curve.entries()] });
        renderRecorder();
    };
}

// ─── recorder ───────────────────────────────────────────────────────────

function renderRecorder(): void {
    $('pinned').innerHTML = baselines.length === 0 ? '<div class="hint">pin curves from the Curves tab</div>' : '';
    baselines.forEach((b, i) => {
        const row = el('div', 'violation', `${b.selector} · ${b.prop} (${b.curve.length} points) `);
        const del = el('a', '', '✕');
        del.addEventListener('click', () => {
            baselines.splice(i, 1);
            renderRecorder();
        });
        row.append(del);
        $('pinned').append(row);
    });
}

function exportContract(): void {
    const contract = buildRecordedContract({
        name: 'recorded',
        widths: store?.widths ?? [320, 768, 1280],
        touchMin: $<HTMLInputElement>('rec-touch').checked ? Number($<HTMLInputElement>('rec-touch-min').value) || 24 : undefined,
        baselines,
    });
    $('contract-out').textContent = JSON.stringify(contract, null, 2);
    status('contract ready — save it and wire `rjs verify` into CI');
}

// ─── overlay + misc ─────────────────────────────────────────────────────

async function mountOverlay(): Promise<void> {
    const code = await (await fetch(chrome.runtime.getURL('browser-global.js'))).text();
    await evalInPage(`${code};rjs.mountOverlay();'r$ overlay mounted'`);
    status('overlay mounted on the page');
}

function selectors(): string[] {
    const raw = $<HTMLInputElement>('selectors').value.trim();
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : defaultSelectors;
}

function constraints(): { constraints?: { touchTarget?: { min: number } } } {
    const min = Number($<HTMLInputElement>('touch-min').value);
    return Number.isFinite(min) && min > 0 ? { constraints: { touchTarget: { min } } } : {};
}

function status(text: string): void {
    $('status').textContent = text;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

const defaultSelectors = ['main', 'header', 'footer', 'nav', 'section', 'h1', 'h2', 'p', 'a[href]', 'button', 'input', 'img'];

// ─── boot ───────────────────────────────────────────────────────────────

$('quick').addEventListener('click', () => void quickCheck().catch((e) => status(`✗ ${e.message}`)));
$('sweep').addEventListener('click', () => void sweep());
$('overlay').addEventListener('click', () => void mountOverlay().catch((e) => status(`✗ ${e.message}`)));
$('export').addEventListener('click', exportContract);
$('curve-selector').addEventListener('change', drawCurve);
$('curve-prop').addEventListener('change', drawCurve);
renderRecorder();
status('ready — Quick check measures the live viewport; Sweep runs the full oracle');

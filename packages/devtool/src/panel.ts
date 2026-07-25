/// <reference types="chrome" />
/**
 * The r$ panel — the closed loop, visualized.
 *
 * Page report: full-width sweep (CDP emulation through the background's
 * chrome.debugger proxy) or a quick live-viewport check. Element f(width):
 * pick an element ($0 or a selector) and every measurable property is
 * plotted as the MEASURED curve. Contract: pin curves, build the JSON.
 */

import { analyzeStore, buildCollectExpression, fromWire, type UnifiedReport, type ViewportSnapshotWire } from '@responsivejs/design/browser';
import type { SnapshotStore, Violation } from '@responsivejs/core/types';
import { makeCdpClient, curveOf, cdpSweep, iframeSweep, type TabCdp, type MeasureConfig, type ElementInspection } from './engine.js';
import { parsePropList, toTrack } from './props.js';
import { curveToSvg } from './curve-svg.js';
import { buildRecordedContract, type RecordedBaseline } from './recorder.js';
import { SELECTED_ELEMENT_EXPRESSION } from './select-element.js';
import { PICKER_INSTALL_EXPRESSION, PICKER_POLL_EXPRESSION, type PickState } from './picker.js';
import { buildHighlightExpression } from './highlight.js';

const MEASURABLE = ['fontSize', 'width', 'height', 'x', 'y'] as const;

// ─── state ──────────────────────────────────────────────────────────────

let pageStore: SnapshotStore | null = null;
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

function widths(): number[] {
    return ($<HTMLInputElement>('widths').value || '320,768,1280')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
}

function status(text: string): void {
    $('status').textContent = text;
}

/** Turn the debugger's cryptic failures into something actionable. */
function explainCdpError(message: string): string {
    if (message.includes('different extension')) {
        return `${message} — another extension injects frames here; try disabling it on this page`;
    }
    if (message.includes('already attached')) {
        return `${message} — close other debugger sessions (or the yellow bar) and retry`;
    }
    return message;
}

/** attach → work → detach; the debugger bar on the page is expected. */
async function withCdp<T>(work: (client: TabCdp) => Promise<T>): Promise<T> {
    cdp ??= makeCdpClient(messenger, chrome.devtools.inspectedWindow.tabId);
    const pageUrl = await evalInPage<string>('location.href').catch(() => undefined);
    await cdp.attach(pageUrl);
    try {
        return await work(cdp);
    } finally {
        await cdp.detach().catch(() => {});
    }
}

/**
 * Measure through the debugger; when Chrome refuses the attach because a
 * FOREIGN extension has frames in the page (its check covers the whole
 * tab — nothing we can do), fall back to iframe emulation: the page
 * reloaded hidden at every width. Honest caveat: that is a fresh load.
 */
async function measure(cfg: MeasureConfig): Promise<ElementInspection & { mode: 'cdp' | 'iframe' }> {
    try {
        const inspection = await withCdp((client) => cdpSweep(client, cfg));
        return { ...inspection, mode: 'cdp' };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!message.includes('different extension')) throw e;
        status('debugger blocked by another extension — iframe emulation (fresh same-origin load)…');
        const inspection = await iframeSweep(evalInPage, cfg);
        return { ...inspection, mode: 'iframe' };
    }
}

const modeNote = (mode: 'cdp' | 'iframe'): string =>
    mode === 'iframe' ? ' · measured via iframe emulation (fresh load — another extension blocks the debugger here)' : '';

// ─── tabs ───────────────────────────────────────────────────────────────

function showTab(name: string): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) {
        b.classList.toggle('active', b.dataset.tab === name);
    }
    for (const s of document.querySelectorAll('section')) {
        s.classList.toggle('active', s.id === `tab-${name}`);
    }
}

// ─── page report ────────────────────────────────────────────────────────

async function quickCheck(): Promise<void> {
    status('measuring at the live viewport…');
    const wire = await evalInPage<ViewportSnapshotWire>(buildCollectExpression({ selectors: DEFAULT_SELECTORS }));
    const snap = fromWire(wire);
    pageStore = {
        snapshots: new Map([[snap.width, snap]]),
        widths: [snap.width],
        selectors: DEFAULT_SELECTORS,
        ...(snap.manifest ? { manifest: snap.manifest } : {}),
    };
    report = analyzeStore(pageStore);
    renderReport();
    showTab('page');
    status(`live check at ${snap.width}px — Sweep page for every width`);
}

async function sweepPage(): Promise<void> {
    const ws = widths();
    status(`sweeping ${ws.join(', ')}px (the yellow debugger bar is expected)…`);
    try {
        const { store, mode } = await measure({ widths: ws, selectors: DEFAULT_SELECTORS });
        pageStore = store;
        report = analyzeStore(store);
        renderReport();
        showTab('page');
        status(`swept ${ws.length} widths — now pick an element in the Element tab${modeNote(mode)}`);
    } catch (e) {
        status(`✗ ${explainCdpError(e instanceof Error ? e.message : String(e))}`);
    }
}

const SEV: Record<string, string> = { error: '#e5484d', warning: '#d9822b', info: '#3b82f6' };

function renderReport(): void {
    if (!report) return;
    const s = report.summary;
    $('hud').innerHTML = '';
    const badge = el('span', report.pass ? 'pass' : 'fail', report.pass ? 'PASS' : 'FAIL');
    const counts = el('span', 'counts', ` ${s.errors}E · ${s.warnings}W · ${s.info}I · ${report.total} checks @ [${report.widths.join(', ')}]px`);
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
            row.title = 'click: flash the element on the page';
            const dot = el('span', 'dot', '');
            dot.style.background = SEV[v.severity ?? 'error'];
            const target = el('code', '', v.element ?? v.elements?.join(' + ') ?? '?');
            const toElements = el('a', 'jump', '⧉');
            toElements.title = 'open in the Elements panel';
            toElements.addEventListener('click', (e) => {
                e.stopPropagation();
                openInElements(v.element);
            });
            row.append(dot, target, document.createTextNode(` @${v.width}px — ${v.detail} `), toElements);
            if (v.owner) row.append(el('div', 'owner', `↳ ${v.owner.construct}${v.owner.source ? ` at ${v.owner.source}` : ''}`));
            // stay in the panel: scroll the page to the element and flash it
            row.addEventListener('click', () => flashOnPage(v.element, v.rule));
            details.append(row);
        }
        list.append(details);
    }
    if (report.violations.length === 0) list.append(el('div', 'clean', 'No violations.'));
}

function openInElements(element: string | undefined): void {
    if (!element) return;
    const selector = element.replace(/\[\d+\]$/, '');
    const index = Number(/\[(\d+)\]$/.exec(element)?.[1] ?? 0);
    void evalInPage(`inspect(document.querySelectorAll(${JSON.stringify(selector)})[${index}])`).catch(() => {});
}

function flashOnPage(element: string | undefined, rule: string): void {
    if (!element) return;
    const selector = element.replace(/\[\d+\]$/, '');
    const index = Number(/\[(\d+)\]$/.exec(element)?.[1] ?? 0);
    void evalInPage<boolean>(buildHighlightExpression(selector, index, `${rule} · ${element}`))
        .then((found) => {
            if (!found) status(`✗ ${element} not found on the CURRENT page (measured on a previous state?)`);
        })
        .catch(() => {});
}

// ─── element f(width) — the inspector ───────────────────────────────────

/** Mouse picker: highlight-on-hover in the page, click picks, Esc cancels. */
async function pickOnPage(): Promise<void> {
    await evalInPage(PICKER_INSTALL_EXPRESSION);
    status('🖱 click an element ON THE PAGE to measure it (Esc cancels)…');
    const deadline = Date.now() + 60_000;
    for (;;) {
        await new Promise((r) => setTimeout(r, 250));
        const pick = await evalInPage<PickState>(PICKER_POLL_EXPRESSION);
        if (pick.state === 'picked' && pick.selector) {
            $<HTMLInputElement>('el-selector').value = pick.selector;
            await inspectElement(pick.selector);
            return;
        }
        if (pick.state === 'cancelled') {
            status('pick cancelled');
            return;
        }
        if (Date.now() > deadline) {
            status('pick timed out');
            return;
        }
    }
}

async function inspectSelected(): Promise<void> {
    status('reading the selection from the Elements panel…');
    const selector = await evalInPage<string | null>(SELECTED_ELEMENT_EXPRESSION);
    if (!selector) {
        status('✗ nothing selected — click an element in the Elements panel first');
        return;
    }
    $<HTMLInputElement>('el-selector').value = selector;
    await inspectElement(selector);
}

async function inspectElement(selector: string): Promise<void> {
    if (!selector.trim()) {
        status('✗ type a selector or use the Elements selection');
        return;
    }
    const ws = widths();
    const extraProps = parsePropList($<HTMLInputElement>('el-props').value);
    status(`measuring ${selector} at ${ws.join(', ')}px…`);
    try {
        const inspection = await measure({
            widths: ws,
            selectors: [selector],
            extraSelector: selector,
            extraProps,
        });
        renderElementProps(selector, inspection.store, inspection.extra);
        showTab('element');
        status(`${selector} measured at ${ws.length} widths — pin the curves worth keeping${modeNote(inspection.mode)}`);
    } catch (e) {
        status(`✗ ${explainCdpError(e instanceof Error ? e.message : String(e))}`);
    }
}

function renderElementProps(selector: string, store: SnapshotStore, extra: Map<string, Map<number, string>>): void {
    const grid = $('el-cards');
    grid.innerHTML = '';
    let rendered = 0;

    // the default measurable set — pinnable as contract baselines
    for (const prop of MEASURABLE) {
        const curve = curveOf(store, selector, prop);
        if (curve.size === 0) continue;
        rendered++;
        grid.append(curveCard(prop, curve, () => {
            baselines.push({ selector, prop, curve: [...curve.entries()] });
            renderRecorder();
            status(`pinned ${selector} · ${prop} — see the Contract tab`);
        }));
    }

    // user-requested extra properties: numeric → curve; anything else → discrete
    for (const [prop, values] of extra) {
        if (values.size === 0) continue;
        rendered++;
        const track = toTrack(values);
        if (track.kind === 'curve') {
            grid.append(curveCard(prop, track.curve)); // not a baseline prop — no pin
        } else {
            const card = el('div', 'prop-card');
            const h = document.createElement('h3');
            const distinct = new Set(track.values.values()).size;
            h.append(el('span', '', prop), el('span', 'range', distinct === 1 ? 'constant' : `${distinct} distinct values`));
            const list = el('div', 'discrete');
            for (const [w, v] of track.values) {
                const row = el('div', '');
                row.append(el('span', 'w', `${w}px`), document.createTextNode(v || '—'));
                list.append(row);
            }
            card.append(h, list);
            grid.append(card);
        }
    }

    if (rendered === 0) {
        grid.append(el('div', 'hint', `nothing measured for "${selector}" — does it match an element?`));
    }
}

function curveCard(prop: string, curve: Map<number, number>, onPin?: () => void): HTMLElement {
    const svg = curveToSvg(curve, 300, 110);
    const flat = svg.minValue === svg.maxValue;

    const card = el('div', 'prop-card');
    const h = document.createElement('h3');
    h.append(
        el('span', '', prop),
        el('span', 'range', flat ? `${fmt(svg.minValue)} (constant)` : `${fmt(svg.minValue)} → ${fmt(svg.maxValue)}`),
    );
    if (onPin) {
        const pin = document.createElement('button');
        pin.className = 'pin';
        pin.textContent = '📌 pin';
        pin.title = 'Pin this measured curve as a contract baseline';
        pin.addEventListener('click', onPin);
        h.append(pin);
    }

    const dots = svg.points
        .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3"><title>${fmt(p.value)} @ ${p.width}px</title></circle>`)
        .join('');
    const plot = document.createElement('div');
    plot.innerHTML = `<svg viewBox="0 0 ${svg.width} ${svg.height}" class="${flat ? 'flat' : ''}"><path d="${svg.path}"/>${dots}</svg>`;

    const vals = el('div', 'vals');
    for (const [w, v] of curve) vals.append(el('span', '', `${w}px → ${fmt(v)}`));

    card.append(h, plot, vals);
    return card;
}

function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ─── contract recorder ──────────────────────────────────────────────────

function renderRecorder(): void {
    const pinned = $('pinned');
    pinned.innerHTML = baselines.length === 0 ? '<div class="hint">nothing pinned yet — pin curves from the Element tab</div>' : '';
    baselines.forEach((b, i) => {
        const row = el('div', 'violation', `${b.selector} · ${b.prop} (${b.curve.length} points)`);
        const del = el('a', 'del', '✕');
        del.addEventListener('click', () => {
            baselines.splice(i, 1);
            renderRecorder();
        });
        row.append(del);
        pinned.append(row);
    });
}

function exportContract(): void {
    const contract = buildRecordedContract({
        name: 'recorded',
        widths: pageStore?.widths.length ? pageStore.widths : widths(),
        touchMin: $<HTMLInputElement>('rec-touch').checked ? Number($<HTMLInputElement>('rec-touch-min').value) || 24 : undefined,
        baselines,
    });
    $('contract-out').textContent = JSON.stringify(contract, null, 2);
    status('contract ready — save it and wire `rjs verify` into CI');
}

// ─── overlay + helpers ──────────────────────────────────────────────────

async function mountOverlay(): Promise<void> {
    const code = await (await fetch(chrome.runtime.getURL('browser-global.js'))).text();
    await evalInPage(`${code};rjs.mountOverlay();'ok'`);
    status('overlay mounted on the page (bottom-right badge)');
}

function el(tag: string, cls: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

const DEFAULT_SELECTORS = ['main', 'header', 'footer', 'nav', 'section', 'h1', 'h2', 'p', 'a[href]', 'button', 'input', 'img'];

// ─── boot ───────────────────────────────────────────────────────────────

for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) {
    b.addEventListener('click', () => showTab(b.dataset.tab!));
}
$('quick').addEventListener('click', () => void quickCheck().catch((e) => status(`✗ ${e.message}`)));
$('sweep').addEventListener('click', () => void sweepPage());
$('overlay').addEventListener('click', () => void mountOverlay().catch((e) => status(`✗ ${e.message}`)));
$('el-pick').addEventListener('click', () => void pickOnPage().catch((e) => status(`✗ ${e.message}`)));
$('el-use').addEventListener('click', () => void inspectSelected().catch((e) => status(`✗ ${e.message}`)));
$('el-go').addEventListener('click', () => void inspectElement($<HTMLInputElement>('el-selector').value));
$<HTMLInputElement>('el-selector').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void inspectElement($<HTMLInputElement>('el-selector').value);
});
$('export').addEventListener('click', exportContract);
$('copy').addEventListener('click', () => {
    const text = $('contract-out').textContent ?? '';
    if (text) void navigator.clipboard.writeText(text).then(() => status('contract JSON copied'));
});
// A navigation/reload invalidates every measurement: clear the panel so it
// never shows verdicts about a page that no longer exists. Pins survive —
// they are the user's work (and record-worthy across reloads).
chrome.devtools.network.onNavigated.addListener((url) => {
    pageStore = null;
    report = null;
    $('hud').innerHTML = '';
    $('violations').innerHTML = '';
    $('el-cards').innerHTML = '';
    status(`page navigated (${url}) — previous measurements cleared, sweep again`);
});

renderRecorder();
status('ready — Sweep page for the report, or select an element and open the Element tab');

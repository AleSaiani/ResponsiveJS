/// <reference types="chrome" />
/**
 * The r$ panel — the closed loop, visualized.
 *
 * Page report (full-width sweep, diff vs the previous one), Element
 * f(width) (mouse picker / $0 / selector → every property as a measured
 * curve, arbitrary extras included), Contract (pins → JSON). Settings and
 * pins persist in chrome.storage (pins per origin); `live` re-checks the
 * page on DOM mutations. Everything measured via CDP emulation, with
 * automatic iframe-emulation fallback when the debugger is blocked.
 */

import { analyzeStore, buildCollectExpression, fromWire, type UnifiedReport, type ViewportSnapshotWire } from '@responsivejs/design/browser';
import type { SnapshotStore, Violation } from '@responsivejs/core/types';
import { curveOf, type MeasureConfig } from './engine.js';
import { evalInPage, measure, modeNote } from './devtools-io.js';
import { curveCard, discreteCard, el, fmt } from './cards.js';
import { buildRecordedContract, type RecordedBaseline } from './recorder.js';
import { toTrack, parsePropList } from './props.js';
import { SELECTED_ELEMENT_EXPRESSION } from './select-element.js';
import { PICKER_INSTALL_EXPRESSION, PICKER_POLL_EXPRESSION, type PickState } from './picker.js';
import { buildHighlightExpression } from './highlight.js';
import { diffSweeps, type SweepDiff } from './diff.js';
import { WATCH_START_EXPRESSION, WATCH_POLL_EXPRESSION, WATCH_STOP_EXPRESSION } from './watch.js';
import { loadSettings, saveSettings, loadPins, savePins, onPinsChanged } from './settings.js';

const MEASURABLE = ['fontSize', 'width', 'height', 'x', 'y'] as const;
const DEFAULT_SELECTORS = ['main', 'header', 'footer', 'nav', 'section', 'h1', 'h2', 'p', 'a[href]', 'button', 'input', 'img'];

// ─── state ──────────────────────────────────────────────────────────────

let pageStore: SnapshotStore | null = null;
let report: UnifiedReport | null = null;
let previous: { store: SnapshotStore; violations: Violation[] } | null = null;
let baselines: RecordedBaseline[] = [];
let origin = '';
let watchTimer: ReturnType<typeof setInterval> | undefined;
let recheckTimer: ReturnType<typeof setTimeout> | undefined;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

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

async function quickCheck(auto = false): Promise<void> {
    if (!auto) status('measuring at the live viewport…');
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
    if (!auto) {
        showTab('page');
        status(`live check at ${snap.width}px — Sweep page for every width`);
    } else {
        status(`live re-check at ${snap.width}px (${new Date().toLocaleTimeString()}) — the page changed`);
    }
}

async function sweepPage(): Promise<void> {
    const ws = widths();
    status(`sweeping ${ws.join(', ')}px (the yellow debugger bar is expected)…`);
    try {
        const outgoing = pageStore && report && pageStore.widths.length > 1 ? { store: pageStore, violations: report.violations } : null;
        const { store, mode } = await measure(
            { widths: ws, selectors: DEFAULT_SELECTORS },
            () => status('debugger blocked by another extension — iframe emulation (fresh same-origin load)…'),
        );
        previous = outgoing;
        pageStore = store;
        report = analyzeStore(store);
        renderReport();
        renderDiff(previous ? diffSweeps(previous, { store, violations: report.violations }) : null);
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
            row.addEventListener('click', () => flashOnPage(v.element, v.rule));
            details.append(row);
        }
        list.append(details);
    }
    if (report.violations.length === 0) list.append(el('div', 'clean', 'No violations.'));
}

function renderDiff(diff: SweepDiff | null): void {
    const box = $('diff');
    box.innerHTML = '';
    if (!diff) return;
    if (diff.changes.length === 0 && diff.appeared.length === 0 && diff.resolved.length === 0) {
        box.append(el('div', 'hint', 'diff vs previous sweep: nothing changed'));
        return;
    }
    box.append(el('h2', '', 'Changed since the previous sweep'));
    for (const key of diff.resolved) box.append(el('div', 'diff-resolved', `✓ resolved: ${key.replaceAll('|', ' · ')}`));
    for (const key of diff.appeared) box.append(el('div', 'diff-appeared', `✗ appeared: ${key.replaceAll('|', ' · ')}`));
    for (const c of diff.changes.slice(0, 40)) {
        const elName = c.index > 0 ? `${c.selector}[${c.index}]` : c.selector;
        box.append(el('div', 'diff-change', `${elName} · ${c.prop} @${c.width}px: ${fmt(c.before)} → ${fmt(c.after)}`));
    }
    if (diff.changes.length > 40) box.append(el('div', 'hint', `… and ${diff.changes.length - 40} more value changes`));
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
        const cfg: MeasureConfig = { widths: ws, selectors: [selector], extraSelector: selector, extraProps };
        const inspection = await measure(cfg, () =>
            status('debugger blocked by another extension — iframe emulation (fresh same-origin load)…'),
        );
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

    for (const prop of MEASURABLE) {
        const curve = curveOf(store, selector, prop);
        if (curve.size === 0) continue;
        rendered++;
        grid.append(
            curveCard(prop, curve, () => {
                void addPin({ selector, prop, curve: [...curve.entries()] });
                status(`pinned ${selector} · ${prop} — see the Contract tab`);
            }),
        );
    }

    for (const [prop, values] of extra) {
        if (values.size === 0) continue;
        rendered++;
        const track = toTrack(values);
        grid.append(track.kind === 'curve' ? curveCard(prop, track.curve) : discreteCard(prop, track.values));
    }

    if (rendered === 0) {
        grid.append(el('div', 'hint', `nothing measured for "${selector}" — does it match an element?`));
    }
}

// ─── contract recorder (pins persist per origin) ────────────────────────

async function addPin(pin: RecordedBaseline): Promise<void> {
    baselines.push(pin);
    renderRecorder();
    if (origin) await savePins(origin, baselines);
}

function renderRecorder(): void {
    const pinned = $('pinned');
    pinned.innerHTML = baselines.length === 0 ? '<div class="hint">nothing pinned yet — pin curves from the Element tab</div>' : '';
    baselines.forEach((b, i) => {
        const row = el('div', 'violation', `${b.selector} · ${b.prop} (${b.curve.length} points)`);
        const del = el('a', 'del', '✕');
        del.addEventListener('click', () => {
            baselines.splice(i, 1);
            renderRecorder();
            if (origin) void savePins(origin, baselines);
        });
        row.append(del);
        pinned.append(row);
    });
}

function exportContract(): void {
    const contract = buildRecordedContract({
        name: origin ? new URL(origin).hostname : 'recorded',
        widths: pageStore?.widths.length ? pageStore.widths : widths(),
        touchMin: $<HTMLInputElement>('rec-touch').checked ? Number($<HTMLInputElement>('rec-touch-min').value) || 24 : undefined,
        baselines,
    });
    $('contract-out').textContent = JSON.stringify(contract, null, 2);
    status('contract ready — save it and wire `rjs verify` into CI');
}

// ─── live re-check on mutations ─────────────────────────────────────────

async function setLive(on: boolean): Promise<void> {
    clearInterval(watchTimer);
    clearTimeout(recheckTimer);
    if (!on) {
        await evalInPage(WATCH_STOP_EXPRESSION).catch(() => {});
        status('live re-check off');
        return;
    }
    await evalInPage(WATCH_START_EXPRESSION);
    watchTimer = setInterval(() => {
        void evalInPage<boolean>(WATCH_POLL_EXPRESSION)
            .then((dirty) => {
                if (!dirty) return;
                clearTimeout(recheckTimer);
                recheckTimer = setTimeout(() => void quickCheck(true).catch(() => {}), 400);
            })
            .catch(() => {});
    }, 1000);
    status('live — the page re-checks itself on every DOM change (quick check, live viewport)');
}

// ─── overlay ────────────────────────────────────────────────────────────

async function mountOverlay(): Promise<void> {
    const code = await (await fetch(chrome.runtime.getURL('browser-global.js'))).text();
    await evalInPage(`${code};rjs.mountOverlay();'ok'`);
    status('overlay mounted on the page (bottom-right badge)');
}

// ─── boot ───────────────────────────────────────────────────────────────

async function refreshOrigin(): Promise<void> {
    origin = await evalInPage<string>('location.origin').catch(() => '');
    baselines = origin ? await loadPins(origin) : [];
    renderRecorder();
    if (origin) onPinsChanged(origin, (pins) => {
        baselines = pins;
        renderRecorder();
    });
}

async function init(): Promise<void> {
    const settings = await loadSettings();
    $<HTMLInputElement>('widths').value = settings.widths;
    $<HTMLInputElement>('el-props').value = settings.extraProps;
    $<HTMLInputElement>('rec-touch-min').value = settings.touchMin;
    $<HTMLInputElement>('live').checked = settings.live;
    await refreshOrigin();
    if (settings.live) void setLive(true);

    $<HTMLInputElement>('widths').addEventListener('change', (e) => void saveSettings({ widths: (e.target as HTMLInputElement).value }));
    $<HTMLInputElement>('el-props').addEventListener('change', (e) => void saveSettings({ extraProps: (e.target as HTMLInputElement).value }));
    $<HTMLInputElement>('rec-touch-min').addEventListener('change', (e) => void saveSettings({ touchMin: (e.target as HTMLInputElement).value }));
    $<HTMLInputElement>('live').addEventListener('change', (e) => {
        const on = (e.target as HTMLInputElement).checked;
        void saveSettings({ live: on });
        void setLive(on);
    });

    status('ready — Sweep page for the report, or pick an element in the Element tab');
}

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
// never shows verdicts about a page that no longer exists. Pins reload for
// the (possibly new) origin; the mutation watcher re-installs if live.
chrome.devtools.network.onNavigated.addListener((url) => {
    pageStore = null;
    report = null;
    previous = null;
    $('hud').innerHTML = '';
    $('violations').innerHTML = '';
    $('diff').innerHTML = '';
    $('el-cards').innerHTML = '';
    void refreshOrigin();
    if ($<HTMLInputElement>('live').checked) void setLive(true);
    status(`page navigated (${url}) — previous measurements cleared, sweep again`);
});

void init();

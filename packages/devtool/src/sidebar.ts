/// <reference types="chrome" />
/**
 * The Elements sidebar — f(width) next to Styles. Follows the Elements
 * panel selection: shows the unique selector, and on Measure (or
 * automatically, when auto is on) plots every measurable property of the
 * SELECTED element across the configured widths. Pins land in the same
 * per-origin store the panel reads.
 */

import { curveOf } from './engine.js';
import { evalInPage, measure, modeNote } from './devtools-io.js';
import { curveCard, discreteCard, el } from './cards.js';
import { toTrack, parsePropList } from './props.js';
import { SELECTED_ELEMENT_EXPRESSION } from './select-element.js';
import { loadSettings, saveSettings, loadPins, savePins } from './settings.js';

const MEASURABLE = ['fontSize', 'width', 'height', 'x', 'y'] as const;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

let currentSelector: string | null = null;
let measuring = false;

function status(text: string): void {
    $('status').textContent = text;
}

async function refreshSelection(): Promise<void> {
    currentSelector = await evalInPage<string | null>(SELECTED_ELEMENT_EXPRESSION).catch(() => null);
    $('selector').textContent = currentSelector ?? '(nothing selected)';
    if (currentSelector && $<HTMLInputElement>('auto').checked) {
        void measureSelected();
    } else if (currentSelector) {
        status('press Measure to plot f(width)');
    }
}

async function measureSelected(): Promise<void> {
    if (!currentSelector || measuring) return;
    measuring = true;
    const selector = currentSelector;
    try {
        const settings = await loadSettings();
        const widths = settings.widths
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        status(`measuring at ${widths.join(', ')}px…`);
        const inspection = await measure(
            {
                widths,
                selectors: [selector],
                extraSelector: selector,
                extraProps: parsePropList(settings.extraProps),
            },
            () => status('debugger blocked — iframe emulation…'),
        );

        const grid = $('cards');
        grid.innerHTML = '';
        for (const prop of MEASURABLE) {
            const curve = curveOf(inspection.store, selector, prop);
            if (curve.size === 0) continue;
            grid.append(
                curveCard(prop, curve, () => {
                    void (async () => {
                        const origin = await evalInPage<string>('location.origin').catch(() => '');
                        if (!origin) return;
                        const pins = await loadPins(origin);
                        pins.push({ selector, prop, curve: [...curve.entries()] });
                        await savePins(origin, pins);
                        status(`pinned ${selector} · ${prop} — see the r$ panel's Contract tab`);
                    })();
                }),
            );
        }
        for (const [prop, values] of inspection.extra) {
            if (values.size === 0) continue;
            const track = toTrack(values);
            grid.append(track.kind === 'curve' ? curveCard(prop, track.curve) : discreteCard(prop, track.values));
        }
        if (grid.children.length === 0) grid.append(el('div', 'hint', 'nothing measurable for this element'));
        status(`${selector}${modeNote(inspection.mode)}`);
    } catch (e) {
        status(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        measuring = false;
    }
}

async function init(): Promise<void> {
    const settings = await loadSettings();
    $<HTMLInputElement>('auto').checked = settings.autoMeasure;
    $<HTMLInputElement>('auto').addEventListener('change', (e) => {
        void saveSettings({ autoMeasure: (e.target as HTMLInputElement).checked });
    });
    $('go').addEventListener('click', () => void measureSelected());
    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => void refreshSelection());
    await refreshSelection();
}

void init();

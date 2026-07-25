/**
 * Property cards, shared by the panel's Element tab and the Elements
 * sidebar: a measured curve as SVG, or a discrete per-width value list.
 */

import { curveToSvg } from './curve-svg.js';

export function el(tag: string, cls: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

export function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function curveCard(prop: string, curve: Map<number, number>, onPin?: () => void): HTMLElement {
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

export function discreteCard(prop: string, values: Map<number, string>): HTMLElement {
    const card = el('div', 'prop-card');
    const h = document.createElement('h3');
    const distinct = new Set(values.values()).size;
    h.append(el('span', '', prop), el('span', 'range', distinct === 1 ? 'constant' : `${distinct} distinct values`));
    const list = el('div', 'discrete');
    for (const [w, v] of values) {
        const row = el('div', '');
        row.append(el('span', 'w', `${w}px`), document.createTextNode(v || '—'));
        list.append(row);
    }
    card.append(h, list);
    return card;
}

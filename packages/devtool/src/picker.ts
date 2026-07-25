/**
 * In-page element picker — the DevTools inspect cursor, r$ flavored.
 * Installed via inspectedWindow.eval; the page cannot push events back to
 * the panel, so the handshake is a tiny state machine on window.__rjs_pick
 * that the panel polls: picking → picked(selector) | cancelled.
 */

import { SELECTOR_FN } from './select-element.js';

/** Install the picker: hover highlight, click picks, Esc cancels. Idempotent. */
export const PICKER_INSTALL_EXPRESSION = `(() => {
    if (window.__rjs_pick && window.__rjs_pick.state === 'picking') return 'picking';
    const buildSelector = ${SELECTOR_FN};
    window.__rjs_pick = { state: 'picking' };

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;display:none;' +
        'border:2px solid #3b82f6;background:rgba(59,130,246,.12);border-radius:2px;';
    document.documentElement.appendChild(box);

    const cleanup = () => {
        removeEventListener('mousemove', onMove, true);
        removeEventListener('click', onClick, true);
        removeEventListener('keydown', onKey, true);
        box.remove();
    };
    const onMove = (e) => {
        const el = e.target;
        if (!(el instanceof Element)) return;
        const r = el.getBoundingClientRect();
        box.style.display = 'block';
        box.style.left = r.x + 'px';
        box.style.top = r.y + 'px';
        box.style.width = r.width + 'px';
        box.style.height = r.height + 'px';
    };
    const onClick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.__rjs_pick = { state: 'picked', selector: buildSelector(e.target) };
        cleanup();
    };
    const onKey = (e) => {
        if (e.key !== 'Escape') return;
        window.__rjs_pick = { state: 'cancelled' };
        cleanup();
    };
    addEventListener('mousemove', onMove, true);
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey, true);
    return 'picking';
})()`;

/** Poll the handshake; consume (delete) it once it left 'picking'. */
export const PICKER_POLL_EXPRESSION = `(() => {
    const p = window.__rjs_pick;
    if (!p) return { state: 'cancelled' };
    if (p.state !== 'picking') delete window.__rjs_pick;
    return p;
})()`;

export interface PickState {
    state: 'picking' | 'picked' | 'cancelled';
    selector?: string | null;
}

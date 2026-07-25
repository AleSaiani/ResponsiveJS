// @vitest-environment happy-dom
/** The flash highlight runs IN THE PAGE — eval it like the page will. */
import { describe, it, expect } from 'vitest';
import { buildHighlightExpression } from '../src/highlight.js';

const run = <T>(expr: string): T => (0, eval)(expr) as T;

describe('buildHighlightExpression', () => {
    it('draws a labeled box over the element and reports success', () => {
        document.body.innerHTML = '<div class="card">a</div><div class="card">b</div>';
        expect(run<boolean>(buildHighlightExpression('.card', 1, 'noOverflow · .card[1]'))).toBe(true);
        const box = document.getElementById('__rjs_hl')!;
        expect(box).not.toBeNull();
        expect(box.textContent).toBe('noOverflow · .card[1]');
    });

    it('replaces a previous highlight instead of stacking', () => {
        document.body.innerHTML = '<p id="a">x</p>';
        run(buildHighlightExpression('#a', 0, 'first'));
        run(buildHighlightExpression('#a', 0, 'second'));
        expect(document.querySelectorAll('#__rjs_hl')).toHaveLength(1);
        expect(document.getElementById('__rjs_hl')!.textContent).toBe('second');
    });

    it('missing element → false, no box', () => {
        document.body.innerHTML = '';
        document.getElementById('__rjs_hl')?.remove(); // leftover from previous flashes
        expect(run<boolean>(buildHighlightExpression('.nope', 0, 'x'))).toBe(false);
        expect(document.getElementById('__rjs_hl')).toBeNull();
    });
});

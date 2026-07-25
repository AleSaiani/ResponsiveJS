// @vitest-environment happy-dom
/** The picker runs IN THE PAGE — test it the same way: eval the expressions. */
import { describe, it, expect, beforeEach } from 'vitest';
import { PICKER_INSTALL_EXPRESSION, PICKER_POLL_EXPRESSION, type PickState } from '../src/picker.js';

declare global {
    interface Window {
        __rjs_pick?: PickState;
    }
}

const run = <T>(expr: string): T => (0, eval)(expr) as T;

beforeEach(() => {
    document.body.innerHTML = '<main><p id="target">pick me</p></main>';
    delete window.__rjs_pick;
});

describe('the in-page picker', () => {
    it('click picks the element and resolves its unique selector', () => {
        expect(run(PICKER_INSTALL_EXPRESSION)).toBe('picking');
        expect(run<PickState>(PICKER_POLL_EXPRESSION).state).toBe('picking');

        document.getElementById('target')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const pick = run<PickState>(PICKER_POLL_EXPRESSION);
        expect(pick.state).toBe('picked');
        expect(pick.selector).toBe('#target');
        // consumed: a later poll no longer reports the old pick
        expect(run<PickState>(PICKER_POLL_EXPRESSION).state).toBe('cancelled');
    });

    it('Escape cancels and cleans up', () => {
        run(PICKER_INSTALL_EXPRESSION);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(run<PickState>(PICKER_POLL_EXPRESSION).state).toBe('cancelled');
        // the highlight box is gone
        expect(document.querySelector('div[style*="2147483647"]')).toBeNull();
    });

    it('install is idempotent while picking', () => {
        run(PICKER_INSTALL_EXPRESSION);
        expect(run(PICKER_INSTALL_EXPRESSION)).toBe('picking');
    });
});

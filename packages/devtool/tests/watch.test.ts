// @vitest-environment happy-dom
/** The mutation watcher runs IN THE PAGE — eval it like the page will. */
import { describe, it, expect, beforeEach } from 'vitest';
import { WATCH_START_EXPRESSION, WATCH_POLL_EXPRESSION, WATCH_STOP_EXPRESSION } from '../src/watch.js';

const run = <T>(expr: string): T => (0, eval)(expr) as T;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    run(WATCH_STOP_EXPRESSION);
    document.body.innerHTML = '<main><p id="t">x</p></main>';
    run(WATCH_POLL_EXPRESSION); // clear the flag raised by the innerHTML write
});

describe('the mutation watcher', () => {
    it('raises the dirty flag on DOM changes and poll consumes it', async () => {
        expect(run(WATCH_START_EXPRESSION)).toBe('on');
        run(WATCH_POLL_EXPRESSION); // drain anything pending
        document.getElementById('t')!.setAttribute('class', 'changed');
        await tick(); // MutationObserver delivers async
        expect(run<boolean>(WATCH_POLL_EXPRESSION)).toBe(true);
        expect(run<boolean>(WATCH_POLL_EXPRESSION)).toBe(false); // consumed
    });

    it('our own artifacts do not trigger it (no feedback loop)', async () => {
        run(WATCH_START_EXPRESSION);
        await tick();
        run(WATCH_POLL_EXPRESSION);
        const hl = document.createElement('div');
        hl.id = '__rjs_hl';
        document.documentElement.appendChild(hl);
        await tick();
        // the highlight insertion mutates documentElement — target is filtered
        expect(run<boolean>(WATCH_POLL_EXPRESSION)).toBe(false);
        hl.remove();
    });

    it('stop disconnects and clears', async () => {
        run(WATCH_START_EXPRESSION);
        expect(run(WATCH_STOP_EXPRESSION)).toBe('off');
        document.getElementById('t')!.textContent = 'y';
        await tick();
        expect(run<boolean>(WATCH_POLL_EXPRESSION)).toBe(false);
    });
});

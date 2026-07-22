// L-94 regression: LiveValidator.scoreAt() recursed unconditionally when no snapshot
// existed for the width. Since clear() never produces a fresh measurement, the recursion
// never terminated (infinite loop). scoreAt must now be bounded and return a score.

import { describe, it, expect } from 'vitest';
import { LiveValidator } from '../src/realtime/live.js';

describe('LiveValidator.scoreAt — bounded when no snapshot exists (L-94)', () => {
    it('terminates and returns a score instead of recursing forever', async () => {
        let storeGetCalls = 0;

        // Minimal Page stub: store.get always returns null (no snapshot), so the OLD code
        // would loop forever. Functions are inspected by source (they reference `window`,
        // which does not exist in Node), never executed.
        const mockPage = {
            evaluate: async (fn: unknown, _arg?: unknown) => {
                const src = typeof fn === 'function' ? fn.toString() : String(fn);
                if (src.includes('innerHeight')) return 800;
                if (src.includes('innerWidth')) return 1280;
                if (src.includes('.get(')) { storeGetCalls++; return null; } // never a snapshot
                return undefined; // observer script, clear()
            },
            waitForTimeout: async () => { /* no-op */ },
            setViewportSize: async () => { /* no-op */ },
        };

        const v = new LiveValidator();
        await v.attach(mockPage as never, ['.t']);

        const score = await v.scoreAt(1280);

        // Returns a real AestheticScore (empty layout) rather than hanging.
        expect(score).toBeTruthy();
        expect(typeof score.overall).toBe('number');
        // Bounded: it probed the store at most a couple of times, not unbounded.
        expect(storeGetCalls).toBeLessThanOrEqual(2);
    });
});

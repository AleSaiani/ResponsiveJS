/** renderAuditHTML — self-contained report, overlays from measured rects. */
import { describe, it, expect } from 'vitest';
import { renderAuditHTML } from '../src/report/html.js';
import { analyzeStore } from '../src/analyze/core.js';
import { makeStore, makeEl, makeRect } from './f3-fixtures.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function overflowingStore() {
    const store = makeStore([320], ['.wide'], () => [makeEl('.wide', { rect: makeRect(0, 100, 480, 120) })]);
    store.screenshots = new Map([[320, PNG]]);
    return store;
}

describe('renderAuditHTML', () => {
    it('one page: summary, grouped violations, embedded screenshot, overlay box', () => {
        const store = overflowingStore();
        const report = analyzeStore(store, { score: false, constraints: { contrast: false, touchTarget: false } });
        const html = renderAuditHTML([{ url: 'http://x.test/', report, store }]);

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('FAIL');
        expect(html).toContain('noOverflow');
        expect(html).toContain('data:image/png;base64,iVBORw=='); // the 4 PNG magic bytes
        // overlay: x=0, y=100/900, width=480/320 → 150%, height=120/900
        expect(html).toContain('left:0.00%');
        expect(html).toContain('top:11.11%');
        expect(html).toContain('width:150.00%');
        expect(html).not.toContain('Side by side'); // single page: no comparison
    });

    it('two pages lead with the comparison table', () => {
        const store = overflowingStore();
        const report = analyzeStore(store, { score: false, constraints: { contrast: false, touchTarget: false } });
        const html = renderAuditHTML([
            { url: 'http://a.test/', report, store },
            { url: 'http://b.test/', report, store },
        ]);
        expect(html).toContain('Side by side');
        expect(html).toContain('http://a.test/');
        expect(html).toContain('http://b.test/');
    });

    it('escapes untrusted text (urls, details, selectors)', () => {
        const store = makeStore([320], ['.x'], () => [makeEl('.x')]);
        const report = analyzeStore(store, { score: false, constraints: { contrast: false, touchTarget: false } });
        report.violations.push({
            rule: 'custom',
            element: '<img onerror=alert(1)>',
            width: 320,
            detail: '<script>bad()</script>',
            severity: 'error',
        });
        const html = renderAuditHTML([{ url: 'http://x.test/?q=<svg>', report, store }]);
        expect(html).not.toContain('<script>bad()');
        expect(html).not.toContain('<img onerror');
        expect(html).toContain('&lt;script&gt;');
    });
});

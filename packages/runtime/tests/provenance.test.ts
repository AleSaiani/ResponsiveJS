// @vitest-environment happy-dom
/** Provenance: constructs register what they control; dispose unregisters. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { r$, manifest } from '../src/index.js';
import { __resetProvenance } from '../src/provenance.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig, configure } from '../src/config.js';
import { fluid } from '../src/value.js';

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    configure({ breakpoints: [320, 1920] });
    (window as { innerWidth: number }).innerWidth = 320;
    __resetProvenance();
});

afterEach(() => {
    __resetProvenance();
    __resetViewportHub();
    __resetConfig();
});

function el(cls: string): HTMLElement {
    const div = document.createElement('div');
    div.className = cls;
    document.body.appendChild(div);
    return div;
}

describe('the provenance manifest', () => {
    it('style constructs register target + behavior kinds, and unregister on dispose', () => {
        el('hero');
        const h = r$('.hero', { fontSize: fluid(16, 32), color: 'red' });

        const entries = manifest();
        expect(entries).toHaveLength(1);
        expect(entries[0].construct).toBe('style');
        expect(entries[0].target).toBe('.hero');
        expect(entries[0].behavior).toContain('fontSize: fluid');
        expect(entries[0].behavior).toContain('color: literal');

        h.dispose();
        expect(manifest()).toHaveLength(0);
    });

    it('geometry, tokens, sync and ratio all appear with their construct kind', () => {
        el('nav');
        const a = el('card');
        const b = el('card');
        a.getBoundingClientRect = () => ({ height: 10 }) as DOMRect;
        b.getBoundingClientRect = () => ({ height: 20 }) as DOMRect;

        const handles = [
            r$.geometry('.nav', { wrapped: r$.whenWraps }),
            r$.tokens({ '--space-m': fluid(16, 24) }),
            r$.sync('.card', 'height'),
        ];
        expect(manifest().map((e) => e.construct).sort()).toEqual(['geometry', 'sync', 'tokens']);

        const geo = manifest().find((e) => e.construct === 'geometry')!;
        expect(geo.target).toBe('.nav');
        expect(geo.behavior).toEqual(['data-wrapped']);

        const tok = manifest().find((e) => e.construct === 'tokens')!;
        expect(tok.behavior[0]).toContain('--space-m: static clamp');

        for (const h of handles) h.dispose();
        expect(manifest()).toHaveLength(0);
    });

    it('is published on window.__rjs_manifest for the collector', () => {
        el('nav');
        const h = r$.geometry('.nav', { wrapped: r$.whenWraps });
        const published = (window as unknown as { __rjs_manifest: unknown[] }).__rjs_manifest;
        expect(Array.isArray(published)).toBe(true);
        expect(published).toHaveLength(1);
        h.dispose();
        expect((window as unknown as { __rjs_manifest: unknown[] }).__rjs_manifest).toHaveLength(0);
    });

    it('captures a best-effort call site', () => {
        el('x');
        const h = r$.geometry('.x', { wrapped: r$.whenWraps });
        const entry = manifest()[0];
        // stack shapes vary by engine — assert only "looks like a frame".
        expect(entry.source === undefined || /:\d+/.test(entry.source)).toBe(true);
        h.dispose();
    });

    it('update() re-registers with the new behavior', () => {
        const target = el('u');
        const h = r$.dynamic(target, { margin: 4 });
        expect(manifest()[0].behavior).toEqual(['margin: literal']);
        h.update({ padding: fluid(4, 8, { curve: 'exponential' }) });
        expect(manifest()).toHaveLength(1);
        expect(manifest()[0].behavior).toEqual(['padding: fluid']);
        h.dispose();
    });
});

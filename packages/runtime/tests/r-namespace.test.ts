// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import {
    r$,
    responsive,
    fluid,
    geometry,
    flush,
    staticCSS,
    lazy,
    memo,
    debug,
    batchWrites,
    applyUtilities,
} from '../src/index.js';
import { __resetViewportHub } from '../src/viewport.js';
import { __resetConfig } from '../src/config.js';

afterEach(() => {
    __resetViewportHub();
    __resetConfig();
});

describe('the r$ namespace', () => {
    it('is callable (apply) and carries the whole surface', () => {
        const surface = [
            'fluid', 'custom', 'combine', 'when', 'whenInRange',
            'geometry', 'whenWraps', 'whenOverflows', 'whenTruncated', 'whenStuck', 'linesOf', 'whenCollides',
            'fromElement', 'sync', 'ratio',
            'configure', 'config', 'breakpoints', 'static', 'dynamic', 'tokens', 'observe', 'scope',
            'lazy', 'batch', 'memo', 'debug', 'flush', 'apply',
            // the namespace is a SUPERSET of the authoring surface — no member
            // should be reachable only through a named import
            'scale', 'rotate', 'translate', 'translateX', 'translateY', 'skew',
            'linear', 'exponential', 'logarithmic', 'easeIn', 'easeOut', 'easeInOut', 'cubic',
            'viewportWidth', 'containerWidth', 'elementSize', 'mediaQuery', 'breakpointSignal',
            'scrollTick', 'releaseViewportHub', 'renderStatic',
        ] as const;
        for (const name of surface) {
            expect(typeof r$[name], name).toBe('function');
        }
        expect(typeof r$.breakpoint.below).toBe('function'); // breakpoint is a sub-namespace
        expect(typeof r$).toBe('function'); // callable
    });

    it('r$ members ARE the named exports (one implementation)', () => {
        expect(r$.fluid).toBe(fluid);
        expect(r$.geometry).toBe(geometry);
        expect(responsive).toBe(r$); // the historical alias
    });

    it('EVERY namespace member has an importable name — the README promise', () => {
        // These seven had no named export at all: the tree-shaking claim was false.
        expect(r$.flush).toBe(flush);
        expect(r$.static).toBe(staticCSS);
        expect(r$.lazy).toBe(lazy);
        expect(r$.memo).toBe(memo);
        expect(r$.debug).toBe(debug);
        expect(r$.batch).toBe(batchWrites); // renamed: ./signals has its own `batch`
        expect(r$.apply).toBe(applyUtilities);
    });

    it('works end to end through the namespace alone', () => {
        (window as { innerWidth: number }).innerWidth = 320;
        const el = document.createElement('div');
        document.body.appendChild(el);

        const bp = r$.breakpoints({ mobile: 320, desktop: 1280 } as const);
        const handle = r$.dynamic(el, { fontSize: r$.fluid(16, 32), color: bp.below('desktop', 'red', 'blue') });
        r$.flush();
        expect(el.style.getPropertyValue('font-size')).toBe('16px');
        expect(el.style.getPropertyValue('color')).toBe('red');
        handle.dispose();
    });
});

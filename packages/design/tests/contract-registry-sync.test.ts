// The anti-drift keystone: the contract registry and the Asserter surface
// must describe the same set of constraints, forever.

import { describe, it, expect } from 'vitest';
import { CONSTRAINT_REGISTRY, CONSTRAINT_NAMES } from '@responsivejs/contract';
import { Asserter } from '../src/constraints/index.js';
import { compileRule } from '../src/contract/dispatch.js';
import { makeStore } from './f3-fixtures.js';

const NON_CONSTRAINT_METHODS = new Set(['constructor', 'report', 'reset']);

function asserterMethods(): string[] {
    return Object.getOwnPropertyNames(Asserter.prototype).filter(
        (name) => !NON_CONSTRAINT_METHODS.has(name) && typeof (Asserter.prototype as unknown as Record<string, unknown>)[name] === 'function',
    );
}

describe('registry ↔ Asserter sync', () => {
    it('every registry constraint is a real Asserter method', () => {
        const methods = new Set(asserterMethods());
        for (const name of CONSTRAINT_NAMES) {
            expect(methods.has(name), `registry entry '${name}' has no Asserter method`).toBe(true);
        }
    });

    it('every public Asserter method is in the registry', () => {
        for (const method of asserterMethods()) {
            expect(
                CONSTRAINT_NAMES.includes(method as (typeof CONSTRAINT_NAMES)[number]),
                `Asserter.${method} is missing from the contract registry`,
            ).toBe(true);
        }
    });

    it('argOrder never exceeds the method arity contract', () => {
        for (const name of CONSTRAINT_NAMES) {
            const method = (Asserter.prototype as unknown as Record<string, { length: number }>)[name];
            const spec = CONSTRAINT_REGISTRY[name];
            // method.length counts params before the first default — must not
            // exceed argOrder (extra registry args map to optional params).
            expect(method.length, `${name}: required params exceed registry argOrder`).toBeLessThanOrEqual(
                spec.argOrder.length,
            );
        }
    });

    it('dispatch smoke: every registry entry executes against a store', () => {
        const store = makeStore([320, 1280], ['.a', '.b']);
        const sampleArgs: Record<string, Record<string, unknown>> = {
            contains: { parent: '.a', child: '.b' },
            sameHeight: { a: '.a', b: '.b' },
            sameLine: { a: '.a', b: '.b' },
            minSize: { selector: '.a', min: { height: 10 } },
            gapUniform: { selector: '.a' },
            monotonic: { selector: '.a', prop: 'width' },
            continuous: { selector: '.a', prop: 'width', maxJump: 100 },
            proportion: { a: '.a', b: '.b', bounds: { min: 0.1, max: 10 } },
            childrenContained: { selector: '.a' },
            childrenEqualWidth: { selector: '.a' },
            noZeroHeight: { selector: '.a' },
            touchTarget: { selector: '.a' },
            textReadable: { selector: '.a' },
            contrastRatio: { selector: '.a' },
            borderRadiusValid: { selector: '.a' },
            zStackOrder: { selectors: ['.a', '.b'] },
            typographyScale: { selector: '.a' },
            spacingTokens: { selector: '.a', tokens: [4, 8, 16] },
            aspectRatio: { selector: '.a', ratio: 2 },
            focusVisible: { selector: '.a' },
            noHiddenOverflow: { selector: '.a' },
            alignedToGrid: { selector: '.a', gridSize: 8 },
            breakpointSafe: { breakpoints: [768] },
            interactiveSpacing: { selector: '.a' },
            visible: { selector: '.a' },
            hidden: { selector: '.b' },
        };

        for (const name of CONSTRAINT_NAMES) {
            const asserter = new Asserter(store);
            expect(
                () => compileRule(asserter, { assert: name, args: sampleArgs[name] }),
                `dispatch of '${name}' threw`,
            ).not.toThrow();
        }
    });
});

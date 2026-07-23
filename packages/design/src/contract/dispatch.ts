/**
 * Rule → Asserter dispatch: the registry's argOrder maps named args onto the
 * method's positional parameters. The registry↔Asserter sync test guarantees
 * every registry name is a real method.
 */

import { CONSTRAINT_REGISTRY, type ConstraintName } from '@responsivejs/contract';
import type { ContractRule } from '@responsivejs/contract';
import type { Asserter } from '../constraints/index.js';

export function compileRule(asserter: Asserter, rule: ContractRule): void {
    const spec = CONSTRAINT_REGISTRY[rule.assert as ConstraintName];
    if (!spec) throw new Error(`r$: unknown constraint '${rule.assert}' (loader should have caught this)`);

    const args = rule.args ?? {};
    const positional = spec.argOrder.map((name) => args[name]);
    // Trim trailing undefined so method defaults apply.
    while (positional.length > 0 && positional[positional.length - 1] === undefined) positional.pop();

    const method = (asserter as unknown as Record<string, (...a: unknown[]) => unknown>)[rule.assert];
    method.apply(asserter, positional);
}

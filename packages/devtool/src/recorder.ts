/**
 * Contract recorder — what you inspected becomes a reviewable, executable
 * spec. Pure: state in, loader-valid DesignContract out.
 */

import type { DesignContract, ContractRule, BaselineSpec } from '@responsivejs/contract';

export interface RecordedBaseline {
    selector: string;
    prop: BaselineSpec['prop'];
    curve: [width: number, value: number][];
}

export interface RecorderState {
    name?: string;
    widths: number[];
    /** noOverflow global rule (default true). */
    noOverflow?: boolean;
    /** Touch-target rules on the interactive set; undefined = none. */
    touchMin?: number;
    /** Extra touchTarget selectors (default: the interactive landmark set). */
    touchSelectors?: string[];
    baselines: RecordedBaseline[];
}

const INTERACTIVE = ['button', 'a[href]', 'input', 'select'];

/** Devtool state → contract JSON, ready for `rjs verify` in CI. */
export function buildRecordedContract(state: RecorderState): DesignContract {
    const rules: ContractRule[] = [];
    if (state.noOverflow !== false) {
        rules.push({ assert: 'noOverflow', args: {}, description: 'nothing bleeds out of the viewport (recorded in devtool)' });
    }
    if (state.touchMin !== undefined) {
        for (const selector of state.touchSelectors ?? INTERACTIVE) {
            rules.push({
                assert: 'touchTarget',
                args: { selector, min: state.touchMin },
                description: `touch targets ≥ ${state.touchMin}px (recorded in devtool)`,
            });
        }
    }

    return {
        ...(state.name ? { name: state.name } : {}),
        version: 1,
        viewport: { widths: [...state.widths].sort((a, b) => a - b) },
        rules,
        ...(state.baselines.length > 0
            ? {
                  baselines: state.baselines.map((b) => ({
                      selector: b.selector,
                      prop: b.prop,
                      curve: [...b.curve].sort((x, y) => x[0] - y[0]),
                  })),
              }
            : {}),
    };
}

/**
 * contractFromManifest — the free regression net: turn the provenance
 * manifest (what the runtime DECLARES it does) into a design contract
 * (rules the oracle can VERIFY it keeps doing).
 *
 * fluid(min→max) on a measurable prop  → monotonic + continuous + baseline
 * ratio(a, b, {min, max})              → proportion
 * breakpoints config                   → viewport widths
 * Everything not yet expressible is reported in `skipped` — never dropped
 * silently.
 */

import type { ProvenanceEntry } from '@responsivejs/core/types';
import type { DesignContract } from '@responsivejs/contract';

/** Props both the fluid runtime and the measuring oracle understand. */
const MEASURABLE_PROPS = new Set(['fontSize', 'width', 'height']);

const DEFAULT_WIDTHS = [320, 768, 1280];

export interface InitResult {
    contract: DesignContract;
    /** Constructs/props that could not become rules — the honest coverage report. */
    skipped: string[];
}

/** Element-bound constructs describe targets like '3 element(s)' — not selectors. */
function isSelectorTarget(target: string): boolean {
    return target !== 'element' && !/\d+ element\(s\)/.test(target);
}

export function contractFromManifest(manifest: ProvenanceEntry[], opts: { name?: string } = {}): InitResult {
    const skipped: string[] = [];
    const rules: NonNullable<DesignContract['rules']> = [];
    const baselines: NonNullable<DesignContract['baselines']> = [];

    const at = (e: ProvenanceEntry): string => (e.source ? ` at ${e.source}` : '');

    // viewport: the page's own declared breakpoints, when it has them
    const bp = manifest.find((e) => e.construct === 'breakpoints' && e.config);
    let widths = bp
        ? [...new Set(Object.values(bp.config as Record<string, number>))].filter((w) => Number.isFinite(w)).sort((a, b) => a - b)
        : DEFAULT_WIDTHS;
    if (widths.length < 2) {
        skipped.push('breakpoints: fewer than 2 configured widths — using the default sweep');
        widths = DEFAULT_WIDTHS;
    }

    rules.push({ assert: 'noOverflow', args: {}, description: 'nothing bleeds out of the viewport (generated default)' });

    for (const e of manifest) {
        if (e.construct === 'breakpoints') continue;

        if (!isSelectorTarget(e.target)) {
            skipped.push(`${e.construct} on ${e.target}: element-bound target has no selector — skipped`);
            continue;
        }

        if (e.construct === 'style' && e.config) {
            for (const [prop, meta] of Object.entries(e.config)) {
                const m = meta as Record<string, unknown> | undefined;
                if (m?.value !== 'fluid') {
                    // literals are static CSS — nothing responsive to pin
                    if (m?.value && m.value !== 'literal') {
                        skipped.push(`style ${e.target} ${prop}: '${String(m.value)}' declaration — not yet expressible as a rule`);
                    }
                    continue;
                }
                if (typeof m.min !== 'number' || typeof m.max !== 'number') {
                    skipped.push(`style ${e.target} ${prop}: non-numeric fluid — not yet expressible as a rule`);
                    continue;
                }
                if (typeof m.follows === 'string' || m.container === true) {
                    skipped.push(`style ${e.target} ${prop}: element/container-driven fluid — width rules would not apply`);
                    continue;
                }
                if (!MEASURABLE_PROPS.has(prop)) {
                    skipped.push(`style ${e.target} ${prop}: fluid, but only fontSize/width/height are measurable today`);
                    continue;
                }
                const p = prop as 'fontSize' | 'width' | 'height';
                const min = m.min;
                const max = m.max;
                const declared = `fluid ${min}→${max}, declared by the style construct${at(e)}`;
                rules.push({
                    assert: 'monotonic',
                    args: { selector: e.target, prop: p, direction: max >= min ? 'up' : 'down' },
                    description: `${prop} never moves against its declared direction (${declared})`,
                });
                rules.push({
                    assert: 'continuous',
                    args: { selector: e.target, prop: p, maxJump: Math.max(8, Math.abs(max - min)) },
                    description: `${prop} has no jump larger than its whole declared range (${declared})`,
                });
                baselines.push({ selector: e.target, prop: p });
            }
        } else if (e.construct === 'ratio' && e.config) {
            const c = e.config as { of?: string; min?: number; max?: number };
            if (typeof c.of === 'string' && c.of !== 'element' && typeof c.min === 'number' && typeof c.max === 'number') {
                rules.push({
                    assert: 'proportion',
                    args: { a: e.target, b: c.of, bounds: { min: c.min, max: c.max } },
                    description: `width ratio declared by the ratio construct${at(e)}`,
                });
            } else {
                skipped.push(`ratio ${e.target}: needs a selector counterpart and both min/max bounds — skipped`);
            }
        } else if (e.construct === 'geometry' || e.construct === 'sync' || e.construct === 'tokens') {
            skipped.push(`${e.construct} ${e.target}: not yet expressible as contract rules`);
        }
    }

    const contract: DesignContract = {
        ...(opts.name ? { name: opts.name } : {}),
        version: 1,
        viewport: { widths },
        rules,
        ...(baselines.length > 0 ? { baselines } : {}),
    };
    return { contract, skipped };
}

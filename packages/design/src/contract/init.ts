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

import type { ProvenanceEntry, SnapshotStore } from '@responsivejs/core/types';
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

// ─── contractFromPage — the on-ramp for a page that never heard of r$ ────

/**
 * Selectors the page sweep should collect so we can tell which rules are
 * worth writing. Nothing here is required to exist: a rule is emitted only
 * when the sweep actually found elements for it.
 */
export const INIT_SELECTORS = ['body', 'main', 'h1', 'p', 'code', 'pre', 'a[href]', 'button', 'img', 'table'];

/** Rules any page can be held to — no r$ constructs, no hand-written selectors. */
const PAGE_RULES: {
    id: string;
    assert: string;
    /** Emitted only when the sweep found this selector (undefined ⇒ always). */
    needs?: string;
    args?: Record<string, unknown>;
    description: string;
}[] = [
    {
        id: 'no-bleed',
        assert: 'noOverflow',
        description: 'nothing bleeds out of the viewport at any width — content inside a scrollable ancestor is a warning, not an error',
    },
    {
        id: 'tappable-links',
        assert: 'touchTarget',
        needs: 'a[href]',
        args: { selector: 'a[href]', min: 24 },
        description: 'every visible link meets the WCAG 2.5.8 (AA) 24px floor; links flowing inside prose are exempt by the standard',
    },
    {
        id: 'tappable-controls',
        assert: 'touchTarget',
        needs: 'button',
        args: { selector: 'button', min: 24 },
        description: 'the same floor for controls',
    },
    {
        id: 'readable-prose',
        assert: 'contrastRatio',
        needs: 'p',
        args: { selector: 'p', level: 'AA' },
        description: 'body text meets WCAG AA against the background actually painted behind it',
    },
    {
        id: 'readable-headings',
        assert: 'contrastRatio',
        needs: 'h1',
        args: { selector: 'h1', level: 'AA' },
        description: 'headings meet AA as well',
    },
    {
        id: 'readable-code',
        assert: 'contrastRatio',
        needs: 'code',
        args: { selector: 'code', level: 'AA' },
        description: 'inline code too — its chip is often semi-transparent, so the check composites it over what is behind',
    },
    {
        id: 'content-present',
        assert: 'visible',
        needs: 'main',
        args: { selector: 'main' },
        description: 'the page actually renders its content at every width (a blank page passes every other rule)',
    },
];

/** Selectors worth pinning a curve for, when the page has them. */
const BASELINE_CANDIDATES: { selector: string; prop: 'fontSize' }[] = [
    { selector: 'h1', prop: 'fontSize' },
    { selector: 'p', prop: 'fontSize' },
];

function selectorsPresent(store: SnapshotStore): Set<string> {
    const present = new Set<string>();
    for (const snapshot of store.snapshots.values()) {
        for (const [selector, elements] of snapshot.elements) {
            if (elements.length > 0) present.add(selector);
        }
    }
    return present;
}

/**
 * A contract for ANY page, measured rather than assumed.
 *
 * The rules that carry most of the value — nothing overflows, targets are
 * tappable, text is readable, content is there — need neither a construct nor
 * a selector the author has to invent, so a page that has never heard of r$
 * still gets a real gate. Rules are emitted only for selectors the sweep
 * actually found, so the generated file never asserts things about elements
 * the page does not have.
 *
 * When the page DOES run the runtime, everything `contractFromManifest`
 * derives is added on top: the two halves compose.
 */
export function contractFromPage(store: SnapshotStore, opts: { name?: string } = {}): InitResult {
    const present = selectorsPresent(store);
    const skipped: string[] = [];
    const rules: NonNullable<DesignContract['rules']> = [];

    for (const rule of PAGE_RULES) {
        if (rule.needs && !present.has(rule.needs)) {
            skipped.push(`${rule.id}: the page has no ${rule.needs} — rule not written`);
            continue;
        }
        rules.push({
            id: rule.id,
            assert: rule.assert as never,
            ...(rule.args ? { args: rule.args as never } : {}),
            description: rule.description,
        });
    }

    const baselines = BASELINE_CANDIDATES.filter((b) => present.has(b.selector)).map((b) => ({ ...b }));

    const fromManifest = store.manifest?.length ? contractFromManifest(store.manifest, opts) : undefined;
    if (fromManifest) {
        // the page-wide noOverflow is already there; keep the construct-derived rest
        for (const rule of fromManifest.contract.rules) {
            if (rule.assert === 'noOverflow' && !rule.args) continue;
            rules.push(rule);
        }
        for (const b of fromManifest.contract.baselines ?? []) {
            if (!baselines.some((existing) => existing.selector === b.selector && existing.prop === b.prop)) {
                baselines.push(b as { selector: string; prop: 'fontSize' });
            }
        }
        skipped.push(...fromManifest.skipped);
    }

    const widths = fromManifest?.contract.viewport?.widths ?? (store.widths.length >= 2 ? [...store.widths] : DEFAULT_WIDTHS);

    return {
        contract: {
            ...(opts.name ? { name: opts.name } : {}),
            version: 1,
            viewport: { widths },
            rules,
            ...(baselines.length > 0 ? { baselines } : {}),
        },
        skipped,
    };
}

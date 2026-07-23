/**
 * axe integration through the MeasurementSource eval seam.
 *
 * axe-core is an OPTIONAL peer, injected as source text and executed via
 * source.evaluate — so a11y works identically on Playwright, CDP, and any
 * custom driver. `color-contrast` is always disabled: axe cannot sample
 * gradients/translucent surfaces (systematic false positives); contrast is
 * delegated to the deterministic contrastRatio constraint.
 */

import type { Violation } from '@responsivejs/core/types';
import type { MeasurementSource } from '../source/types.js';

export interface A11yOptions {
    /** Default: WCAG 2.0/2.1 A+AA tags. */
    wcagTags?: string[];
    /** Always unioned with ['color-contrast']. */
    disableRules?: string[];
    /**
     * Widths to run axe at. Default: [min, max] of the sweep — DOM semantics
     * rarely vary per-width and axe is slow. 'all' opts into every width.
     */
    widths?: number[] | 'all';
    include?: string[];
    exclude?: string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ALWAYS_DISABLED = ['color-contrast'];

interface AxeNodeResult {
    target: string[];
    failureSummary?: string;
}

export interface AxeRawResults {
    violations: {
        id: string;
        impact?: 'minor' | 'moderate' | 'serious' | 'critical';
        help: string;
        helpUrl: string;
        nodes: AxeNodeResult[];
    }[];
    passes: { nodes: unknown[] }[];
}

const IMPACT_SEVERITY: Record<string, Violation['severity']> = {
    critical: 'error',
    serious: 'error',
    moderate: 'warning',
    minor: 'info',
};

/** Map raw axe results onto the unified Violation shape ('axe:' namespace). */
export function normalizeAxeResults(raw: AxeRawResults, width: number): { violations: Violation[]; passes: number } {
    const violations: Violation[] = [];
    for (const v of raw.violations) {
        for (const node of v.nodes) {
            violations.push({
                rule: `axe:${v.id}`,
                element: node.target.join(' '),
                width,
                detail: node.failureSummary?.split('\n')[0] ?? v.help,
                severity: IMPACT_SEVERITY[v.impact ?? 'serious'] ?? 'error',
                suggestion: `${v.help} (${v.helpUrl})`,
            });
        }
    }
    const passes = raw.passes.reduce((n, p) => n + p.nodes.length, 0);
    return { violations, passes };
}

/** Dynamic import of axe-core; null when the optional peer is absent. */
export async function loadAxeSource(): Promise<string | null> {
    const mod = await import('axe-core').catch(() => null);
    if (!mod) return null;
    // CJS/ESM interop under NodeNext: the namespace or its default.
    const axe = (mod as { default?: { source?: string } }).default ?? (mod as { source?: string });
    return axe.source ?? null;
}

export function buildAxeRunExpression(opts: A11yOptions): string {
    const context =
        opts.include || opts.exclude
            ? JSON.stringify({
                  ...(opts.include ? { include: opts.include.map((s) => [s]) } : {}),
                  ...(opts.exclude ? { exclude: opts.exclude.map((s) => [s]) } : {}),
              })
            : 'document';
    const rules: Record<string, { enabled: boolean }> = {};
    for (const id of [...ALWAYS_DISABLED, ...(opts.disableRules ?? [])]) rules[id] = { enabled: false };
    const options = JSON.stringify({
        runOnly: { type: 'tag', values: opts.wcagTags ?? DEFAULT_TAGS },
        rules,
        resultTypes: ['violations', 'passes'],
    });
    return `axe.run(${context}, ${options})`;
}

export type AxeRunOutcome = { violations: Violation[]; passes: number } | { unavailable: string };

/**
 * Run axe at the given widths through the source's eval seam.
 * Returns { unavailable } when axe-core is not installed.
 */
export async function runAxe(
    source: MeasurementSource,
    widths: number[],
    height: number,
    opts: A11yOptions = {},
): Promise<AxeRunOutcome> {
    if (!source.evaluate) return { unavailable: `source '${source.kind}' has no evaluate seam` };

    const axeSource = await loadAxeSource();
    if (axeSource === null) return { unavailable: 'axe-core is not installed (pnpm add -D axe-core)' };

    const targetWidths =
        opts.widths === 'all'
            ? widths
            : (opts.widths ?? [...new Set([Math.min(...widths), Math.max(...widths)])]);

    const violations: Violation[] = [];
    let passes = 0;

    // Inject once per page lifetime (axe's UMD source installs window.axe).
    await source.evaluate(`if (!window.axe) { ${axeSource} }`);

    for (const w of targetWidths) {
        await source.setViewport(w, height);
        const raw = await source.evaluate<AxeRawResults>(buildAxeRunExpression(opts));
        const normalized = normalizeAxeResults(raw, w);
        violations.push(...normalized.violations);
        passes += normalized.passes;
    }

    return { violations, passes };
}

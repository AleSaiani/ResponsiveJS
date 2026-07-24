/**
 * analyzeStore — the pure, driver-free half of the unified oracle.
 * Constraints + aesthetic score + merge over an in-memory SnapshotStore.
 * Exported from the browser subpath too: no Playwright anywhere below here.
 */

import type { SnapshotStore, Report, Violation, FixSuggestion, ProvenanceEntry } from '@responsivejs/core/types';
import { Asserter } from '../constraints/index.js';
import { applyDesignSystem, type DesignSystemConfig, type ValidationSelectors } from '../constraints/design-system.js';
import { scoreFromStore, scoreSubtree, type ScoreResult } from '../score/index.js';

export interface ConstraintsConfig {
    /** Default: true. */
    noOverflow?: boolean;
    /** Default: AA on every analyzed selector. false disables. */
    contrast?: { selectors?: string[]; level?: 'AA' | 'AAA' } | false;
    /** Default: every analyzed selector at the 24px WCAG floor. false disables. */
    touchTarget?: { selectors?: string[]; min?: number } | false;
    textReadable?: string[];
    focusVisible?: string[];
    /** Escape hatch: the full 24-constraint Asserter surface. */
    custom?: (assert: Asserter) => void;
}

export interface AnalyzeStoreOptions {
    /** Default: store.selectors. */
    selectors?: string[];
    constraints?: ConstraintsConfig | ((assert: Asserter) => void);
    designSystem?: { config: DesignSystemConfig; selectors?: ValidationSelectors };
    /** Default: whole-page score. { subtree } scopes it; false disables. */
    score?: { subtree?: string } | false;
}

export interface UnifiedReport extends Report {
    /** pass = zero error-severity violations; clean = zero violations at all. */
    clean: boolean;
    scores?: ScoreResult;
    /** Apply-verbatim surface: only kind:'exact' fixes, deduped by
     *  (selector, property) across widths. Heuristic fixes stay on the
     *  violations they belong to. */
    fixes: FixSuggestion[];
    widths: number[];
    url?: string;
    sources: { measurement: string; a11y: 'axe' | 'skipped' | 'unavailable' };
    /** The page's runtime provenance manifest, when it runs @responsivejs/runtime. */
    manifest?: ProvenanceEntry[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
        byRule: Record<string, number>;
        byWidth: Record<string, number>;
    };
    durationMs: number;
}

/** Violations without an explicit severity keep the legacy strictness: error. */
export function severityOf(v: Violation): 'error' | 'warning' | 'info' {
    return v.severity ?? 'error';
}

export function summarize(violations: Violation[]): UnifiedReport['summary'] {
    const summary: UnifiedReport['summary'] = { errors: 0, warnings: 0, info: 0, byRule: {}, byWidth: {} };
    for (const v of violations) {
        const sev = severityOf(v);
        if (sev === 'error') summary.errors++;
        else if (sev === 'warning') summary.warnings++;
        else summary.info++;
        summary.byRule[v.rule] = (summary.byRule[v.rule] ?? 0) + 1;
        const w = String(v.width);
        summary.byWidth[w] = (summary.byWidth[w] ?? 0) + 1;
    }
    return summary;
}

function applyDefaultConstraints(assert: Asserter, selectors: string[], cfg: ConstraintsConfig): void {
    if (cfg.noOverflow !== false) assert.noOverflow();

    if (cfg.contrast !== false) {
        const level = (cfg.contrast && cfg.contrast.level) || 'AA';
        for (const sel of (cfg.contrast && cfg.contrast.selectors) || selectors) {
            assert.contrastRatio(sel, level);
        }
    }

    if (cfg.touchTarget !== false) {
        const min = cfg.touchTarget?.min;
        for (const sel of cfg.touchTarget?.selectors ?? selectors) assert.touchTarget(sel, min);
    }

    for (const sel of cfg.textReadable ?? []) assert.textReadable(sel);
    for (const sel of cfg.focusVisible ?? []) assert.focusVisible(sel);

    cfg.custom?.(assert);
}

type Owner = NonNullable<Violation['owner']>;

/** '.site-nav a' is a descendant selector of '.site-nav' (space/child combinator). */
function isDescendantSelector(selector: string, target: string): boolean {
    if (!selector.startsWith(target)) return false;
    const rest = selector.slice(target.length);
    return /^\s|^\s*>/.test(rest);
}

function ownerOf(entry: NonNullable<SnapshotStore['manifest']>[number], via?: string): Owner {
    return {
        construct: entry.construct,
        behavior: entry.behavior,
        ...(entry.source ? { source: entry.source } : {}),
        ...(via ? { via } : {}),
    };
}

const toKebabProp = (p: string): string => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** When the owning construct controls the very property a fix would patch,
 *  a CSS patch is a lie (the runtime overwrites inline styles): rewrite the
 *  fix as a runtime-patch pointing at the construct declaration. */
function toRuntimePatch(v: Violation, entry: NonNullable<SnapshotStore['manifest']>[number]): void {
    if (!v.fix || v.fix.kind === 'runtime-patch' || !entry.config) return;
    const wanted = toKebabProp(v.fix.property);
    const key = Object.keys(entry.config).find((k) => toKebabProp(k) === wanted);
    if (key === undefined) return;
    v.fix = {
        ...v.fix,
        kind: 'runtime-patch',
        construct: entry.construct,
        ...(entry.source ? { source: entry.source } : {}),
        change: { property: key, current: entry.config[key], suggested: v.fix.value },
        reason: `'${v.fix.property}' is controlled by the ${entry.construct} construct${entry.source ? ` at ${entry.source}` : ''} — patch its declaration, a CSS patch would be overwritten`,
    };
}

/**
 * Provenance: annotate violations with the runtime construct(s) that own the
 * element (from the manifest the collector shipped with the measurements).
 * Exact target match first; then ancestors by descendant-selector syntax
 * ('.site-nav a' is owned by the construct on '.site-nav'). The closed
 * loop's read side — an agent can patch the CONSTRUCT, not the CSS.
 */
export function attachOwnership(violations: Violation[], manifest: SnapshotStore['manifest']): void {
    if (!manifest || manifest.length === 0) return;
    for (const v of violations) {
        if (!v.element || v.owner) continue;
        const selector = v.element.replace(/\[\d+\]$/, '');
        const exact = manifest.filter((e) => e.target === selector || e.target === v.element);
        const ancestors = manifest
            .filter((e) => e.target !== selector && isDescendantSelector(selector, e.target))
            // most specific (longest) ancestor target first
            .sort((a, b) => b.target.length - a.target.length);

        const matched = [
            ...exact.map((e) => ({ entry: e, via: undefined as string | undefined })),
            ...ancestors.map((e) => ({ entry: e, via: e.target })),
        ];
        if (matched.length === 0) continue;

        v.owner = ownerOf(matched[0].entry, matched[0].via);
        if (matched.length > 1) v.owners = matched.map((m) => ownerOf(m.entry, m.via));
        // the first owner whose config covers the fix's property claims it
        for (const m of matched) {
            toRuntimePatch(v, m.entry);
            if (v.fix?.kind === 'runtime-patch') break;
        }
    }
}

/** Analyze an in-memory store: constraints + score → UnifiedReport (sync, pure). */
export function analyzeStore(store: SnapshotStore, opts: AnalyzeStoreOptions = {}): UnifiedReport {
    const started = Date.now();
    const selectors = opts.selectors ?? store.selectors;
    const assert = new Asserter(store);

    if (opts.designSystem) {
        applyDesignSystem(assert, opts.designSystem.config, opts.designSystem.selectors);
    }
    if (typeof opts.constraints === 'function') {
        opts.constraints(assert);
    } else {
        applyDefaultConstraints(assert, selectors, opts.constraints ?? {});
    }

    const base = assert.report();
    attachOwnership(base.violations, store.manifest);
    let scores: ScoreResult | undefined;
    if (opts.score !== false) {
        scores = opts.score?.subtree ? scoreSubtree(store, opts.score.subtree) : scoreFromStore(store);
    }

    return finalizeReport(base, {
        scores,
        widths: store.widths,
        measurement: 'store',
        a11y: 'skipped',
        durationMs: Date.now() - started,
        manifest: store.manifest,
    });
}

interface FinalizeExtras {
    scores?: ScoreResult;
    widths: number[];
    url?: string;
    measurement: string;
    a11y: UnifiedReport['sources']['a11y'];
    durationMs: number;
    manifest?: ProvenanceEntry[];
}

/** The same violation at 320 and 768 yields the same patch — one entry.
 *  Only exact fixes qualify: an agent can apply this list without judgment. */
export function applicableFixes(violations: Violation[]): FixSuggestion[] {
    const seen = new Set<string>();
    const fixes: FixSuggestion[] = [];
    for (const v of violations) {
        const f = v.fix;
        if (!f || f.kind !== 'exact') continue;
        const key = `${f.selector}|${f.property}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fixes.push(f);
    }
    return fixes;
}

/** Assemble a UnifiedReport from a base Report and context. */
export function finalizeReport(base: Report, extras: FinalizeExtras): UnifiedReport {
    const summary = summarize(base.violations);
    return {
        ...base,
        pass: summary.errors === 0,
        clean: base.violations.length === 0,
        scores: extras.scores,
        fixes: applicableFixes(base.violations),
        widths: extras.widths,
        url: extras.url,
        sources: { measurement: extras.measurement, a11y: extras.a11y },
        ...(extras.manifest ? { manifest: extras.manifest } : {}),
        summary,
        durationMs: extras.durationMs,
    };
}

/** Merge additional partial reports (e.g. a consumer's own checks) into one. */
export function mergeReports(base: UnifiedReport, ...extra: Report[]): UnifiedReport {
    const violations = [...base.violations, ...extra.flatMap((r) => r.violations)];
    const total = base.total + extra.reduce((n, r) => n + r.total, 0);
    const failed = violations.length;
    const merged: Report = { pass: failed === 0, total, passed: total - failed, failed, violations };
    return finalizeReport(merged, {
        scores: base.scores,
        widths: base.widths,
        url: base.url,
        measurement: base.sources.measurement,
        a11y: base.sources.a11y,
        durationMs: base.durationMs,
        manifest: base.manifest,
    });
}

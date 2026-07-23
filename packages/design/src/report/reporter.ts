/**
 * Reporter: formats constraint violations for humans, CI logs, and LLMs.
 * Plain Report formats are byte-compatible with F0; UnifiedReport adds
 * severity summaries, scores, fixes, and SARIF.
 */

import type { Report, Violation } from '@responsivejs/core/types';
import type { AestheticScore } from '@responsivejs/core/aesthetics';
import type { UnifiedReport } from '../analyze/core.js';

function isUnified(report: Report): report is UnifiedReport {
    return 'summary' in report && 'sources' in report;
}

function violationLine(v: Violation): string[] {
    const el = v.element || v.elements?.join(' + ') || '?';
    return [`  [${v.rule}] @${v.width}px ${el}`, `    ${v.detail}`];
}

/** Format report as a human-readable string */
export function formatConsole(report: Report): string {
    const lines: string[] = [];

    if (!isUnified(report)) {
        if (report.pass) {
            lines.push(`r$ ✓ ${report.passed}/${report.total} constraints passed`);
        } else {
            lines.push(`r$ ✗ ${report.failed}/${report.total} constraints failed`);
            lines.push('');
            for (const v of report.violations) lines.push(...violationLine(v));
        }
        return lines.join('\n');
    }

    const { summary } = report;
    lines.push(
        report.pass
            ? `r$ ✓ pass — ${report.passed}/${report.total} checks (${summary.warnings} warnings, ${summary.info} info)`
            : `r$ ✗ fail — ${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info (${report.total} checks)`,
    );

    if (report.violations.length > 0) {
        lines.push('');
        const byRule = new Map<string, Violation[]>();
        for (const v of report.violations) {
            (byRule.get(v.rule) ?? byRule.set(v.rule, []).get(v.rule)!).push(v);
        }
        for (const [rule, violations] of byRule) {
            lines.push(`  ${rule} (${violations.length})`);
            for (const v of violations.slice(0, 5)) {
                const el = v.element || v.elements?.join(' + ') || '?';
                lines.push(`    @${v.width}px ${el} — ${v.detail}`);
            }
            if (violations.length > 5) lines.push(`    … and ${violations.length - 5} more`);
        }
    }

    if (report.scores) {
        const s = report.scores.average;
        lines.push('');
        lines.push(`  score: overall ${fmt(s.overall)} (birkhoff ${fmt(s.birkhoff)})`);
        for (const sug of report.scores.suggestions.slice(0, 3)) lines.push(`    ${sug}`);
    }
    if (report.fixes.length > 0) {
        lines.push('');
        lines.push(`  fixes available: ${report.fixes.length}`);
    }

    return lines.join('\n');
}

function fmt(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2);
}

/** JSON-safe view of a report: Maps become plain records. */
export function toSerializable(report: Report): unknown {
    if (!isUnified(report) || !report.scores) return report;
    const perWidth: Record<string, AestheticScore> = {};
    for (const [w, score] of report.scores.perWidth) perWidth[String(w)] = score;
    return { ...report, scores: { ...report.scores, perWidth } };
}

/** Format report as structured JSON (for LLM consumption) */
export function formatJSON(report: Report): string {
    return JSON.stringify(toSerializable(report), null, 2);
}

/** Format report as a compact summary (for CI logs) */
export function formatCompact(report: Report): string {
    if (isUnified(report)) {
        const { summary } = report;
        const status = report.pass ? 'PASS' : 'FAIL';
        return `r$ ${status} E${summary.errors}/W${summary.warnings}/I${summary.info} (${report.total} checks, ${report.widths.length} widths)`;
    }
    if (report.pass) return `r$ PASS (${report.total} checks)`;
    const uniqueRules = [...new Set(report.violations.map(v => v.rule))];
    const uniqueWidths = [...new Set(report.violations.map(v => v.width))];
    return `r$ FAIL ${report.failed}/${report.total} — rules: ${uniqueRules.join(',')} — widths: ${uniqueWidths.join(',')}`;
}

// ─── contract reports ───────────────────────────────────────────────────

import type { ContractReport } from '@responsivejs/contract';

/** Human-readable contract report, grouped by rule id with authored intent. */
export function formatContractConsole(report: ContractReport): string {
    const lines: string[] = [];
    const name = report.contract.name ? ` '${report.contract.name}'` : '';
    lines.push(
        report.pass
            ? `r$ contract${name} ✓ ${report.passed}/${report.total} checks`
            : `r$ contract${name} ✗ ${report.failed} violations (${report.total} checks)`,
    );

    for (const rule of report.rules) {
        if (rule.skipped) {
            lines.push(`  ~ ${rule.ruleId} (${rule.assert}) — skipped, no widths in range`);
            continue;
        }
        if (rule.pass) continue;
        lines.push(`  ✗ ${rule.ruleId} (${rule.assert})`);
        const description = rule.violations[0]?.ruleDescription;
        if (description) lines.push(`    intent: ${description}`);
        for (const v of rule.violations.slice(0, 5)) {
            lines.push(`    @${v.width}px ${v.element ?? v.elements?.join(' + ') ?? '?'} — ${v.detail}`);
        }
        if (rule.violations.length > 5) lines.push(`    … and ${rule.violations.length - 5} more`);
    }

    for (const s of report.score ?? []) {
        if (!s.pass) {
            lines.push(`  ✗ score.${s.metric}${s.scope ? ` (${s.scope})` : ''}: ${s.actual.toFixed(3)} < ${s.min}`);
        }
    }
    for (const b of report.baselines ?? []) {
        if (b.unrecorded) lines.push(`  ~ baseline ${b.selector}.${b.prop} — not recorded yet`);
        else if (!b.pass) lines.push(`  ✗ baseline ${b.selector}.${b.prop} — ${b.deviations.length} deviations`);
    }

    return lines.join('\n');
}

/** One-line contract summary for CI logs. */
export function formatContractCompact(report: ContractReport): string {
    const name = report.contract.name ?? 'contract';
    if (report.pass) return `r$ ${name} PASS (${report.total} checks)`;
    const failedRules = report.rules.filter((r) => !r.pass && !r.skipped).map((r) => r.ruleId);
    return `r$ ${name} FAIL ${report.failed}/${report.total} — rules: ${failedRules.join(',')}`;
}

// ─── SARIF 2.1.0 ────────────────────────────────────────────────────────

const SARIF_LEVEL: Record<string, string> = { error: 'error', warning: 'warning', info: 'note' };

/** Format a unified report as SARIF 2.1.0 (CI/code-scanning ecosystems). */
export function formatSARIF(report: UnifiedReport, opts: { toolVersion?: string } = {}): string {
    const ruleIds = [...new Set(report.violations.map((v) => v.rule))];
    const sarif = {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'responsivejs-design',
                        informationUri: 'https://github.com/AleSaiani/ResponsiveJS',
                        version: opts.toolVersion ?? '0.0.0',
                        rules: ruleIds.map((id) => ({ id })),
                    },
                },
                results: report.violations.map((v) => ({
                    ruleId: v.rule,
                    level: SARIF_LEVEL[v.severity ?? 'error'],
                    message: {
                        text: `@${v.width}px: ${v.detail}${v.suggestion ? ` — ${v.suggestion}` : ''}`,
                    },
                    locations: [
                        {
                            logicalLocations: [
                                {
                                    fullyQualifiedName: v.element ?? v.elements?.join(' + ') ?? 'page',
                                },
                            ],
                        },
                    ],
                })),
            },
        ],
    };
    return JSON.stringify(sarif, null, 2);
}

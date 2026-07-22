/**
 * Reporter: formats constraint violations for humans and LLMs.
 */

import type { Report } from '@responsivejs/core/types';

/** Format report as a human-readable string */
export function formatConsole(report: Report): string {
    const lines: string[] = [];

    if (report.pass) {
        lines.push(`r$ ✓ ${report.passed}/${report.total} constraints passed`);
    } else {
        lines.push(`r$ ✗ ${report.failed}/${report.total} constraints failed`);
        lines.push('');

        for (const v of report.violations) {
            const el = v.element || v.elements?.join(' + ') || '?';
            lines.push(`  [${v.rule}] @${v.width}px ${el}`);
            lines.push(`    ${v.detail}`);
        }
    }

    return lines.join('\n');
}

/** Format report as structured JSON (for LLM consumption) */
export function formatJSON(report: Report): string {
    return JSON.stringify(report, null, 2);
}

/** Format report as a compact summary (for CI logs) */
export function formatCompact(report: Report): string {
    if (report.pass) return `r$ PASS (${report.total} checks)`;
    const uniqueRules = [...new Set(report.violations.map(v => v.rule))];
    const uniqueWidths = [...new Set(report.violations.map(v => v.width))];
    return `r$ FAIL ${report.failed}/${report.total} — rules: ${uniqueRules.join(',')} — widths: ${uniqueWidths.join(',')}`;
}

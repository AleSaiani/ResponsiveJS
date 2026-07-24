/**
 * rjs analyze <url> — sweep + unified oracle, driver-pluggable.
 */

import { analyze, formatConsole, formatJSON, formatSARIF, type UnifiedReport } from '@responsivejs/design';
import type { CliIo, SharedOptions } from '../main.js';

/** Landmark-ish defaults: broad coverage without page-specific knowledge. */
export const DEFAULT_SELECTORS = [
    'main',
    'header',
    'footer',
    'nav',
    'section',
    'article',
    'h1',
    'h2',
    'h3',
    'p',
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'img',
];

export async function runAnalyze(url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    let report: UnifiedReport;
    try {
        report = await analyze({
            source: driver.source,
            url,
            selectors: opts.selectors ?? DEFAULT_SELECTORS,
            widths: opts.widths,
            height: opts.height,
            scroll: opts.scroll,
            ...(opts.a11y ? {} : { a11y: false as const }),
            ...(opts.touchMin !== undefined ? { constraints: { touchTarget: { min: opts.touchMin } } } : {}),
        });
    } finally {
        await driver.close();
    }

    const text =
        opts.format === 'json' ? formatJSON(report) : opts.format === 'sarif' ? formatSARIF(report) : formatConsole(report);
    if (opts.out) {
        await io.writeFile(opts.out, text);
        io.stdout(`r$ report → ${opts.out}`);
    } else {
        io.stdout(text);
    }

    const ok = opts.strict ? report.clean : report.pass;
    return ok ? 0 : 1;
}

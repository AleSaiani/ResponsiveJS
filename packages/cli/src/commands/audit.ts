/**
 * rjs audit <url> — the one-shot product command: sweep + full oracle +
 * screenshots, rendered as a self-contained HTML report you can hand to
 * anyone. `--crawl` walks same-origin links, `--vs <url>` audits a second
 * site side by side.
 */

import {
    analyze,
    formatCompact,
    renderAuditHTML,
    sweepSource,
    type MeasurementSource,
    type PageAudit,
} from '@responsivejs/design';
import { DEFAULT_SELECTORS } from './analyze.js';
import type { CliIo, SharedOptions } from '../main.js';

const DEFAULT_OUT = 'rjs-audit.html';
const DEFAULT_MAX_PAGES = 5;

/** Same-origin, hash-stripped, http(s)-only normalization; null = don't crawl it. */
export function crawlable(raw: string, origin: string): string | null {
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return null;
    }
    if (u.origin !== origin || (u.protocol !== 'http:' && u.protocol !== 'https:')) return null;
    u.hash = '';
    return u.href;
}

function fileStem(url: string): string {
    try {
        const u = new URL(url);
        return `${u.hostname}${u.pathname}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
    } catch {
        return 'page';
    }
}

async function auditOne(
    source: MeasurementSource,
    url: string,
    opts: SharedOptions,
    withScreenshots: boolean,
): Promise<PageAudit> {
    const store = await sweepSource(source, {
        url,
        selectors: opts.selectors ?? DEFAULT_SELECTORS,
        widths: opts.widths,
        height: opts.height,
        scroll: opts.scroll,
        screenshots: withScreenshots,
    });
    // store + source: constraints/score run on the store, axe through the
    // still-open page (the sweep leaves the browser on `url`).
    const report = await analyze({
        store,
        source,
        url,
        ...(opts.a11y ? {} : { a11y: false as const }),
        ...(opts.touchMin !== undefined ? { constraints: { touchTarget: { min: opts.touchMin } } } : {}),
    });
    return { url, report, store };
}

export async function runAudit(url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    const pages: PageAudit[] = [];

    const withScreenshots = typeof driver.source.screenshot === 'function';
    if (opts.screenshotsDir !== undefined && !withScreenshots) {
        io.stderr(`r$ ✗ --screenshots needs a driver with the screenshot seam ('${driver.kind}' has none)`);
        await driver.close();
        return 2;
    }
    if (!withScreenshots) io.stderr(`r$ ~ driver '${driver.kind}' cannot screenshot — report will have no images`);

    try {
        const origin = new URL(url).origin;
        const first = crawlable(url, origin) ?? url;
        const maxPages = opts.crawl ? (opts.maxPages ?? DEFAULT_MAX_PAGES) : 1;
        const queue: string[] = [first];
        const seen = new Set(queue);

        while (queue.length > 0 && pages.length < maxPages) {
            const u = queue.shift()!;
            const page = await auditOne(driver.source, u, opts, withScreenshots);
            pages.push(page);
            io.stdout(formatCompact(page.report).replace('r$ ', `r$ ${u} `));

            if (opts.crawl && pages.length < maxPages) {
                if (!driver.source.evaluate) {
                    io.stderr(`r$ ~ driver '${driver.kind}' cannot evaluate — crawl stops at this page`);
                    break;
                }
                const links = await driver.source.evaluate<string[]>(
                    `Array.from(document.querySelectorAll('a[href]')).map(a => a.href)`,
                );
                for (const raw of Array.isArray(links) ? links : []) {
                    const next = crawlable(raw, origin);
                    if (next && !seen.has(next)) {
                        seen.add(next);
                        queue.push(next);
                    }
                }
            }
        }
        if (opts.crawl && queue.length > 0) {
            io.stdout(`r$ ~ crawl stopped at ${pages.length} pages (--max-pages); ${queue.length} discovered but not audited`);
        }

        if (opts.vs) {
            const page = await auditOne(driver.source, opts.vs, opts, withScreenshots);
            pages.push(page);
            io.stdout(formatCompact(page.report).replace('r$ ', `r$ ${opts.vs} `));
        }
    } finally {
        await driver.close();
    }

    if (opts.screenshotsDir !== undefined) {
        for (const page of pages) {
            for (const [w, bytes] of page.store?.screenshots ?? []) {
                await io.writeFileBytes(`${opts.screenshotsDir}/${fileStem(page.url)}-${w}.png`, bytes);
            }
        }
        io.stdout(`r$ screenshots → ${opts.screenshotsDir}/`);
    }

    const out = opts.out ?? DEFAULT_OUT;
    await io.writeFile(out, renderAuditHTML(pages, { title: `r$ audit — ${new URL(url).hostname}` }));
    io.stdout(`r$ report → ${out}`);

    const ok = pages.every((p) => (opts.strict ? p.report.clean : p.report.pass));
    return ok ? 0 : 1;
}

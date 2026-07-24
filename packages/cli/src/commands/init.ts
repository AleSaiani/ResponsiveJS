/**
 * rjs init <url> — generate a design contract FROM the page's runtime
 * constructs (the provenance manifest): what the page declares it does
 * becomes rules the oracle verifies it keeps doing. The free regression net.
 */

import { contractFromManifest, sweepSource } from '@responsivejs/design';
import type { CliIo, SharedOptions } from '../main.js';

function nameOf(url: string): string | undefined {
    try {
        return new URL(url).hostname || undefined;
    } catch {
        return undefined;
    }
}

export async function runInit(url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    let manifest;
    try {
        // One narrow sweep: we only need the page loaded so the collector
        // picks up window.__rjs_manifest.
        const store = await sweepSource(driver.source, {
            url,
            selectors: ['body'],
            widths: [opts.widths?.[0] ?? 1024],
            height: opts.height ?? 900,
        });
        manifest = store.manifest;
    } finally {
        await driver.close();
    }

    if (!manifest || manifest.length === 0) {
        io.stderr(
            'r$ ✗ no provenance manifest on the page — it does not run @responsivejs/runtime ' +
                '(or no construct is active). rjs init generates contracts FROM constructs; ' +
                'for a page without them, write the contract by hand (see docs/guides/validation.md).',
        );
        return 2;
    }

    const { contract, skipped } = contractFromManifest(manifest, { name: nameOf(url) });
    for (const s of skipped) io.stderr(`r$ ~ not expressible: ${s}`);

    const text = JSON.stringify(contract, null, 2) + '\n';
    if (opts.out) {
        await io.writeFile(opts.out, text);
        io.stdout(
            `r$ ✓ ${contract.rules.length} rules, ${contract.baselines?.length ?? 0} baselines from ${manifest.length} constructs → ${opts.out}`,
        );
        if ((contract.baselines?.length ?? 0) > 0) {
            io.stdout(`  next: rjs record ${opts.out} ${url}   # pin today's curves`);
        }
    } else {
        io.stdout(text);
    }
    return 0;
}

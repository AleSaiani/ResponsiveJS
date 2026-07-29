/**
 * rjs init <url> — generate a design contract for a page.
 *
 * Two sources, composed:
 *  - the page itself: the rules that need no constructs and no invented
 *    selectors (nothing overflows, targets are tappable, text is readable,
 *    content is there) plus measured baselines, emitted only for the
 *    selectors the sweep actually found;
 *  - the provenance manifest, when the page runs the runtime: what it
 *    DECLARES it does becomes rules the oracle verifies it keeps doing.
 *
 * A page that has never heard of r$ still gets a real gate — that is the
 * point. Adoption starts by measuring what you already have.
 */

import { contractFromPage, sweepSource, INIT_SELECTORS } from '@responsivejs/design';
import type { CliIo, SharedOptions } from '../main.js';

const DEFAULT_WIDTHS = [320, 768, 1280];

function nameOf(url: string): string | undefined {
    try {
        return new URL(url).hostname || undefined;
    } catch {
        return undefined;
    }
}

export async function runInit(url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    const widths = opts.widths ?? DEFAULT_WIDTHS;
    let store;
    try {
        store = await sweepSource(driver.source, {
            url,
            selectors: INIT_SELECTORS,
            widths,
            height: opts.height ?? 900,
        });
    } finally {
        await driver.close();
    }

    const { contract, skipped } = contractFromPage(store, { name: nameOf(url) });
    for (const s of skipped) io.stderr(`r$ ~ ${s}`);

    const constructs = store.manifest?.length ?? 0;
    const text = JSON.stringify(contract, null, 2) + '\n';
    if (!opts.out) {
        io.stdout(text);
        return 0;
    }

    await io.writeFile(opts.out, text);
    io.stdout(
        `r$ ✓ ${contract.rules.length} rules, ${contract.baselines?.length ?? 0} baselines → ${opts.out}` +
            (constructs > 0 ? ` (${constructs} r$ constructs read from the page)` : ''),
    );
    if (constructs === 0) {
        io.stdout('  the page does not run @responsivejs/runtime — the rules above are the ones any page can be held to');
    }
    if ((contract.baselines?.length ?? 0) > 0) {
        io.stdout(`  next: rjs record ${opts.out} ${url}   # pin today's curves`);
    }
    io.stdout(`  then: rjs verify ${opts.out} ${url}   # the gate, exit 1 on violations`);
    return 0;
}

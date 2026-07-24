/**
 * rjs record <contract> <url> — measure the page and pin baseline curves into
 * the contract (the "record then assert" flow). Writes back to the contract
 * file unless --out points elsewhere.
 */

import { contractSweepPlan, recordBaseline, sweepSource } from '@responsivejs/design';
import type { DesignContract } from '@responsivejs/contract';
import type { CliIo, SharedOptions } from '../main.js';
import { loadContract } from './verify.js';

export async function runRecord(contractPath: string, url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const contract = await loadContract(contractPath, io);
    const plan = contractSweepPlan(contract);

    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    let recorded: DesignContract;
    try {
        const store = await sweepSource(driver.source, {
            url,
            selectors: plan.selectors,
            widths: opts.widths ?? plan.widths,
            height: opts.height ?? plan.height,
        });
        recorded = recordBaseline(contract, store);
    } finally {
        await driver.close();
    }

    const baselines = recorded.baselines ?? [];
    if (baselines.length === 0) {
        io.stderr(`r$ ✗ contract has no baselines[] to record — add { selector, prop } entries first`);
        return 2;
    }

    const target = opts.out ?? contractPath;
    await io.writeFile(target, JSON.stringify(recorded, null, 2) + '\n');
    io.stdout(`r$ ✓ recorded ${baselines.length} baseline${baselines.length === 1 ? '' : 's'} → ${target}`);
    return 0;
}

/**
 * rjs verify <contract> <url> — execute a design contract against a live page.
 * The sweep (selectors, widths, height) is derived from the contract itself.
 */

import {
    contractSweepPlan,
    formatContractConsole,
    formatContractSARIF,
    sweepSource,
    verifyContract,
    parseContract,
    HarnessSource,
    type ContractReport,
} from '@responsivejs/design';
import type { CliIo, SharedOptions } from '../main.js';

export async function loadContract(path: string, io: CliIo): Promise<object> {
    let text: string;
    try {
        text = await io.readFile(path);
    } catch {
        throw new Error(`cannot read contract file '${path}'`);
    }
    let json: object;
    try {
        json = JSON.parse(text) as object;
    } catch (e) {
        throw new Error(`contract '${path}' is not valid JSON — ${(e as Error).message}`, { cause: e });
    }
    return parseContract(json); // structured loader errors (with did-you-mean) surface here
}

export async function runVerify(contractPath: string, url: string, opts: SharedOptions, io: CliIo): Promise<number> {
    const contract = await loadContract(contractPath, io);
    const plan = contractSweepPlan(contract);

    const driver = await io.resolveDriver(opts.driver, { headed: opts.headed });
    let report: ContractReport;
    try {
        const widths = opts.widths ?? plan.widths;
        let store;
        if (plan.harness) {
            // Component contract: resize the harness, not the window.
            if (!driver.source.open || !driver.source.evaluate) {
                throw new Error(`driver '${driver.kind}' cannot open a page and evaluate — required for component contracts`);
            }
            await driver.source.open(url);
            const evaluate = driver.source.evaluate.bind(driver.source);
            const harness = new HarnessSource((expression) => evaluate(expression), {
                harness: plan.harness,
                height: opts.height ?? plan.height,
            });
            try {
                store = await sweepSource(harness, { selectors: plan.selectors, widths });
            } finally {
                await harness.close().catch(() => {});
            }
        } else {
            store = await sweepSource(driver.source, {
                url,
                selectors: plan.selectors,
                widths,
                height: opts.height ?? plan.height,
            });
        }
        report = verifyContract(contract, store);
    } finally {
        await driver.close();
    }

    const text =
        opts.format === 'json'
            ? JSON.stringify(report, null, 2)
            : opts.format === 'sarif'
              ? formatContractSARIF(report)
              : formatContractConsole(report);
    if (opts.out) {
        await io.writeFile(opts.out, text);
        io.stdout(`r$ report → ${opts.out}`);
    } else {
        io.stdout(text);
    }
    return report.pass ? 0 : 1;
}

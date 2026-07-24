/**
 * Driver resolution: turn a --driver choice into a live MeasurementSource.
 *
 * playwright     → dynamic import (optional peer), chromium headless
 * agent-browser  → the native CLI binary over EvalSource + chunkedEval
 * auto           → playwright if installed, else agent-browser, else guidance
 */

import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { existsSync } from 'node:fs';
import { EvalSource, PlaywrightSource, chunkedEval, type MeasurementSource } from '@responsivejs/design';

export type DriverChoice = 'auto' | 'playwright' | 'agent-browser';

export interface ResolvedDriver {
    kind: string;
    source: MeasurementSource;
    close(): Promise<void>;
}

export async function resolveDriver(choice: DriverChoice, opts: { headed?: boolean } = {}): Promise<ResolvedDriver> {
    if (choice === 'playwright') {
        const driver = await tryPlaywright(opts);
        if (!driver) throw new Error("driver 'playwright' needs Playwright installed: npm i -D playwright && npx playwright install chromium");
        return driver;
    }
    if (choice === 'agent-browser') {
        const driver = tryAgentBrowser();
        if (!driver) throw new Error("driver 'agent-browser' not found: npm i -g agent-browser && agent-browser install (or set AGENT_BROWSER_BIN)");
        return driver;
    }
    const playwright = await tryPlaywright(opts);
    if (playwright) return playwright;
    const agentBrowser = tryAgentBrowser();
    if (agentBrowser) return agentBrowser;
    throw new Error(
        'no driver available. Install one of:\n' +
            '  npm i -D playwright && npx playwright install chromium\n' +
            '  npm i -g agent-browser && agent-browser install',
    );
}

// ─── playwright ─────────────────────────────────────────────────────────

async function tryPlaywright(opts: { headed?: boolean }): Promise<ResolvedDriver | null> {
    let chromium;
    for (const name of ['playwright', '@playwright/test']) {
        try {
            ({ chromium } = await import(name));
            break;
        } catch {
            // try the next package
        }
    }
    if (!chromium) return null;

    const browser = await chromium.launch({ headless: !opts.headed });
    const page = await browser.newPage();
    return {
        kind: 'playwright',
        source: new PlaywrightSource(page),
        close: () => browser.close() as Promise<void>,
    };
}

// ─── agent-browser ──────────────────────────────────────────────────────

/**
 * execFile would wait for the stdio streams to CLOSE — but the very first CLI
 * command spawns the agent-browser daemon, which inherits those pipes and
 * holds them open forever. Resolve on exit instead, with a short grace for
 * trailing stdout chunks.
 */
function run(bin: string, args: string[]): Promise<string> {
    return new Promise((res, rej) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let out = '';
        let err = '';
        child.stdout.on('data', (d: Buffer) => (out += d));
        child.stderr.on('data', (d: Buffer) => (err += d));
        child.on('error', rej);
        child.on('exit', (code) => {
            setTimeout(() => {
                if (code === 0) res(out.trim());
                else rej(new Error(err.trim() || out.trim() || `agent-browser exited with code ${code}`));
            }, 30);
        });
    });
}

/** Native binary (npm layout: <bindir>/node_modules/agent-browser/bin/agent-browser-<plat>-<arch>). */
export function findAgentBrowser(): string | null {
    if (process.env.AGENT_BROWSER_BIN) return process.env.AGENT_BROWSER_BIN;
    const native = `agent-browser-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
        if (!dir) continue;
        const candidate = join(dir, 'node_modules', 'agent-browser', 'bin', native);
        if (existsSync(candidate)) return candidate;
        // POSIX shims are directly executable; Windows .cmd shims are not (spawn EINVAL).
        if (process.platform !== 'win32') {
            const shim = join(dir, 'agent-browser');
            if (existsSync(shim)) return shim;
        }
    }
    return null;
}

function tryAgentBrowser(): ResolvedDriver | null {
    const bin = findAgentBrowser();
    if (!bin) return null;

    const session = `rjs-${process.pid}`;
    const ab = (...args: string[]): Promise<string> => run(bin, ['--session', session, ...args]);
    const abEval = async (expression: string): Promise<unknown> => {
        const out = await ab('--json', 'eval', expression);
        const parsed = JSON.parse(out) as { success: boolean; data?: { result?: unknown }; error?: string };
        if (!parsed.success) throw new Error(parsed.error ?? 'agent-browser eval failed');
        return parsed.data?.result;
    };

    return {
        kind: 'agent-browser',
        source: new EvalSource(chunkedEval(abEval), {
            setViewport: async (w, h) => void (await ab('set', 'viewport', String(w), String(h))),
            open: async (url) => void (await ab('open', url)),
        }),
        close: async () => void (await ab('close').catch(() => {})),
    };
}

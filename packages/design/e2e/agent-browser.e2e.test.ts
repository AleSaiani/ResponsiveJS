/**
 * E2E: r$ composed with Vercel's agent-browser CLI — the README claim, live.
 * EvalSource wraps the CLI's `eval`/`set viewport`/`open` commands; the full
 * oracle (constraints + score + chunk-injected axe) runs in the CLI's browser.
 *
 * Skipped when agent-browser is not installed (set AGENT_BROWSER_BIN to point
 * at the native binary explicitly).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { existsSync } from 'node:fs';
import { EvalSource, chunkedEval } from '../src/source/eval.js';
import { analyze } from '../src/analyze/index.js';

const SESSION = 'rjs-e2e';

/**
 * Resolve on exit, NOT on stream close: the first CLI command spawns the
 * agent-browser daemon, which inherits the stdio pipes and never closes them.
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
function findAgentBrowser(): string | null {
    if (process.env.AGENT_BROWSER_BIN) return process.env.AGENT_BROWSER_BIN;
    const name = `agent-browser-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
        const candidate = join(dir, 'node_modules', 'agent-browser', 'bin', name);
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const BIN = findAgentBrowser();

function ab(...args: string[]): Promise<string> {
    return run(BIN!, ['--session', SESSION, ...args]);
}

async function rawEval(expression: string): Promise<unknown> {
    const out = await ab('--json', 'eval', expression);
    const parsed = JSON.parse(out) as { success: boolean; data?: { result?: unknown }; error?: string };
    if (!parsed.success) throw new Error(parsed.error ?? 'agent-browser eval failed');
    return parsed.data?.result;
}

const FIXTURE =
    'data:text/html,' +
    encodeURIComponent(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>rjs e2e</title></head>
<body style="margin:0;color:#111;background:#fff">
<main style="padding:16px">
  <h1 style="font-size:clamp(20px,4vw,40px)">Proof</h1>
  <div class="card" style="width:480px;height:120px;background:#eee">fixed width card</div>
  <button style="width:120px;height:28px;color:#111;background:#fff">tiny</button>
</main>
</body></html>`);

describe.skipIf(!BIN)('agent-browser composition (live CLI)', () => {
    afterAll(async () => {
        await ab('close').catch(() => {});
    });

    it('EvalSource over the CLI runs the full oracle, axe included', async () => {
        // Each chunk is one CLI spawn: large chunks (still under Windows' ~32K
        // argument limit) and a single axe width keep the run fast.
        const source = new EvalSource(chunkedEval(rawEval, { limit: 24_000 }), {
            setViewport: async (w, h) => void (await ab('set', 'viewport', String(w), String(h))),
            open: async (url) => void (await ab('open', url)),
        });

        const report = await analyze({
            source,
            url: FIXTURE,
            selectors: ['main', 'h1', '.card', 'button'],
            widths: [320, 1280],
            a11y: { widths: [1280] },
        });

        // The 480px card must overflow the 320px viewport — the oracle sees it.
        expect(report.violations.some((v) => v.rule === 'noOverflow' && v.width === 320)).toBe(true);
        expect(report.pass).toBe(false);
        // axe was chunk-injected through the CLI's argument-length limit.
        expect(report.sources.a11y).toBe('axe');
        expect(report.scores?.average.overall).toBeGreaterThan(0);
        expect(report.widths).toEqual([320, 1280]);
    }, 180_000);

    it('without a viewport setter the source refuses to mis-report widths', async () => {
        const source = new EvalSource(rawEval);
        await source.setViewport(1280, 900).catch(() => {}); // live width unknown here…
        const live = await source.currentWidth();
        await expect(source.setViewport(live + 100, 900)).rejects.toThrow(/live viewport/);
    }, 60_000);
});

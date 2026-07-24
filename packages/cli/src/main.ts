/**
 * rjs — the r$ command line. Exit codes: 0 pass, 1 violations, 2 usage/run error.
 * All effects flow through CliIo so commands are testable with fakes.
 */

import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolveDriver, type DriverChoice, type ResolvedDriver } from './drivers.js';
import { runAnalyze } from './commands/analyze.js';
import { runVerify } from './commands/verify.js';
import { runRecord } from './commands/record.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runAudit } from './commands/audit.js';
import { runSnippet } from './commands/snippet.js';

export interface CliIo {
    stdout(text: string): void;
    stderr(text: string): void;
    readFile(path: string): Promise<string>;
    writeFile(path: string, text: string): Promise<void>;
    writeFileBytes(path: string, bytes: Uint8Array): Promise<void>;
    resolveDriver(choice: DriverChoice, opts: { headed?: boolean }): Promise<ResolvedDriver>;
}

export function defaultIo(): CliIo {
    return {
        stdout: (text) => console.log(text),
        stderr: (text) => console.error(text),
        readFile: (path) => readFile(path, 'utf8'),
        writeFile: (path, text) => writeFile(path, text, 'utf8'),
        writeFileBytes: (path, bytes) => writeFile(path, bytes),
        resolveDriver,
    };
}

const HELP = `r$ · rjs — the responsive design tool

Usage: rjs <command> [args] [options]

Commands:
  analyze <url>              Sweep the page and run the full oracle
                             (constraints + aesthetic score + a11y)
  audit <url>                One-shot HTML report with screenshots
                             (--crawl same-origin pages, --vs competitor)
  verify <contract> <url>    Execute a design contract against a live page
  record <contract> <url>    Measure and pin baseline curves into the contract
  init <url>                 Generate a contract from the page's r$ constructs
  snippet                    Emit the injectable browser bundle
                             (<script> block, or --bookmarklet URL)
  doctor                     Check drivers and environment readiness

Options:
  -d, --driver <name>        auto | playwright | agent-browser     [auto]
  -w, --widths <list>        Comma-separated widths, e.g. 320,768,1280
  -s, --selectors <list>     Comma-separated selectors (analyze)
  -f, --format <fmt>         console | json | sarif                [console]
  -o, --out <file>           Write the report (or recorded contract) to a file
      --height <px>          Viewport height                       [900]
      --touch-min <px>       Touch-target minimum (analyze)        [24 = WCAG AA; 44/48 = platform]
      --scroll               Scroll-sweep below-the-fold content
      --no-a11y              Skip axe (analyze)
      --strict               Fail on warnings too (analyze)
      --headed               Show the browser window (playwright)
      --vs <url>             Audit a second site side by side (audit)
      --crawl                Follow same-origin links (audit)
      --max-pages <n>        Crawl limit                           [5]
      --screenshots <dir>    Also write the per-width PNGs to a directory (audit)
      --bookmarklet          Emit a javascript: URL instead of a <script> block (snippet)
  -h, --help                 Show this help
  -v, --version              Show version

Examples:
  rjs analyze https://example.com -w 320,768,1280
  rjs verify home.contract.json https://example.com -f json -o report.json
  rjs record home.contract.json https://example.com`;

const OPTIONS = {
    driver: { type: 'string', short: 'd', default: 'auto' },
    widths: { type: 'string', short: 'w' },
    selectors: { type: 'string', short: 's' },
    format: { type: 'string', short: 'f', default: 'console' },
    out: { type: 'string', short: 'o' },
    height: { type: 'string' },
    'touch-min': { type: 'string' },
    scroll: { type: 'boolean', default: false },
    'no-a11y': { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    vs: { type: 'string' },
    crawl: { type: 'boolean', default: false },
    'max-pages': { type: 'string' },
    screenshots: { type: 'string' },
    bookmarklet: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
} as const;

export interface SharedOptions {
    driver: DriverChoice;
    widths?: number[];
    selectors?: string[];
    format: 'console' | 'json' | 'sarif';
    out?: string;
    height?: number;
    touchMin?: number;
    scroll: boolean;
    a11y: boolean;
    strict: boolean;
    headed: boolean;
    vs?: string;
    crawl: boolean;
    maxPages?: number;
    screenshotsDir?: string;
}

export async function main(argv: string[], io: CliIo = defaultIo()): Promise<number> {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    } catch (e) {
        io.stderr(`r$ ✗ ${(e as Error).message}`);
        io.stderr(`Run 'rjs --help' for usage.`);
        return 2;
    }
    const { values, positionals } = parsed;

    if (values.version) {
        io.stdout(createRequire(import.meta.url)('../package.json').version as string);
        return 0;
    }
    if (values.help || positionals.length === 0) {
        io.stdout(HELP);
        return values.help ? 0 : 2;
    }

    let shared: SharedOptions;
    try {
        shared = normalizeOptions(values);
    } catch (e) {
        io.stderr(`r$ ✗ ${(e as Error).message}`);
        return 2;
    }

    const [command, ...args] = positionals;
    try {
        switch (command) {
            case 'analyze': {
                requireArgs(args, 1, 'rjs analyze <url>');
                return await runAnalyze(args[0], shared, io);
            }
            case 'audit': {
                requireArgs(args, 1, 'rjs audit <url> [--vs <url>] [--crawl] [-o report.html]');
                return await runAudit(args[0], shared, io);
            }
            case 'verify': {
                requireArgs(args, 2, 'rjs verify <contract> <url>');
                return await runVerify(args[0], args[1], shared, io);
            }
            case 'record': {
                requireArgs(args, 2, 'rjs record <contract> <url>');
                return await runRecord(args[0], args[1], shared, io);
            }
            case 'init': {
                requireArgs(args, 1, 'rjs init <url> [-o contract.json]');
                return await runInit(args[0], shared, io);
            }
            case 'snippet':
                return await runSnippet({ ...shared, bookmarklet: values.bookmarklet as boolean }, io);
            case 'doctor':
                return await runDoctor(io);
            default:
                io.stderr(`r$ ✗ unknown command '${command}'. Commands: analyze, audit, verify, record, init, snippet, doctor.`);
                return 2;
        }
    } catch (e) {
        io.stderr(`r$ ✗ ${(e as Error).message}`);
        return 2;
    }
}

function requireArgs(args: string[], count: number, usage: string): void {
    if (args.length < count) throw new Error(`missing argument. Usage: ${usage}`);
}

function normalizeOptions(values: Record<string, unknown>): SharedOptions {
    const driver = values.driver as string;
    if (!['auto', 'playwright', 'agent-browser'].includes(driver)) {
        throw new Error(`unknown driver '${driver}'. Drivers: auto, playwright, agent-browser.`);
    }
    const format = values.format as string;
    if (!['console', 'json', 'sarif'].includes(format)) {
        throw new Error(`unknown format '${format}'. Formats: console, json, sarif.`);
    }
    return {
        driver: driver as DriverChoice,
        widths: values.widths ? parseNumberList(values.widths as string, 'widths') : undefined,
        selectors: values.selectors ? (values.selectors as string).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        format: format as SharedOptions['format'],
        out: values.out as string | undefined,
        height: values.height ? parseNumber(values.height as string, 'height') : undefined,
        touchMin: values['touch-min'] ? parseNumber(values['touch-min'] as string, 'touch-min') : undefined,
        scroll: values.scroll as boolean,
        a11y: !(values['no-a11y'] as boolean),
        strict: values.strict as boolean,
        headed: values.headed as boolean,
        vs: values.vs as string | undefined,
        crawl: values.crawl as boolean,
        maxPages: values['max-pages'] ? parseNumber(values['max-pages'] as string, 'max-pages') : undefined,
        screenshotsDir: values.screenshots as string | undefined,
    };
}

function parseNumberList(input: string, name: string): number[] {
    const numbers = input.split(',').map((part) => Number(part.trim()));
    if (numbers.length === 0 || numbers.some((n) => !Number.isFinite(n) || n <= 0)) {
        throw new Error(`--${name} expects positive numbers, got '${input}'`);
    }
    return numbers;
}

function parseNumber(input: string, name: string): number {
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} expects a positive number, got '${input}'`);
    return n;
}

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

export interface CliIo {
    stdout(text: string): void;
    stderr(text: string): void;
    readFile(path: string): Promise<string>;
    writeFile(path: string, text: string): Promise<void>;
    resolveDriver(choice: DriverChoice, opts: { headed?: boolean }): Promise<ResolvedDriver>;
}

export function defaultIo(): CliIo {
    return {
        stdout: (text) => console.log(text),
        stderr: (text) => console.error(text),
        readFile: (path) => readFile(path, 'utf8'),
        writeFile: (path, text) => writeFile(path, text, 'utf8'),
        resolveDriver,
    };
}

const HELP = `r$ · rjs — the responsive design tool

Usage: rjs <command> [args] [options]

Commands:
  analyze <url>              Sweep the page and run the full oracle
                             (constraints + aesthetic score + a11y)
  verify <contract> <url>    Execute a design contract against a live page
  record <contract> <url>    Measure and pin baseline curves into the contract
  init <url>                 Generate a contract from the page's r$ constructs
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
            case 'doctor':
                return await runDoctor(io);
            default:
                io.stderr(`r$ ✗ unknown command '${command}'. Commands: analyze, verify, record, init, doctor.`);
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

/**
 * rjs doctor — is this machine ready to measure?
 * Probes node + both drivers, prints one line per check with the exact
 * install command for anything missing. Exit 0 = at least one driver is
 * usable; 1 = none is.
 */

import { existsSync } from 'node:fs';
import { findAgentBrowser } from '../drivers.js';
import type { CliIo } from '../main.js';

export interface DoctorProbes {
    nodeVersion(): string;
    /** null = not installed; { chromiumPath } with null path = installed but no browser. */
    playwright(): Promise<{ chromiumPath: string | null } | null>;
    agentBrowser(): string | null;
}

const REQUIRED_NODE = [20, 19] as const;

export const defaultProbes: DoctorProbes = {
    nodeVersion: () => process.versions.node,
    playwright: async () => {
        for (const name of ['playwright', '@playwright/test']) {
            try {
                const { chromium } = await import(name);
                let chromiumPath: string | null = null;
                try {
                    const p = chromium.executablePath() as string;
                    if (p && existsSync(p)) chromiumPath = p;
                } catch {
                    // no browser downloaded yet
                }
                return { chromiumPath };
            } catch {
                // try the next package
            }
        }
        return null;
    },
    agentBrowser: findAgentBrowser,
};

function nodeOk(version: string): boolean {
    const [major = 0, minor = 0] = version.split('.').map(Number);
    return major > REQUIRED_NODE[0] || (major === REQUIRED_NODE[0] && minor >= REQUIRED_NODE[1]);
}

export async function runDoctor(io: CliIo, probes: DoctorProbes = defaultProbes): Promise<number> {
    const lines: string[] = ['r$ doctor'];

    const node = probes.nodeVersion();
    lines.push(
        nodeOk(node)
            ? `  ✓ node ${node}`
            : `  ✗ node ${node} — ${REQUIRED_NODE.join('.')}+ required`,
    );

    const pw = await probes.playwright();
    const pwReady = pw !== null && pw.chromiumPath !== null;
    if (pwReady) {
        lines.push('  ✓ playwright — chromium installed');
    } else if (pw) {
        lines.push('  ~ playwright installed, but no chromium browser');
        lines.push('      npx playwright install chromium');
    } else {
        lines.push('  ✗ playwright not installed (CI driver)');
        lines.push('      npm i -D playwright && npx playwright install chromium');
    }

    const ab = probes.agentBrowser();
    if (ab) {
        lines.push(`  ✓ agent-browser — ${ab}`);
    } else {
        lines.push('  ✗ agent-browser not found (zero-setup driver: audit any URL with nothing in the project)');
        lines.push('      npm i -g agent-browser && agent-browser install');
    }

    const auto = pwReady ? 'playwright' : ab ? 'agent-browser' : null;
    lines.push('');
    lines.push(
        auto
            ? `  → ready: -d auto will use ${auto}`
            : '  → NOT ready: no driver available — install one of the above',
    );

    io.stdout(lines.join('\n'));
    return auto ? 0 : 1;
}

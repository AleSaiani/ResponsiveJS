import { describe, it, expect } from 'vitest';
import { runDoctor, type DoctorProbes } from '../src/commands/doctor.js';
import type { CliIo } from '../src/main.js';

function makeIo() {
    const out: string[] = [];
    const io: CliIo = {
        stdout: (t) => out.push(t),
        stderr: () => {},
        readFile: async () => '',
        writeFile: async () => {},
        writeFileBytes: async () => {},
        resolveDriver: async () => {
            throw new Error('unused');
        },
    };
    return { io, out };
}

function probes(overrides: Partial<DoctorProbes>): DoctorProbes {
    return {
        nodeVersion: () => '22.1.0',
        playwright: async () => null,
        agentBrowser: () => null,
        ...overrides,
    };
}

describe('rjs doctor', () => {
    it('everything present → all checks green, exit 0, auto=playwright', async () => {
        const { io, out } = makeIo();
        const code = await runDoctor(
            io,
            probes({
                playwright: async () => ({ chromiumPath: '/browsers/chromium' }),
                agentBrowser: () => '/bin/agent-browser',
            }),
        );
        expect(code).toBe(0);
        const text = out.join('\n');
        expect(text).toContain('✓ node 22.1.0');
        expect(text).toContain('✓ playwright — chromium installed');
        expect(text).toContain('✓ agent-browser');
        expect(text).toContain('-d auto will use playwright');
    });

    it('playwright installed without browsers → guidance + agent-browser fallback', async () => {
        const { io, out } = makeIo();
        const code = await runDoctor(
            io,
            probes({
                playwright: async () => ({ chromiumPath: null }),
                agentBrowser: () => '/bin/agent-browser',
            }),
        );
        expect(code).toBe(0); // agent-browser still makes the machine usable
        const text = out.join('\n');
        expect(text).toContain('~ playwright installed, but no chromium browser');
        expect(text).toContain('npx playwright install chromium');
        expect(text).toContain('-d auto will use agent-browser');
    });

    it('nothing installed → exact install commands, exit 1', async () => {
        const { io, out } = makeIo();
        const code = await runDoctor(io, probes({}));
        expect(code).toBe(1);
        const text = out.join('\n');
        expect(text).toContain('npm i -D playwright && npx playwright install chromium');
        expect(text).toContain('npm i -g agent-browser && agent-browser install');
        expect(text).toContain('NOT ready');
    });

    it('old node is flagged', async () => {
        const { io, out } = makeIo();
        await runDoctor(io, probes({ nodeVersion: () => '18.20.0' }));
        expect(out.join('\n')).toContain('✗ node 18.20.0 — 20.19+ required');
    });
});

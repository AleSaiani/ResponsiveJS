/**
 * Shared e2e fixture: build examples/landing with vite and serve its dist
 * over local HTTP (vite marks assets crossorigin, so file:// is CORS-blocked).
 * The example doubles as the runtime's real-browser fixture — the roadmap's
 * "examples are e2e fixtures AND tutorials" made literal.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, type Server } from 'node:http';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const x = promisify(execFile);

const LANDING = join(import.meta.dirname, '..', '..', '..', 'examples', 'landing');

const MIME: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
};

export interface LandingFixture {
    url: string;
    close(): Promise<void>;
}

export async function buildLandingFixture(): Promise<LandingFixture> {
    const viteBin = join(LANDING, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(viteBin)) {
        throw new Error(`e2e fixture: vite not installed in examples/landing — run pnpm install (${viteBin})`);
    }
    await x(process.execPath, [viteBin, 'build'], { cwd: LANDING });

    const dist = join(LANDING, 'dist');
    const server: Server = createServer((req, res) => {
        const path = join(dist, req.url === '/' ? 'index.html' : (req.url ?? '/').replace(/^\//, ''));
        readFile(path)
            .then((body) => {
                res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
                res.end(body);
            })
            .catch(() => {
                res.writeHead(404);
                res.end();
            });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    return {
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    };
}

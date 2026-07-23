// Republish all workspace packages to the local Verdaccio registry.
// Verdaccio refuses to overwrite an existing version, so each package is
// unpublished first — acceptable only because this registry is throwaway.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REGISTRY = 'http://localhost:4873';
const packagesDir = join(import.meta.dirname, '..', 'packages');

for (const entry of readdirSync(packagesDir)) {
    const dir = join(packagesDir, entry);
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const { name, version } = JSON.parse(readFileSync(manifestPath, 'utf8'));

    try {
        execSync(`npm unpublish ${name}@${version} --force --registry ${REGISTRY}`, { stdio: 'ignore' });
    } catch {
        // not published yet — fine
    }
    execSync(`pnpm publish --registry ${REGISTRY} --no-git-checks`, { cwd: dir, stdio: 'inherit' });
    console.log(`published ${name}@${version} → ${REGISTRY}`);
}

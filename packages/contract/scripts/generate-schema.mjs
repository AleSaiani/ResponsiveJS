// Regenerate the committed JSON Schema artifact from the registry.
// Run `pnpm --filter @responsivejs/contract build` first.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { buildJsonSchema } = await import(pathToFileURL(join(here, '..', 'dist', 'schema.js')).href);

const outDir = join(here, '..', 'schema');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'design-contract.v1.json');
writeFileSync(outFile, JSON.stringify(buildJsonSchema(), null, 2) + '\n');
console.log(`schema written → ${outFile}`);

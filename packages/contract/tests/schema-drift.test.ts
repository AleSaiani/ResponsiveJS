import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJsonSchema } from '../src/schema.js';
import { CONSTRAINT_NAMES } from '../src/registry.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('JSON Schema', () => {
    it('the committed artifact matches the registry-generated schema (no drift)', () => {
        const committed = JSON.parse(readFileSync(join(here, '..', 'schema', 'design-contract.v1.json'), 'utf8'));
        expect(committed).toEqual(buildJsonSchema());
    });

    it('every registry constraint appears as a oneOf branch', () => {
        const schema = buildJsonSchema() as {
            properties: { rules: { items: { oneOf: { properties: { assert: { const: string } } }[] } } };
        };
        const branchNames = schema.properties.rules.items.oneOf.map((b) => b.properties.assert.const);
        expect(branchNames.sort()).toEqual([...CONSTRAINT_NAMES].sort());
    });

    it('constraints without required args do not require args', () => {
        const schema = buildJsonSchema() as {
            properties: { rules: { items: { oneOf: { properties: { assert: { const: string } }; required: string[] }[] } } };
        };
        const noOverflow = schema.properties.rules.items.oneOf.find((b) => b.properties.assert.const === 'noOverflow')!;
        expect(noOverflow.required).toEqual(['assert']);
        const contains = schema.properties.rules.items.oneOf.find((b) => b.properties.assert.const === 'contains')!;
        expect(contains.required).toEqual(['assert', 'args']);
    });
});

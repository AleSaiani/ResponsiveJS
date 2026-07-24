/**
 * JSON Schema (draft 2020-12) generated FROM the registry — validator and
 * schema cannot diverge by construction. The committed artifact under
 * schema/ is drift-tested against this builder.
 */

import { CONSTRAINT_REGISTRY, type ParamSpec } from './registry.js';

const SCHEMA_ID =
    'https://raw.githubusercontent.com/AleSaiani/ResponsiveJS/main/packages/contract/schema/design-contract.v1.json';

function paramToSchema(spec: ParamSpec): Record<string, unknown> {
    switch (spec.type) {
        case 'selector':
        case 'string':
            return { type: 'string', ...(spec.doc ? { description: spec.doc } : {}) };
        case 'number':
            return { type: 'number', ...(spec.doc ? { description: spec.doc } : {}) };
        case 'enum':
            return { enum: spec.enum };
        case 'selectorArray':
            return { type: 'array', items: { type: 'string' }, minItems: 1 };
        case 'numberArray':
            return { type: 'array', items: { type: 'number' }, minItems: 1 };
        case 'object': {
            const properties: Record<string, unknown> = {};
            const required: string[] = [];
            for (const [field, fieldSpec] of Object.entries(spec.shape ?? {})) {
                properties[field] = { type: 'number' };
                if (fieldSpec.required) required.push(field);
            }
            return {
                type: 'object',
                properties,
                ...(required.length > 0 ? { required } : {}),
                additionalProperties: false,
            };
        }
    }
}

const widthRange = {
    type: 'object',
    properties: { min: { type: 'number' }, max: { type: 'number' } },
    additionalProperties: false,
};

const severity = { enum: ['error', 'warning', 'info'] };

export function buildJsonSchema(): Record<string, unknown> {
    const ruleBranches = Object.entries(CONSTRAINT_REGISTRY).map(([name, spec]) => {
        const argProperties: Record<string, unknown> = {};
        const argRequired: string[] = [];
        for (const [param, paramSpec] of Object.entries(spec.params)) {
            argProperties[param] = paramToSchema(paramSpec);
            if (paramSpec.required) argRequired.push(param);
        }
        const argsSchema = {
            type: 'object',
            properties: argProperties,
            ...(argRequired.length > 0 ? { required: argRequired } : {}),
            additionalProperties: false,
        };
        return {
            type: 'object',
            description: spec.doc,
            properties: {
                id: { type: 'string', minLength: 1 },
                assert: { const: name },
                args: argsSchema,
                when: widthRange,
                severity,
                description: { type: 'string' },
            },
            required: argRequired.length > 0 ? ['assert', 'args'] : ['assert'],
            additionalProperties: false,
        };
    });

    const metricNames = [
        'balance', 'equilibrium', 'symmetry', 'proportion', 'rhythm', 'density', 'regularity',
        'simplicity', 'unity', 'homogeneity', 'sequence', 'cohesion', 'economy', 'colorHarmony',
        'typographyHarmony', 'birkhoff', 'overall',
    ];

    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: SCHEMA_ID,
        title: 'ResponsiveJS Design Contract v1',
        type: 'object',
        properties: {
            $schema: { type: 'string' },
            version: { const: 1 },
            name: { type: 'string' },
            description: { type: 'string' },
            viewport: {
                type: 'object',
                properties: {
                    widths: { type: 'array', items: { type: 'number' } },
                    from: { type: 'number' },
                    to: { type: 'number' },
                    step: { type: 'number' },
                    height: { type: 'number' },
                },
                additionalProperties: false,
            },
            selectors: { type: 'object', additionalProperties: { type: 'string' } },
            designSystem: {
                type: 'object',
                properties: {
                    profile: { anyOf: [{ type: 'string' }, { type: 'object' }] },
                    selectors: { type: 'object' },
                },
                required: ['profile'],
                additionalProperties: false,
            },
            rules: { type: 'array', items: { oneOf: ruleBranches } },
            score: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        scope: { type: 'string' },
                        min: { type: 'number', minimum: 0, maximum: 1 },
                        metrics: {
                            type: 'object',
                            propertyNames: { enum: metricNames },
                            additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
                        },
                        when: widthRange,
                    },
                    additionalProperties: false,
                },
            },
            baselines: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        selector: { type: 'string' },
                        prop: { enum: ['width', 'height', 'x', 'y', 'fontSize'] },
                        curve: {
                            type: 'array',
                            items: { type: 'array', prefixItems: [{ type: 'number' }, { type: 'number' }], minItems: 2, maxItems: 2 },
                        },
                        tolerance: {
                            type: 'object',
                            properties: { px: { type: 'number' }, percent: { type: 'number' } },
                            additionalProperties: false,
                        },
                    },
                    required: ['selector', 'prop'],
                    additionalProperties: false,
                },
            },
        },
        required: ['version', 'rules'],
        additionalProperties: false,
    };
}

/**
 * Zero-dependency, registry-driven contract validator. Errors carry a JSON
 * path, a message, and — where possible — a did-you-mean suggestion, because
 * "helpful errors" is a tested requirement, not a hope.
 */

import { CONSTRAINT_REGISTRY, CONSTRAINT_NAMES, isConstraintName, type ParamSpec } from './registry.js';
import type { DesignContract } from './types.js';

export interface ContractIssue {
    path: string;
    message: string;
    suggestion?: string;
}

const TOP_LEVEL_FIELDS = new Set([
    '$schema',
    'version',
    'name',
    'description',
    'viewport',
    'container',
    'selectors',
    'designSystem',
    'rules',
    'score',
    'baselines',
]);

const RULE_FIELDS = new Set(['id', 'assert', 'args', 'when', 'severity', 'description']);
const SEVERITIES = new Set(['error', 'warning', 'info']);
const BASELINE_PROPS = new Set(['width', 'height', 'x', 'y', 'fontSize']);

// ─── did-you-mean ───────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
    }
    return dp[a.length][b.length];
}

function didYouMean(input: string, candidates: readonly string[]): string | undefined {
    let best: string | undefined;
    let bestDist = Infinity;
    for (const c of candidates) {
        const d = levenshtein(input.toLowerCase(), c.toLowerCase());
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return bestDist <= Math.max(2, Math.floor(input.length / 3)) ? `did you mean '${best}'?` : undefined;
}

// ─── validation ─────────────────────────────────────────────────────────

function checkRange(range: unknown, path: string, issues: ContractIssue[]): void {
    if (typeof range !== 'object' || range === null) {
        issues.push({ path, message: 'when must be an object { min?, max? }' });
        return;
    }
    const r = range as { min?: unknown; max?: unknown };
    for (const key of Object.keys(r)) {
        if (key !== 'min' && key !== 'max') issues.push({ path: `${path}.${key}`, message: `unknown field '${key}'` });
    }
    if (r.min !== undefined && typeof r.min !== 'number') issues.push({ path: `${path}.min`, message: 'min must be a number' });
    if (r.max !== undefined && typeof r.max !== 'number') issues.push({ path: `${path}.max`, message: 'max must be a number' });
    if (typeof r.min === 'number' && typeof r.max === 'number' && r.min > r.max) {
        issues.push({ path, message: `min (${r.min}) > max (${r.max})` });
    }
}

function checkParam(
    value: unknown,
    spec: ParamSpec,
    path: string,
    aliases: Set<string>,
    issues: ContractIssue[],
): void {
    switch (spec.type) {
        case 'selector':
        case 'string':
            if (typeof value !== 'string') {
                issues.push({ path, message: `expected a string, got ${typeof value}` });
            } else if (spec.type === 'selector' && value.startsWith('$') && !aliases.has(value.slice(1))) {
                issues.push({
                    path,
                    message: `unresolved alias '${value}'`,
                    suggestion:
                        aliases.size > 0
                            ? `known aliases: ${[...aliases].map((a) => '$' + a).join(', ')}`
                            : 'define it under top-level `selectors`',
                });
            }
            break;
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                issues.push({ path, message: `expected a finite number, got ${JSON.stringify(value)}` });
            }
            break;
        case 'enum':
            if (typeof value !== 'string' || !spec.enum!.includes(value)) {
                issues.push({
                    path,
                    message: `expected one of ${spec.enum!.join(' | ')}, got ${JSON.stringify(value)}`,
                    suggestion: typeof value === 'string' ? didYouMean(value, spec.enum!) : undefined,
                });
            }
            break;
        case 'selectorArray':
            if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
                issues.push({ path, message: 'expected an array of selectors' });
            } else {
                value.forEach((v: string, i: number) => {
                    if (v.startsWith('$') && !aliases.has(v.slice(1))) {
                        issues.push({ path: `${path}[${i}]`, message: `unresolved alias '${v}'` });
                    }
                });
            }
            break;
        case 'numberArray':
            if (!Array.isArray(value) || value.some((v) => typeof v !== 'number')) {
                issues.push({ path, message: 'expected an array of numbers' });
            }
            break;
        case 'object': {
            if (typeof value !== 'object' || value === null) {
                issues.push({ path, message: 'expected an object' });
                break;
            }
            const obj = value as Record<string, unknown>;
            for (const [field, fieldSpec] of Object.entries(spec.shape ?? {})) {
                if (fieldSpec.required && obj[field] === undefined) {
                    issues.push({ path: `${path}.${field}`, message: 'required field missing' });
                } else if (obj[field] !== undefined && typeof obj[field] !== 'number') {
                    issues.push({ path: `${path}.${field}`, message: 'must be a number' });
                }
            }
            for (const field of Object.keys(obj)) {
                if (!(field in (spec.shape ?? {}))) {
                    issues.push({
                        path: `${path}.${field}`,
                        message: `unknown field '${field}'`,
                        suggestion: didYouMean(field, Object.keys(spec.shape ?? {})),
                    });
                }
            }
            break;
        }
    }
}

function checkRule(rule: unknown, index: number, aliases: Set<string>, seenIds: Set<string>, issues: ContractIssue[]): void {
    const path = `rules[${index}]`;
    if (typeof rule !== 'object' || rule === null) {
        issues.push({ path, message: 'rule must be an object' });
        return;
    }
    const r = rule as Record<string, unknown>;

    for (const key of Object.keys(r)) {
        if (!RULE_FIELDS.has(key)) {
            issues.push({ path: `${path}.${key}`, message: `unknown field '${key}'`, suggestion: didYouMean(key, [...RULE_FIELDS]) });
        }
    }

    if (typeof r.assert !== 'string') {
        issues.push({ path: `${path}.assert`, message: 'assert is required and must be a constraint name' });
        return;
    }
    if (!isConstraintName(r.assert)) {
        issues.push({
            path: `${path}.assert`,
            message: `unknown constraint '${r.assert}'`,
            suggestion: didYouMean(r.assert, CONSTRAINT_NAMES),
        });
        return;
    }

    if (r.id !== undefined) {
        if (typeof r.id !== 'string' || r.id === '') {
            issues.push({ path: `${path}.id`, message: 'id must be a non-empty string' });
        } else if (seenIds.has(r.id)) {
            issues.push({ path: `${path}.id`, message: `duplicate rule id '${r.id}'` });
        } else {
            seenIds.add(r.id);
        }
    }

    if (r.severity !== undefined && !SEVERITIES.has(r.severity as string)) {
        issues.push({ path: `${path}.severity`, message: `severity must be error | warning | info` });
    }
    if (r.when !== undefined) checkRange(r.when, `${path}.when`, issues);

    const spec = CONSTRAINT_REGISTRY[r.assert];
    const args = (r.args ?? {}) as Record<string, unknown>;
    if (typeof args !== 'object' || Array.isArray(args)) {
        issues.push({ path: `${path}.args`, message: 'args must be a named object (not an array)' });
        return;
    }
    for (const [name, paramSpec] of Object.entries(spec.params)) {
        if (paramSpec.required && args[name] === undefined) {
            issues.push({ path: `${path}.args.${name}`, message: `required arg missing (${paramSpec.doc ?? paramSpec.type})` });
        } else if (args[name] !== undefined) {
            checkParam(args[name], paramSpec, `${path}.args.${name}`, aliases, issues);
        }
    }
    for (const name of Object.keys(args)) {
        if (!(name in spec.params)) {
            issues.push({
                path: `${path}.args.${name}`,
                message: `unknown arg '${name}' for ${r.assert}`,
                suggestion: didYouMean(name, Object.keys(spec.params)),
            });
        }
    }
}

export function validateContract(
    input: unknown,
): { contract: DesignContract; issues: [] } | { contract: null; issues: ContractIssue[] } {
    const issues: ContractIssue[] = [];

    if (typeof input !== 'object' || input === null) {
        return { contract: null, issues: [{ path: '', message: 'contract must be an object' }] };
    }
    const c = input as Record<string, unknown>;

    for (const key of Object.keys(c)) {
        if (!TOP_LEVEL_FIELDS.has(key)) {
            issues.push({ path: key, message: `unknown field '${key}'`, suggestion: didYouMean(key, [...TOP_LEVEL_FIELDS]) });
        }
    }

    if (c.version !== 1) {
        issues.push({
            path: 'version',
            message: `unsupported version ${JSON.stringify(c.version)} — this loader understands version 1`,
            suggestion: 'upgrade @responsivejs/contract if the contract is newer',
        });
    }

    const aliases = new Set<string>(Object.keys((c.selectors as Record<string, string>) ?? {}));

    if (!Array.isArray(c.rules)) {
        issues.push({ path: 'rules', message: 'rules must be an array' });
    } else {
        const seenIds = new Set<string>();
        c.rules.forEach((rule, i) => checkRule(rule, i, aliases, seenIds, issues));
    }

    if (c.score !== undefined && !Array.isArray(c.score)) {
        issues.push({ path: 'score', message: 'score must be an array of requirements' });
    }
    if (Array.isArray(c.score)) {
        c.score.forEach((req, i) => {
            const r = req as Record<string, unknown>;
            if (r.when !== undefined) checkRange(r.when, `score[${i}].when`, issues);
            if (r.min !== undefined && typeof r.min !== 'number') {
                issues.push({ path: `score[${i}].min`, message: 'min must be a number 0..1' });
            }
        });
    }

    if (c.baselines !== undefined && !Array.isArray(c.baselines)) {
        issues.push({ path: 'baselines', message: 'baselines must be an array' });
    }
    if (Array.isArray(c.baselines)) {
        c.baselines.forEach((b, i) => {
            const bl = b as Record<string, unknown>;
            if (typeof bl.selector !== 'string') issues.push({ path: `baselines[${i}].selector`, message: 'selector required' });
            if (!BASELINE_PROPS.has(bl.prop as string)) {
                issues.push({
                    path: `baselines[${i}].prop`,
                    message: `prop must be one of ${[...BASELINE_PROPS].join(' | ')}`,
                    suggestion: typeof bl.prop === 'string' ? didYouMean(bl.prop, [...BASELINE_PROPS]) : undefined,
                });
            }
        });
    }

    if (issues.length > 0) return { contract: null, issues };
    return { contract: c as unknown as DesignContract, issues: [] };
}

export class ContractValidationError extends Error {
    constructor(readonly issues: ContractIssue[]) {
        super(
            'Invalid design contract:\n' +
                issues.map((i) => `  ${i.path || '<root>'}: ${i.message}${i.suggestion ? ` (${i.suggestion})` : ''}`).join('\n'),
        );
        this.name = 'ContractValidationError';
    }
}

/** Parse and validate; throws ContractValidationError with formatted issues. */
export function parseContract(json: string | object): DesignContract {
    const input = typeof json === 'string' ? (JSON.parse(json) as object) : json;
    const result = validateContract(input);
    if (result.contract === null) throw new ContractValidationError(result.issues);
    return result.contract;
}

/** Resolve "$alias" strings in rule args against the contract's selector map. */
export function resolveAliases(contract: DesignContract): DesignContract {
    const map = contract.selectors ?? {};
    const resolve = (v: unknown): unknown => {
        if (typeof v === 'string' && v.startsWith('$')) return map[v.slice(1)] ?? v;
        if (Array.isArray(v)) return v.map(resolve);
        return v;
    };
    return {
        ...contract,
        rules: contract.rules.map((r) => ({
            ...r,
            args: r.args
                ? Object.fromEntries(Object.entries(r.args).map(([k, v]) => [k, resolve(v)]))
                : r.args,
        })),
        score: contract.score?.map((s) => ({ ...s, scope: resolve(s.scope) as string | undefined })),
        baselines: contract.baselines?.map((b) => ({ ...b, selector: resolve(b.selector) as string })),
    };
}

/**
 * Fluent authoring API. Builds a plain, validated DesignContract that
 * round-trips through JSON (`parseContract(builder.toJSON())` is identity).
 */

import type {
    DesignContract,
    ContractRule,
    ScoreRequirement,
    BaselineSpec,
    WidthRange,
    Severity,
    DesignSystemConfigJson,
    ValidationSelectorsJson,
} from './types.js';
import type { ConstraintName } from './registry.js';
import { parseContract } from './loader.js';

export interface AssertOptions {
    id?: string;
    severity?: Severity;
    description?: string;
}

export class ContractBuilder {
    private readonly draft: DesignContract;
    private currentRange: WidthRange | undefined;

    constructor(name?: string) {
        this.draft = { version: 1, ...(name ? { name } : {}), rules: [] };
    }

    viewport(v: NonNullable<DesignContract['viewport']>): this {
        this.draft.viewport = v;
        return this;
    }

    /** Register a "$alias" for a selector. */
    select(alias: string, selector: string): this {
        (this.draft.selectors ??= {})[alias] = selector;
        return this;
    }

    /** Embed a design-system profile (bundled name or inline config). */
    use(profile: string | DesignSystemConfigJson, selectors?: ValidationSelectorsJson): this {
        this.draft.designSystem = { profile, ...(selectors ? { selectors } : {}) };
        return this;
    }

    // ─── range scoping (describe-block style) ───────────────────────────

    /** Scope subsequent assert() calls: '*' for all widths, or a range. */
    at(range: '*' | WidthRange): this {
        this.currentRange = range === '*' ? undefined : range;
        return this;
    }

    /** Widths strictly below px. */
    below(px: number): this {
        return this.at({ max: px - 1 });
    }

    /** Widths up to and including px. */
    upTo(px: number): this {
        return this.at({ max: px });
    }

    /** Widths at and above px. */
    from(px: number): this {
        return this.at({ min: px });
    }

    between(min: number, max: number): this {
        return this.at({ min, max });
    }

    // ─── content ────────────────────────────────────────────────────────

    assert(name: ConstraintName, args?: Record<string, unknown>, opts: AssertOptions = {}): this {
        const rule: ContractRule = {
            assert: name,
            ...(args && Object.keys(args).length > 0 ? { args } : {}),
            ...(this.currentRange ? { when: this.currentRange } : {}),
            ...(opts.id ? { id: opts.id } : {}),
            ...(opts.severity ? { severity: opts.severity } : {}),
            ...(opts.description ? { description: opts.description } : {}),
        };
        this.draft.rules.push(rule);
        return this;
    }

    score(req: ScoreRequirement): this {
        (this.draft.score ??= []).push(this.currentRange && !req.when ? { ...req, when: this.currentRange } : req);
        return this;
    }

    baseline(selector: string, prop: BaselineSpec['prop'], tolerance?: BaselineSpec['tolerance']): this {
        (this.draft.baselines ??= []).push({ selector, prop, ...(tolerance ? { tolerance } : {}) });
        return this;
    }

    // ─── output ─────────────────────────────────────────────────────────

    /** Validate and return the plain contract (throws ContractValidationError). */
    build(): DesignContract {
        // Derive stable ids for rules that lack one.
        const withIds: DesignContract = {
            ...this.draft,
            rules: this.draft.rules.map((r, i) => (r.id ? r : { ...r, id: `rule-${i + 1}-${r.assert}` })),
        };
        return parseContract(JSON.parse(JSON.stringify(withIds)) as object);
    }

    toJSON(): string {
        return JSON.stringify(this.build(), null, 2);
    }
}

export function contract(name?: string): ContractBuilder {
    return new ContractBuilder(name);
}

/**
 * The design-contract data model. version: 1. JSON is the canonical
 * serialization; every field here must survive JSON round-trips.
 */

import type { Violation } from '@responsivejs/core/types';
import type { ConstraintName } from './registry.js';

/** Inclusive width range in px. Omitted bound = unbounded. */
export interface WidthRange {
    min?: number;
    max?: number;
}

export type Severity = 'error' | 'warning' | 'info';

/** The 17 aesthetic metric names (mirrors AestheticScore in core). */
export type AestheticMetricName =
    | 'balance'
    | 'equilibrium'
    | 'symmetry'
    | 'proportion'
    | 'rhythm'
    | 'density'
    | 'regularity'
    | 'simplicity'
    | 'unity'
    | 'homogeneity'
    | 'sequence'
    | 'cohesion'
    | 'economy'
    | 'colorHarmony'
    | 'typographyHarmony'
    | 'birkhoff'
    | 'overall';

export interface ContractRule {
    /** Stable id referenced by violations. Derived (`rule-<n>-<assert>`) when absent. */
    id?: string;
    assert: ConstraintName;
    /** Named args, validated per-constraint by the registry. "$alias" strings resolve via `selectors`. */
    args?: Record<string, unknown>;
    /** Width scope; default: every measured width. */
    when?: WidthRange;
    /** Overrides the constraint's emitted severity. */
    severity?: Severity;
    /** Authored intent — surfaced to agents in reports. */
    description?: string;
}

export interface ScoreRequirement {
    /** Selector → subtree score; absent → whole page. */
    scope?: string;
    /** Overall threshold 0..1. */
    min?: number;
    /** Per-metric thresholds. */
    metrics?: Partial<Record<AestheticMetricName, number>>;
    /** Check per-width scores in range; absent → the average. */
    when?: WidthRange;
}

export interface BaselineSpec {
    selector: string;
    prop: 'width' | 'height' | 'x' | 'y' | 'fontSize';
    /** Recorded control points; absent until recordBaseline() fills it. */
    curve?: [width: number, value: number][];
    /** Default { px: 2 }. */
    tolerance?: { px?: number; percent?: number };
}

/** Structural mirror of design's DesignSystemConfig — contract must not import design. */
export interface DesignSystemConfigJson {
    name?: string;
    spacing?: { tokens?: number[] };
    shape?: Record<string, { radius: number }>;
    components?: Record<string, Record<string, number | undefined>>;
    accessibility?: { touchTarget?: { min?: number }; contrast?: string };
}

export interface ValidationSelectorsJson {
    interactive?: string[];
    text?: string[];
    inputs?: string[];
    containers?: string[];
    surfaces?: string[];
    extra?: string[];
}

export interface DesignContract {
    $schema?: string;
    version: 1;
    name?: string;
    description?: string;
    /** Sweep spec used by verifyContract(page); recorded by the devtool later. */
    viewport?: { widths?: number[]; from?: number; to?: number; step?: number; height?: number };
    /** Named selector aliases; args matching "$name" exactly resolve here. */
    selectors?: Record<string, string>;
    /** Design-system expansion: bundled profile name or inline config. */
    designSystem?: { profile: string | DesignSystemConfigJson; selectors?: ValidationSelectorsJson };
    rules: ContractRule[];
    score?: ScoreRequirement[];
    baselines?: BaselineSpec[];
}

// ─── report types (agents can type reports without installing design) ───

export interface ContractViolation extends Violation {
    ruleId: string;
    ruleDescription?: string;
}

export interface RuleResult {
    ruleId: string;
    assert: string;
    when?: WidthRange;
    pass: boolean;
    /** true when no measured width fell inside `when` (reported, not failing). */
    skipped?: boolean;
    checks: number;
    violations: ContractViolation[];
}

export interface ScoreCheckResult {
    scope?: string;
    metric: AestheticMetricName;
    /** Set for per-width checks; absent for average checks. */
    width?: number;
    min: number;
    actual: number;
    pass: boolean;
}

export interface BaselineResult {
    selector: string;
    prop: string;
    pass: boolean;
    /** true when the baseline has no recorded curve yet. */
    unrecorded?: boolean;
    deviations: { width: number; expected: number; actual: number; delta: number }[];
}

export interface ContractReport {
    contract: { name?: string; version: 1 };
    pass: boolean;
    total: number;
    passed: number;
    failed: number;
    rules: RuleResult[];
    /** Flattened, every violation tagged with its ruleId — the agent surface. */
    violations: ContractViolation[];
    score?: ScoreCheckResult[];
    baselines?: BaselineResult[];
}

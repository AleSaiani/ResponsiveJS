/**
 * @responsivejs/contract — the design-contract DSL of r$.
 *
 * A contract is a declarative, serializable spec of responsive/layout/a11y/
 * aesthetic expectations: authored by hand or via the builder, validated by
 * a registry-driven loader, executed by @responsivejs/design's
 * verifyContract(), and read by agents (JSON + published schema).
 */

export type {
    DesignContract,
    ContractRule,
    ScoreRequirement,
    BaselineSpec,
    WidthRange,
    Severity,
    AestheticMetricName,
    DesignSystemConfigJson,
    ValidationSelectorsJson,
    ContractViolation,
    RuleResult,
    ScoreCheckResult,
    BaselineResult,
    ContractReport,
} from './types.js';

export {
    CONSTRAINT_REGISTRY,
    CONSTRAINT_NAMES,
    isConstraintName,
    type ConstraintName,
    type ConstraintSpec,
    type ParamSpec,
} from './registry.js';

export { inRange, describeRange } from './range.js';

export {
    validateContract,
    parseContract,
    resolveAliases,
    ContractValidationError,
    type ContractIssue,
} from './loader.js';

export { contract, ContractBuilder, type AssertOptions } from './builder.js';

export { buildJsonSchema } from './schema.js';

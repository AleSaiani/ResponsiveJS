/**
 * The constraint registry — the single source of truth shared by: the TS
 * types, the runtime validator, the generated JSON Schema, and design's
 * dispatch onto Asserter. A sync test on the design side guarantees every
 * entry is a real Asserter method and vice versa.
 */

export interface ParamSpec {
    type: 'selector' | 'string' | 'number' | 'selectorArray' | 'numberArray' | 'enum' | 'object';
    required?: boolean;
    enum?: string[];
    /** For type 'object': allowed numeric fields and whether each is required. */
    shape?: Record<string, { required?: boolean }>;
    doc?: string;
}

export interface ConstraintSpec {
    params: Record<string, ParamSpec>;
    /** Named → positional mapping onto the Asserter method. */
    argOrder: string[];
    doc: string;
}

const sel = (required = true, doc = 'CSS selector (or $alias)'): ParamSpec => ({ type: 'selector', required, doc });
const num = (required = true, doc?: string): ParamSpec => ({ type: 'number', required, doc });
const en = (values: string[], required = true): ParamSpec => ({ type: 'enum', enum: values, required });

export const CONSTRAINT_REGISTRY = {
    noOverflow: {
        params: {},
        argOrder: [],
        doc: 'No element exceeds the viewport width at any measured width.',
    },
    contains: {
        params: { parent: sel(), child: sel() },
        argOrder: ['parent', 'child'],
        doc: 'Child rects stay inside the parent rect.',
    },
    sameHeight: {
        params: { a: sel(), b: sel(), tolerance: num(false, 'px, default 2') },
        argOrder: ['a', 'b', 'tolerance'],
        doc: 'Two elements keep equal heights.',
    },
    sameLine: {
        params: { a: sel(), b: sel() },
        argOrder: ['a', 'b'],
        doc: 'Two elements share the same visual row.',
    },
    minSize: {
        params: {
            selector: sel(),
            min: { type: 'object', required: true, shape: { width: {}, height: {} }, doc: 'minimum px dimensions' },
        },
        argOrder: ['selector', 'min'],
        doc: 'Elements meet minimum dimensions.',
    },
    gapUniform: {
        params: { selector: sel(), threshold: num(false, 'cv threshold, default 0.15') },
        argOrder: ['selector', 'threshold'],
        doc: 'Spacing between children is uniform.',
    },
    monotonic: {
        params: {
            selector: sel(),
            prop: en(['fontSize', 'width', 'height']),
            direction: { ...en(['up', 'down'], false), doc: "default 'up'" },
        },
        argOrder: ['selector', 'prop', 'direction'],
        doc: 'A property never moves against the direction as width grows.',
    },
    continuous: {
        params: { selector: sel(), prop: en(['width', 'height', 'fontSize']), maxJump: num(true, 'max px jump between adjacent widths') },
        argOrder: ['selector', 'prop', 'maxJump'],
        doc: 'No sudden jumps in a property across widths.',
    },
    proportion: {
        params: {
            a: sel(),
            b: sel(),
            bounds: { type: 'object', required: true, shape: { min: { required: true }, max: { required: true } } },
        },
        argOrder: ['a', 'b', 'bounds'],
        doc: 'Width ratio a/b stays within bounds.',
    },
    childrenContained: {
        params: { selector: sel(), tolerance: num(false, 'px, default 1') },
        argOrder: ['selector', 'tolerance'],
        doc: 'Direct children stay inside their container.',
    },
    childrenEqualWidth: {
        params: { selector: sel(), tolerance: num(false, 'ratio, default 0.2') },
        argOrder: ['selector', 'tolerance'],
        doc: 'Direct children keep equal widths.',
    },
    noZeroHeight: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Elements never collapse to zero height while having width.',
    },
    touchTarget: {
        params: { selector: sel(), min: num(false, 'px, default 24 (WCAG 2.5.8 AA floor); platform guidance is 44–48') },
        argOrder: ['selector', 'min'],
        doc: 'Touch targets meet a minimum size at mobile widths (default 24×24px, WCAG 2.5.8 AA).',
    },
    textReadable: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Font size and line-height stay readable.',
    },
    contrastRatio: {
        params: { selector: sel(), level: en(['AA', 'AAA'], false) },
        argOrder: ['selector', 'level'],
        doc: 'WCAG contrast between text and background.',
    },
    borderRadiusValid: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Border radii stay consistent with element size.',
    },
    zStackOrder: {
        params: { selectors: { type: 'selectorArray', required: true } },
        argOrder: ['selectors'],
        doc: 'z-index ordering matches the given selector order.',
    },
    typographyScale: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Font sizes fit a modular scale.',
    },
    spacingTokens: {
        params: { selector: sel(), tokens: { type: 'numberArray', required: true } },
        argOrder: ['selector', 'tokens'],
        doc: 'Spacing values come from the token set.',
    },
    aspectRatio: {
        params: { selector: sel(), ratio: num(), tolerance: num(false, 'default 0.1') },
        argOrder: ['selector', 'ratio', 'tolerance'],
        doc: 'Elements keep the given aspect ratio.',
    },
    focusVisible: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Focusable elements have a visible focus affordance.',
    },
    noHiddenOverflow: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'Content is not silently clipped by overflow:hidden.',
    },
    alignedToGrid: {
        params: { selector: sel(), gridSize: num() },
        argOrder: ['selector', 'gridSize'],
        doc: 'Element positions align to a px grid.',
    },
    breakpointSafe: {
        params: { breakpoints: { type: 'numberArray', required: true } },
        argOrder: ['breakpoints'],
        doc: 'Layout holds just below and above each breakpoint.',
    },
    interactiveSpacing: {
        params: { selector: sel(), minGap: num(false, 'px, default 8') },
        argOrder: ['selector', 'minGap'],
        doc: 'Interactive elements keep a minimum gap between them.',
    },
    visible: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'The element is present and rendered (display/visibility/area).',
    },
    hidden: {
        params: { selector: sel() },
        argOrder: ['selector'],
        doc: 'The element is absent or not rendered.',
    },
} as const satisfies Record<string, ConstraintSpec>;

export type ConstraintName = keyof typeof CONSTRAINT_REGISTRY;

export const CONSTRAINT_NAMES = Object.keys(CONSTRAINT_REGISTRY) as ConstraintName[];

export function isConstraintName(name: string): name is ConstraintName {
    return name in CONSTRAINT_REGISTRY;
}

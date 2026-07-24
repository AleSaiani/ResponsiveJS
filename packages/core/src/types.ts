/**
 * Core types for r$ — ResponsiveJS
 */

import type { Rect } from './rect.js';

/** Measured state of one element at one viewport width */
export interface ElementSnapshot {
    selector: string;
    index: number;
    rect: Rect;
    styles: {
        fontSize: number;
        lineHeight: number;
        /** Numeric font-weight (normal=400, bold=700). Used for WCAG large-text bold rule. */
        fontWeight: number;
        gap: number;
        paddingTop: number;
        paddingRight: number;
        paddingBottom: number;
        paddingLeft: number;
        marginTop: number;
        marginRight: number;
        marginBottom: number;
        marginLeft: number;
        borderRadiusTL: number;
        borderRadiusTR: number;
        borderRadiusBR: number;
        borderRadiusBL: number;
        minWidth: number;
        maxWidth: number;
        minHeight: number;
        maxHeight: number;
        zIndex: number;
        opacity: number;
        outlineWidth: number;
        outlineOffset: number;
    };
    computed: {
        display: string;
        overflow: string;
        position: string;
        visibility: string;
        pointerEvents: string;
        backgroundColor: string;
        color: string;
        boxSizing: string;
        textAlign: string;
        whiteSpace: string;
        cursor: string;
        /** Lowercase tag name (collector-provided; absent in synthetic stores). */
        tagName?: string;
        /** DOM-semantic interactivity: native controls (button/a[href]/input/…),
         *  interactive roles, or tabindex >= 0 — and not disabled. */
        interactive?: boolean;
        /** Nearest ancestor (html/body excluded) that contains horizontal
         *  overflow: 'scroll' (overflow-x auto/scroll — a scroll region by
         *  design) or 'clip' (hidden/clip). Absent = overflow would bleed
         *  the page (naked). Collector-provided. */
        overflowContainment?: 'scroll' | 'clip';
    };
}

/**
 * Provenance — the bridge between the authoring and verification planes.
 * A runtime construct registers what it controls; the collector ships the
 * manifest with the measurements; the oracle traces violations back to the
 * construct that owns the element.
 */
export interface ProvenanceEntry {
    id: number;
    /** Which construct: 'style' (r$ apply), 'geometry', 'tokens', 'sync', 'ratio'. */
    construct: string;
    /** The selector (or element description) the construct controls. */
    target: string;
    /** What it does there — property/state names with their value kinds. */
    behavior: string[];
    /** Best-effort call site (file:line from the creation stack). */
    source?: string;
}

/** Parent with its direct children rects */
export interface ChildRelation {
    parentSelector: string;
    parentRect: Rect;
    childRects: Rect[];
}

/** All measurements at one viewport width */
export interface ViewportSnapshot {
    width: number;
    height: number;
    elements: Map<string, ElementSnapshot[]>;
    childRelations: Map<string, ChildRelation[]>;
    timestamp: number;
    scrollY?: number;
    /** Runtime provenance manifest, when the page runs @responsivejs/runtime. */
    manifest?: ProvenanceEntry[];
}

/** All measurements across all viewport widths */
export interface SnapshotStore {
    snapshots: Map<number, ViewportSnapshot>;
    widths: number[];
    selectors: string[];
    /** Runtime provenance manifest, lifted from the measured page. */
    manifest?: ProvenanceEntry[];
}

/** Machine-readable fix suggestion for agentic consumers.
 *  kind is the apply-contract: 'exact' fixes are safe to apply verbatim as
 *  `selector { property: value }`; 'heuristic' fixes point in a direction
 *  (value may be a placeholder) and need judgment before applying. */
export interface FixSuggestion {
    selector: string;
    property: string;
    value: string;
    reason: string;
    kind: 'exact' | 'heuristic';
}

/** A constraint violation */
export interface Violation {
    rule: string;
    element?: string;
    elements?: string[];
    width: number;
    detail: string;
    expected?: number;
    actual?: number;
    severity?: 'error' | 'warning' | 'info';
    suggestion?: string;
    fix?: FixSuggestion;
    /** The runtime construct that owns this element (from the provenance manifest). */
    owner?: {
        construct: string;
        behavior: string[];
        source?: string;
    };
}

/** Report from constraint validation */
export interface Report {
    pass: boolean;
    /** Number of checks performed. */
    total: number;
    /** Checks with no violation: total − failed. Never negative. */
    passed: number;
    /** Number of FAILED CHECKS (one check can carry several violations —
     *  e.g. minSize failing width AND height — so this can be < violations.length). */
    failed: number;
    violations: Violation[];
}

/** Sweep configuration */
export interface SweepOptions {
    url: string;
    widths?: number[];
    from?: number;
    to?: number;
    step?: number;
    selectors: string[];
    height?: number;
    scroll?: boolean;
    scrollSteps?: number;
}

/** Measured element in normal, hover, and focus states */
export interface InteractionSnapshot {
    selector: string;
    normal: ElementSnapshot;
    hover?: ElementSnapshot;
    focus?: ElementSnapshot;
}

/** Default viewport widths for sweeping */
export const DEFAULT_WIDTHS = [
    320,   // iPhone SE
    375,   // iPhone 12/13
    390,   // iPhone 14/15
    768,   // iPad portrait
    1024,  // iPad landscape
    1280,  // laptop
    1440,  // desktop
    1920,  // full HD
    2560,  // QHD
];

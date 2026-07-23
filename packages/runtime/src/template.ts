/**
 * The two string-based authoring surfaces:
 * - tagged template: responsive`.el { font-size: ${fluid(14,24)}px }`
 * - utility grammar: responsive.apply('.el', 'text-fluid-sm-xl p-fluid-2-8')
 *
 * Both are restricted micro-grammars: anything not covered throws with an
 * explicit message rather than guessing.
 */

import { applyResponsive, type ResponsiveHandle } from './apply.js';
import { fluid, custom, isResponsiveValue, type StyleMap, type ResponsiveValue } from './value.js';
import { space } from './layout.js';

// ─── tagged template ────────────────────────────────────────────────────

interface TemplateRule {
    selector: string;
    map: StyleMap;
}

// Control-character delimiters: cannot appear in author CSS and are
// regex-inert (unlike '$', which is a regex anchor).
const PH_OPEN = '\u0001';
const PH_CLOSE = '\u0002';
// eslint-disable-next-line no-control-regex -- deliberate: control chars cannot appear in author CSS
const PLACEHOLDER_RE = /\u0001(\d+)\u0002/g;

export function parseTemplate(strings: TemplateStringsArray, values: unknown[]): TemplateRule[] {
    // Reassemble with placeholder markers so we can find value positions.
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += PH_OPEN + i + PH_CLOSE + strings[i + 1];

    if (text.includes('@')) {
        throw new Error('responsive template: at-rules (@media, @container) are not supported — use breakpoint.* values instead.');
    }

    const rules: TemplateRule[] = [];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(text)) !== null) {
        const selector = m[1].trim();
        if (selector.includes(PH_OPEN)) {
            throw new Error('responsive template: placeholders are only allowed in value position, not in selectors.');
        }
        const map: StyleMap = {};
        for (const decl of m[2].split(';')) {
            const trimmed = decl.trim();
            if (trimmed === '') continue;
            const colon = trimmed.indexOf(':');
            if (colon === -1) throw new Error(`responsive template: invalid declaration '${trimmed}'.`);
            const prop = trimmed.slice(0, colon).trim();
            const rawValue = trimmed.slice(colon + 1).trim();
            map[camelize(prop)] = parseTemplateValue(rawValue, values);
        }
        rules.push({ selector, map });
    }

    if (rules.length === 0 || text.replace(ruleRe, '').trim() !== '') {
        const leftover = text.replace(/[^{}]+\{[^{}]*\}/g, '').trim();
        if (rules.length === 0 || leftover !== '') {
            throw new Error(
                `responsive template: could not parse${leftover ? ` near '${leftover.slice(0, 40)}'` : ' (no rules found)'}. ` +
                    'Supported grammar: selector { prop: value; … } without nesting.',
            );
        }
    }
    return rules;
}

function camelize(prop: string): string {
    return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parseTemplateValue(raw: string, values: unknown[]): StyleMap[string] {
    PLACEHOLDER_RE.lastIndex = 0;
    const re = PLACEHOLDER_RE;
    const parts: (string | ResponsiveValue)[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        if (m.index > last) parts.push(raw.slice(last, m.index));
        const value = values[Number(m[1])];
        if (!isResponsiveValue(value)) {
            throw new Error('responsive template: interpolated values must be ResponsiveValues (fluid(), when(), …).');
        }
        parts.push(value);
        last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push(raw.slice(last));

    if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
    if (parts.length === 1) return parts[0] as ResponsiveValue;

    // Mixed literal + placeholder (e.g. `${fluid(14,24)}px`): resolve and concatenate.
    return custom((width) =>
        parts.map((p) => (typeof p === 'string' ? p : p.resolve(width))).join(''),
    );
}

export function template(strings: TemplateStringsArray, values: unknown[]): { dispose(): void } {
    const rules = parseTemplate(strings, values);
    const handles: ResponsiveHandle[] = rules.map((r) => applyResponsive(r.selector, r.map));
    return {
        dispose() {
            for (const h of handles) h.dispose();
        },
    };
}

// ─── utility grammar (Tailwind-like) ────────────────────────────────────

const TEXT_SIZES: Record<string, number> = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
};

const NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    gray: '#808080',
    grey: '#808080',
    teal: '#008080',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    navy: '#000080',
    olive: '#808000',
    maroon: '#800000',
    silver: '#c0c0c0',
    lime: '#00ff00',
    aqua: '#00ffff',
};

const PROP_ALIASES: Record<string, { property: string; kind: 'text' | 'space' | 'color' }> = {
    text: { property: 'fontSize', kind: 'text' },
    p: { property: 'padding', kind: 'space' },
    m: { property: 'margin', kind: 'space' },
    gap: { property: 'gap', kind: 'space' },
    bg: { property: 'backgroundColor', kind: 'color' },
    color: { property: 'color', kind: 'color' },
};

function parseColorToken(token: string, utility: string): string {
    const hex = token.startsWith('#') ? token : NAMED_COLORS[token];
    if (!hex) {
        throw new Error(
            `responsive.apply(): unknown color '${token}' in '${utility}'. Use a hex value or one of: ${Object.keys(NAMED_COLORS).join(', ')}.`,
        );
    }
    return hex;
}

export function parseUtilities(spec: string): StyleMap {
    const map: StyleMap = {};
    for (const utility of spec.split(/\s+/).filter(Boolean)) {
        const m = utility.match(/^([a-z]+)-fluid-(.+)-([^-]+)$/);
        if (!m) {
            throw new Error(
                `responsive.apply(): unparseable utility '${utility}'. Grammar: {alias}-fluid-{from}-{to} with alias in ${Object.keys(PROP_ALIASES).join('/')}.`,
            );
        }
        const [, alias, fromTok, toTok] = m;
        const entry = PROP_ALIASES[alias];
        if (!entry) {
            throw new Error(`responsive.apply(): unknown alias '${alias}' in '${utility}'. Known: ${Object.keys(PROP_ALIASES).join(', ')}.`);
        }

        if (entry.kind === 'text') {
            const from = TEXT_SIZES[fromTok];
            const to = TEXT_SIZES[toTok];
            if (from === undefined || to === undefined) {
                throw new Error(
                    `responsive.apply(): unknown text size in '${utility}'. Known: ${Object.keys(TEXT_SIZES).join(', ')}.`,
                );
            }
            map[entry.property] = fluid(from, to);
        } else if (entry.kind === 'space') {
            const from = Number(fromTok);
            const to = Number(toTok);
            if (!Number.isFinite(from) || !Number.isFinite(to)) {
                throw new Error(`responsive.apply(): space levels must be numbers in '${utility}'.`);
            }
            map[entry.property] = space.fluid(from, to);
        } else {
            map[entry.property] = fluid(parseColorToken(fromTok, utility), parseColorToken(toTok, utility));
        }
    }
    return map;
}

export function applyUtilities(target: string | Element, spec: string): ResponsiveHandle {
    return applyResponsive(target, parseUtilities(spec));
}

/**
 * Arbitrary-property measurement for the element inspector: any CSS
 * property (including custom properties) read from getComputedStyle at
 * every swept width. Numeric values become curves; non-numeric ones stay
 * discrete (a value per width — how adaptive switches look).
 */

/** Expression: { [prop]: computedValue } for one element, or null if absent. */
export function buildPropsExpression(selector: string, props: string[]): string {
    return `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out = {};
        for (const p of ${JSON.stringify(props)}) out[p] = cs.getPropertyValue(p).trim();
        return out;
    })()`;
}

/** '16px' → 16 … but 'auto', '1fr 1fr', colors → not a number. */
function numeric(value: string): number | null {
    if (!/^-?[\d.]+[a-z%]*$/.test(value)) return null;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

export type PropTrack =
    | { kind: 'curve'; curve: Map<number, number> }
    | { kind: 'discrete'; values: Map<number, string> };

/** All-numeric across widths → a plottable curve; anything else → discrete. */
export function toTrack(values: Map<number, string>): PropTrack {
    const curve = new Map<number, number>();
    for (const [w, raw] of values) {
        const n = numeric(raw);
        if (n === null) return { kind: 'discrete', values };
        curve.set(w, n);
    }
    return { kind: 'curve', curve };
}

/** "letter-spacing, --space-m" → ['letter-spacing', '--space-m']. */
export function parsePropList(raw: string): string[] {
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

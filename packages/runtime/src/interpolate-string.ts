/**
 * Structural string interpolation: transforms, shadows, filters.
 *
 * Both endpoints are tokenized into Literal | Number(unit) | Color tokens and
 * must be structurally congruent (same token kinds, same literal texts, same
 * units — with `0` inheriting the other side's unit). Anything else throws
 * loudly: fuzzy matching is how silent visual bugs happen.
 */

import { cubicBezier, EASINGS, progress, type EasingName, type Bezier } from '@responsivejs/core/interpolate';
import { makeValue, domainOf, type ResponsiveValue, type FluidOpts } from './value.js';
import { mixColors } from './interpolate-color.js';

type Token =
    | { kind: 'literal'; text: string }
    | { kind: 'number'; value: number; unit: string }
    | { kind: 'color'; text: string };

const COLOR_TOKEN_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const NUMBER_RE = /-?\d*\.?\d+([a-z%]*)/gi;

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let rest = input;

    while (rest.length > 0) {
        COLOR_TOKEN_RE.lastIndex = 0;
        const colorMatch = COLOR_TOKEN_RE.exec(rest);
        NUMBER_RE.lastIndex = 0;
        const numberMatch = NUMBER_RE.exec(rest);

        const colorAt = colorMatch ? colorMatch.index : Infinity;
        const numberAt = numberMatch ? numberMatch.index : Infinity;

        if (colorAt === Infinity && numberAt === Infinity) {
            tokens.push({ kind: 'literal', text: rest });
            break;
        }

        if (colorAt <= numberAt) {
            if (colorAt > 0) tokens.push({ kind: 'literal', text: rest.slice(0, colorAt) });
            tokens.push({ kind: 'color', text: colorMatch![0] });
            rest = rest.slice(colorAt + colorMatch![0].length);
        } else {
            if (numberAt > 0) tokens.push({ kind: 'literal', text: rest.slice(0, numberAt) });
            const raw = numberMatch![0];
            const unit = numberMatch![1] ?? '';
            tokens.push({ kind: 'number', value: parseFloat(raw), unit });
            rest = rest.slice(numberAt + raw.length);
        }
    }
    return tokens;
}

function congruent(a: Token[], b: Token[], from: string, to: string): void {
    if (a.length !== b.length) {
        throw new Error(
            `fluid(): incompatible endpoints — '${from}' has ${a.length} tokens, '${to}' has ${b.length}. ` +
                'Both strings must share the same structure (same functions, same value count).',
        );
    }
    for (let i = 0; i < a.length; i++) {
        const ta = a[i];
        const tb = b[i];
        if (ta.kind !== tb.kind) {
            throw new Error(
                `fluid(): incompatible endpoints at token #${i + 1}: ` +
                    `'${describe(ta)}' vs '${describe(tb)}' — kinds differ (${ta.kind} vs ${tb.kind}).`,
            );
        }
        if (ta.kind === 'literal' && tb.kind === 'literal' && ta.text !== tb.text) {
            throw new Error(
                `fluid(): incompatible endpoints at token #${i + 1}: literal '${ta.text.trim()}' vs '${tb.text.trim()}'.`,
            );
        }
        if (ta.kind === 'number' && tb.kind === 'number') {
            const unitsCompatible = ta.unit === tb.unit || ta.value === 0 || tb.value === 0;
            if (!unitsCompatible) {
                throw new Error(
                    `fluid(): incompatible endpoints at token #${i + 1}: unit '${ta.unit}' vs '${tb.unit}'.`,
                );
            }
        }
    }
}

function describe(t: Token): string {
    if (t.kind === 'literal') return t.text.trim();
    if (t.kind === 'number') return `${t.value}${t.unit}`;
    return t.text;
}

function tMapOf(curve?: FluidOpts['curve']): (t: number) => number {
    if (!curve || curve === 'linear') return (t) => t;
    if (curve === 'exponential') return (t) => (Math.pow(4, t) - 1) / 3;
    if (curve === 'logarithmic') return (t) => Math.log(1 + 3 * t) / Math.log(4);
    return cubicBezier(typeof curve === 'string' ? EASINGS[curve as EasingName] : (curve as Bezier));
}

export function stringFluid(from: string, to: string, opts?: FluidOpts): ResponsiveValue {
    const a = tokenize(from);
    const b = tokenize(to);
    congruent(a, b, from, to);
    const tMap = tMapOf(opts?.curve);

    return makeValue({
        kind: 'string',
        container: opts?.container,
        resolve(width) {
            const t = tMap(progress(width, domainOf(opts)));
            let out = '';
            for (let i = 0; i < a.length; i++) {
                const ta = a[i];
                const tb = b[i];
                if (ta.kind === 'literal') {
                    out += ta.text;
                } else if (ta.kind === 'number' && tb.kind === 'number') {
                    const unit = ta.value === 0 && ta.unit === '' ? tb.unit : ta.unit;
                    const v = ta.value + (tb.value - ta.value) * t;
                    out += `${Math.round(v * 10000) / 10000}${unit}`;
                } else if (ta.kind === 'color' && tb.kind === 'color') {
                    out += mixColors(ta.text, tb.text, t);
                }
            }
            return out;
        },
        toStatic: () => null,
    });
}

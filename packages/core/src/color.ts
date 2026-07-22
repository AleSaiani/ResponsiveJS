/**
 * Color math — parse CSS colors, compute WCAG contrast ratios.
 * Pure math, no DOM dependency.
 */

export interface RGBA {
    r: number; // 0-1
    g: number; // 0-1
    b: number; // 0-1
    a: number; // 0-1
}

/** Parse a CSS color string (rgb, rgba, hex) to normalized RGBA. */
export function parseColor(css: string): RGBA {
    if (!css || css === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
        return {
            r: parseFloat(rgbMatch[1]) / 255,
            g: parseFloat(rgbMatch[2]) / 255,
            b: parseFloat(rgbMatch[3]) / 255,
            a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
        };
    }

    // Modern rgb(r g b / a) syntax
    const rgbSpaceMatch = css.match(/rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
    if (rgbSpaceMatch) {
        let a = 1;
        if (rgbSpaceMatch[4] !== undefined) {
            a = rgbSpaceMatch[4].endsWith('%')
                ? parseFloat(rgbSpaceMatch[4]) / 100
                : parseFloat(rgbSpaceMatch[4]);
        }
        return {
            r: parseFloat(rgbSpaceMatch[1]) / 255,
            g: parseFloat(rgbSpaceMatch[2]) / 255,
            b: parseFloat(rgbSpaceMatch[3]) / 255,
            a,
        };
    }

    // Hex: #rgb, #rrggbb, #rrggbbaa
    const hexMatch = css.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16) / 255,
                g: parseInt(hex[1] + hex[1], 16) / 255,
                b: parseInt(hex[2] + hex[2], 16) / 255,
                a: 1,
            };
        }
        if (hex.length === 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16) / 255,
                g: parseInt(hex.slice(2, 4), 16) / 255,
                b: parseInt(hex.slice(4, 6), 16) / 255,
                a: 1,
            };
        }
        if (hex.length === 8) {
            return {
                r: parseInt(hex.slice(0, 2), 16) / 255,
                g: parseInt(hex.slice(2, 4), 16) / 255,
                b: parseInt(hex.slice(4, 6), 16) / 255,
                a: parseInt(hex.slice(6, 8), 16) / 255,
            };
        }
    }

    // HSL: hsl(h, s%, l%) or hsla(h, s%, l%, a) — comma syntax
    const hslComma = css.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/);
    if (hslComma) {
        return hslToRgba(
            parseFloat(hslComma[1]),
            parseFloat(hslComma[2]) / 100,
            parseFloat(hslComma[3]) / 100,
            hslComma[4] !== undefined ? parseFloat(hslComma[4]) : 1,
        );
    }

    // HSL modern: hsl(h s% l% / a)
    const hslSpace = css.match(/hsla?\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+%?))?\s*\)/);
    if (hslSpace) {
        let a = 1;
        if (hslSpace[4] !== undefined) {
            a = hslSpace[4].endsWith('%') ? parseFloat(hslSpace[4]) / 100 : parseFloat(hslSpace[4]);
        }
        return hslToRgba(parseFloat(hslSpace[1]), parseFloat(hslSpace[2]) / 100, parseFloat(hslSpace[3]) / 100, a);
    }

    // OKLCH: oklch(L C H) or oklch(L C H / a)
    const oklchMatch = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
    if (oklchMatch) {
        let a = 1;
        if (oklchMatch[4] !== undefined) {
            a = oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : parseFloat(oklchMatch[4]);
        }
        return oklchToRgba(parseFloat(oklchMatch[1]), parseFloat(oklchMatch[2]), parseFloat(oklchMatch[3]), a);
    }

    // Fallback: opaque black
    return { r: 0, g: 0, b: 0, a: 1 };
}

/** WCAG 2.1 relative luminance (0-1). */
export function relativeLuminance(color: RGBA): number {
    const linearize = (c: number) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    const R = linearize(color.r);
    const G = linearize(color.g);
    const B = linearize(color.b);

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two colors (1:1 to 21:1). */
export function contrastRatio(fg: string, bg: string): number {
    const fgColor = parseColor(fg);
    const bgColor = parseColor(bg);

    // Blend foreground alpha onto background
    const blended = blendAlpha(fgColor, bgColor);

    const L1 = relativeLuminance(blended.fg);
    const L2 = relativeLuminance(blended.bg);

    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);

    return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: 4.5:1 normal, 3:1 large text (>=18pt or >=14pt bold). */
export function meetsAA(ratio: number, largeText = false): boolean {
    return ratio >= (largeText ? 3 : 4.5);
}

/** WCAG AAA: 7:1 normal, 4.5:1 large text. */
export function meetsAAA(ratio: number, largeText = false): boolean {
    return ratio >= (largeText ? 4.5 : 7);
}

// ─── HSL → RGB ──────────────────────────────────────────────────────────

function hslToRgba(h: number, s: number, l: number, a: number): RGBA {
    h = ((h % 360) + 360) % 360; // normalize hue to 0-360
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r: number, g: number, b: number;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }

    return { r: r + m, g: g + m, b: b + m, a };
}

// ─── OKLCH → RGB (via OKLab → linear sRGB → sRGB) ──────────────────────

function oklchToRgba(L: number, C: number, H: number, a: number): RGBA {
    // OKLCH → OKLab
    const hRad = (H * Math.PI) / 180;
    const labA = C * Math.cos(hRad);
    const labB = C * Math.sin(hRad);

    // OKLab → linear sRGB (via LMS intermediate)
    const l_ = L + 0.3963377774 * labA + 0.2158037573 * labB;
    const m_ = L - 0.1055613458 * labA - 0.0638541728 * labB;
    const s_ = L - 0.0894841775 * labA - 1.2914855480 * labB;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Linear sRGB → sRGB (gamma compression)
    const gammaCompress = (c: number) =>
        c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

    return {
        r: clamp01(gammaCompress(lr)),
        g: clamp01(gammaCompress(lg)),
        b: clamp01(gammaCompress(lb)),
        a,
    };
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

function blendAlpha(fg: RGBA, bg: RGBA): { fg: RGBA; bg: RGBA } {
    if (fg.a >= 1) return { fg, bg };

    // Blend fg over bg
    const a = fg.a;
    return {
        fg: {
            r: fg.r * a + bg.r * (1 - a),
            g: fg.g * a + bg.g * (1 - a),
            b: fg.b * a + bg.b * (1 - a),
            a: 1,
        },
        bg,
    };
}
